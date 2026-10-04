"""translate_en.py — англійська версія записів каталогу.

Проблема: сайт має англійську сторінку, але сам каталог — український.
Чесна порада «увімкніть перекладач у браузері» вимагає від людини знати, де
та кнопка, і дає машинний переклад поверх сторінки, який ламає фільтри й
нічого не лишає пошуковим системам. Тож переклад робимо самі й зберігаємо
поруч з оригіналом.

Оригінал лишається джерелом правди: якщо перекладу ще немає, сторінка показує
українське поле, а не порожнечу. Тому скрипт можна ганяти частинами й
зупиняти будь-коли.

Черга: активні записи, у яких перекладу немає зовсім або в яких змінився сам
текст — назва, короткий чи повний опис (див. text_hash).

До 04.10.2026 застарілим вважався переклад, старший за updated_at. Але
updated_at рухає не лише правка тексту: повторна екстракція (db.py), планові
перевірки (proof_recheck.py) і TTL лише «торкаються» запису — і Haiku щоночі
перекладав наново тексти, у яких не змінилось ні слова.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (підсумок у чат),
     BATCH (скільки за прогін, деф. 200), WORKERS (деф. 6),
     DRY_RUN=true — лише лог.
"""
import hashlib
import json
import logging
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import anthropic


import api_guard  # відмова через ліміт/оплату робить запуск червоним
import usage
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

MODEL = "claude-haiku-4-5-20251001"

# Скільки зʼїв переклад — у llm_usage (04.10.2026, після вичерпаного балансу).
SPEND = usage.Spend("translate-en")

# ── Хеш тексту, з якого зроблено переклад ──────────────────────────────────
# Поля — рівно ті, що йдуть у модель (translate_one). Опис хешуємо цілим, а не
# перші DETAILS_LIMIT знаків: правка в хвості рідкісна, а одна формула на
# повний текст простіша й однакова в Python і SQL.
#
# Формула мусить побайтно збігатися з SQL у міграції
# supabase/migrations/20261004_llm_spend_memory.sql — нею заповнено хеш для
# записів, чий переклад на момент міграції був свіжий. Розійдуться — кожен
# такий запис перекладеться ще раз. Тест: tests/test_translate_hash.py.
# NULL і порожній рядок — одне й те саме: translate_one їх теж не розрізняє.
HASH_FIELDS = ("title", "summary", "details")
HASH_SEP = "\x1f"   # chr(31), роздільник одиниць: у тексті його не буває
HASH_SQL = ("md5(coalesce(title, '') || chr(31) || coalesce(summary, '') "
            "|| chr(31) || coalesce(details, ''))")


def text_hash(row: dict) -> str:
    """md5 тексту запису — той самий, що HASH_SQL рахує в базі."""
    text = HASH_SEP.join(row.get(k) or "" for k in HASH_FIELDS)
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def is_stale(row: dict) -> bool:
    """Переклад застарів, лише якщо змінився сам текст. Хешу немає (NULL) —
    теж застарів: так міграція позначила тих, хто вже тоді чекав перекладу."""
    return row.get("translated_hash") != text_hash(row)


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
            model=MODEL,
            max_tokens=4000,
            system=SYSTEM,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "translate"},
            messages=[{"role": "user", "content": body}],
        )
        SPEND.add(MODEL, resp)
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


def has_hash_column(client) -> bool:
    """Чи застосовано міграцію з translated_hash.

    Без колонки працюємо по-старому (updated_at > translated_at): вважати
    відсутній хеш застарілим означало б щоночі перекладати BATCH записів
    наново, а писати його — губити кожен переклад на помилці «немає колонки»."""
    try:
        client.table("opportunities").select("translated_hash").limit(1).execute()
        return True
    except Exception as e:                                   # noqa: BLE001
        logger.warning("Колонки translated_hash немає (міграцію 20261004_llm_spend_memory.sql "
                       "не застосовано?): %s. Застарілість — за updated_at, як до 04.10.2026.", e)
        return False


def stale_by_hash(client, limit: int) -> list[dict]:
    """Перекладені записи, чий текст змінився після перекладу, — найдавніші
    переклади першими.

    Читаємо всі перекладені, а не перші `limit` за translated_at, як колись:
    свіжі давні переклади стояли б на початку черги вічно й закривали собою
    справді застарілі. Порівняти хеш у PostgREST-фільтрі не можна, тож — тут."""
    rows, start = [], 0
    while True:
        page = (client.table("opportunities")
                .select("id, title, summary, details, translated_at, translated_hash")
                .eq("status", "active")
                .is_("canonical_slug", "null")
                .not_.is_("translated_at", "null")
                .order("translated_at").order("id")
                .range(start, start + 999).execute().data or [])
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    return [r for r in rows if is_stale(r)][:max(0, limit)]


def main() -> int:
    from db import get_client
    client = get_client()
    hashed = has_hash_column(client)

    # Спочатку ті, у кого перекладу немає зовсім (translated_at is null),
    # потім найдавніші переклади — так перший прогін дає максимум користі.
    rows = (client.table("opportunities")
            .select("id, title, summary, details, updated_at, translated_at")
            .eq("status", "active")
            .is_("canonical_slug", "null")
            .is_("translated_at", "null")
            .limit(BATCH).execute().data or [])

    if len(rows) < BATCH and hashed:
        # Добираємо застарілі переклади: змінився сам текст.
        rows += stale_by_hash(client, BATCH - len(rows))
    elif len(rows) < BATCH:
        # Старий шлях — лише доки міграцію не застосовано (див. has_hash_column).
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

    llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
    done = failed = 0
    # Сухий прогін — «лише лог»: і витрати лише в лог, не в llm_usage.
    SPEND.dry = DRY

    def work(row):
        patch = translate_one(llm, row)
        if not patch:
            return row, None
        if hashed:
            # Хеш того тексту, який щойно переклали, — не того, що в базі
            # зараз: якщо запис встигли поправити, наступний прогін це побачить.
            patch["translated_hash"] = text_hash(row)
        return row, patch

    try:
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
    finally:
        SPEND.record(client)

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
