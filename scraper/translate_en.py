"""translate_en.py — англійська версія записів каталогу.

Проблема: сайт має англійську сторінку, але сам каталог — український.
Чесна порада «увімкніть перекладач у браузері» вимагає від людини знати, де
та кнопка, і дає машинний переклад поверх сторінки, який ламає фільтри й
нічого не лишає пошуковим системам. Тож переклад робимо самі й зберігаємо
поруч з оригіналом.

Оригінал лишається джерелом правди: якщо перекладу ще немає, сторінка показує
українське поле, а не порожнечу. Тому скрипт можна ганяти частинами й
зупиняти будь-коли.

Черга: активні записи, у яких перекладу немає зовсім або він старіший за
останню зміну запису (текст відредагували — переклад застарів).

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (підсумок у чат),
     BATCH (скільки за прогін, деф. 200), WORKERS (деф. 6),
     DRY_RUN=true — лише лог.
"""
import json
import logging
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import anthropic

logger = logging.getLogger("translate_en")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
BATCH = int(os.environ.get("BATCH", "200"))
WORKERS = int(os.environ.get("WORKERS", "6"))
DRY = os.environ.get("DRY_RUN", "").lower() == "true"

# Довгий опис ріжемо: далі йдуть переважно контакти й реквізити, які
# перекладати нема сенсу, а токени вони з'їдають на кожному записі.
DETAILS_LIMIT = 6000

TOOL = {
    "name": "translate",
    "description": "Переклад запису каталогу англійською.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title_en": {"type": "string", "description": "Назва англійською."},
            "summary_en": {"type": "string", "description": "Короткий опис англійською."},
            "details_en": {"type": "string", "description": "Повний опис англійською. Порожній рядок, якщо оригіналу немає."},
        },
        "required": ["title_en"],
        "additionalProperties": False,
    },
}

SYSTEM = """Ти перекладаєш записи каталогу можливостей для українських дітей
з української на англійську. Читатимуть це батьки, вчителі й волонтери за
кордоном — часто не носії англійської.

Правила:

1. Перекладай зміст, а не слова. Англійська має звучати природно, як писав би
   носій. Канцелярит оригіналу («здійснюється набір учасників») передавай
   нормальною мовою («applications are open»).
2. Нічого не додавай і нічого не викидай. Жодних фактів, яких немає в
   оригіналі: ні дат, ні цін, ні обіцянок.
3. Власні назви: організації, програми й міста передавай латиницею за
   офіційним українським транслітом (Київ → Kyiv, Львів → Lviv, Житомир →
   Zhytomyr). Якщо в організації є усталена англійська назва — бери її.
   Назву програми, яку не перекладають (FLEX, Erasmus+), лишай як є.
4. Реалії, яких немає в англійській, пояснюй коротко в тому ж реченні:
   «НМТ» → «NMT (Ukraine's national school-leaving test)»;
   «ЦНАП» → «ADMINISTRATIVE SERVICE CENTRE» лише якщо це справді воно.
   Не роби виносок і не додавай дужок там, де сенс і так зрозумілий.
5. Гривні лишай гривнями: «10 000 грн» → «UAH 10,000». Не переводь у долари.
6. Зберігай розбивку на абзаци й переліки з оригіналу: у details_en мають
   лишитись ті самі переноси рядків.
7. Якщо оригінального опису немає — поверни порожній рядок, не вигадуй.

Пиши британською або американською послідовно в межах запису — головне, щоб
читалося просто."""


def tg(text: str) -> None:
    if not BOT_TOKEN or not ADMIN_CHAT_ID:
        return
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            data=json.dumps({"chat_id": ADMIN_CHAT_ID, "text": text, "parse_mode": "HTML"}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        logger.error("tg failed: %s", e)


def translate_one(llm, row):
    """Один запис → dict із перекладом, або None, якщо не вийшло."""
    body = f"Назва: {row['title']}\n\n"
    if row.get("summary"):
        body += f"Короткий опис: {row['summary']}\n\n"
    if row.get("details"):
        body += f"Повний опис:\n{row['details'][:DETAILS_LIMIT]}"

    try:
        resp = llm.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
            system=SYSTEM,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "translate"},
            messages=[{"role": "user", "content": body}],
        )
    except Exception as e:
        logger.error("LLM failed for «%s»: %s", row["title"][:60], e)
        return None

    tu = next((b for b in resp.content if b.type == "tool_use"), None)
    if not tu or not tu.input.get("title_en"):
        logger.error("Без перекладу: «%s»", row["title"][:60])
        return None

    out = tu.input
    patch = {
        "title_en": out["title_en"].strip(),
        "translated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Порожній рядок від моделі означає «оригіналу немає» — не затираємо
    # попередній переклад порожнечею, просто не чіпаємо поле.
    if (out.get("summary_en") or "").strip():
        patch["summary_en"] = out["summary_en"].strip()
    # Повний опис перекладаємо ЛИШЕ якщо він є в оригіналі. Просити модель
    # мовчати недостатньо: на восьми записах без details вона однаково
    # написала «повний опис», переказавши короткий. Виходило, що англійська
    # сторінка розповідає більше за українську — а перевіряти цей текст ні з
    # чим. Тож рішення приймає не модель, а наявність оригіналу.
    if row.get("details") and (out.get("details_en") or "").strip():
        patch["details_en"] = out["details_en"].strip()
    return patch


def main() -> int:
    from db import get_client
    client = get_client()

    # Спочатку ті, у кого перекладу немає зовсім (translated_at is null),
    # потім найдавніші переклади — так перший прогін дає максимум користі.
    rows = (client.table("opportunities")
            .select("id, title, summary, details, updated_at, translated_at")
            .eq("status", "active")
            .is_("canonical_slug", "null")
            .is_("translated_at", "null")
            .limit(BATCH).execute().data or [])

    if len(rows) < BATCH:
        # Добираємо застарілі переклади: запис змінили після перекладу.
        stale = (client.table("opportunities")
                 .select("id, title, summary, details, updated_at, translated_at")
                 .eq("status", "active")
                 .is_("canonical_slug", "null")
                 .not_.is_("translated_at", "null")
                 .order("translated_at")
                 .limit(BATCH - len(rows)).execute().data or [])
        rows += [r for r in stale
                 if r.get("updated_at") and r.get("translated_at")
                 and r["updated_at"] > r["translated_at"]]

    logger.info("До перекладу: %d записів (у %d потоків)", len(rows), WORKERS)
    if not rows:
        logger.info("Нема чого перекладати — усе свіже.")
        return 0

    llm = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    done = failed = 0

    def work(row):
        patch = translate_one(llm, row)
        if not patch:
            return row, None
        return row, patch

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for row, patch in pool.map(work, rows):
            if not patch:
                failed += 1
                continue
            logger.info("%s → %s", row["title"][:45], patch["title_en"][:45])
            if not DRY:
                try:
                    client.table("opportunities").update(patch).eq("id", row["id"]).execute()
                except Exception as e:
                    logger.error("update failed for %s: %s", row["id"], e)
                    failed += 1
                    continue
            done += 1

    left = (client.table("opportunities")
            .select("id", count="exact", head=True)
            .eq("status", "active")
            .is_("canonical_slug", "null")
            .is_("translated_at", "null").execute().count or 0)

    summary = (f"🌐 <b>Переклад англійською: {done} з {len(rows)}</b>\n\n"
               f"✅ перекладено: {done}\n"
               f"⚠️ не вийшло: {failed}\n"
               f"📋 лишилось без перекладу: {left}")
    logger.info("\n%s", summary.replace("<b>", "").replace("</b>", ""))
    if not DRY:
        tg(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
