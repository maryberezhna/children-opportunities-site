"""backfill_deadlines.py — дата або періодичність для кожного запису.

Проблема: 67 із 69 чернеток і 404 активні записи не мають дедлайну. Частина
з них справді безстрокова (курси, виплати), частина щорічна (олімпіади,
табори), а в частини дата Є в тексті — просто не витяглась. Адмін дивиться
на картку табору без дати й не може зрозуміти, живий він чи торішній.

Скрипт проходить записи без deadline і для кожного просить Claude:
  - якщо в тексті названа конкретна дата подачі/події → ставимо deadline;
  - якщо дата вже минула, а запис — чернетка → закриваємо (не пропонуємо мертве);
  - якщо це щорічна історія → recurrence='annual';
  - якщо постійно відкрита → recurrence='ongoing'.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (підсумок у чат),
     BATCH (скільки за прогін, деф. 120), DRY_RUN=true — лише лог.
"""
import json
import logging
import os
import sys
import urllib.request
from datetime import date

import anthropic

logger = logging.getLogger("backfill_deadlines")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
BATCH = int(os.environ.get("BATCH", "120"))
DRY = os.environ.get("DRY_RUN", "").lower() == "true"

TOOL = {
    "name": "classify_deadline",
    "description": "Визнач дату подачі або періодичність можливості.",
    "input_schema": {
        "type": "object",
        "properties": {
            "deadline": {"type": "string",
                         "description": "YYYY-MM-DD, ЛИШЕ якщо в тексті названа конкретна дата подачі чи події. Діапазон — перша дата."},
            "recurrence": {"type": "string", "enum": ["annual", "ongoing"],
                           "description": "annual — повторюється щороку; ongoing — постійно відкрита. Лише якщо конкретної дати немає."},
            "confidence": {"type": "number"},
        },
        "required": ["confidence"],
        "additionalProperties": False,
    },
}

SYSTEM = f"""Сьогодні {date.today().isoformat()}. Ти класифікуєш записи каталогу
можливостей для українських дітей. За назвою й описом визнач:

1. deadline — ЛИШЕ якщо в тексті прямо названа дата подачі заявок або дата
   події (для таборів/подій — дата початку). Формат YYYY-MM-DD. Якщо рік не
   вказано — найближчий майбутній або щойно минулий, за змістом. НЕ вигадуй.
2. recurrence — якщо конкретної дати немає:
   annual  — щорічні олімпіади, конкурси, програми обміну, табори як бренд;
   ongoing — постійно відкриті курси, гуртки, платформи, держвиплати.
3. Якщо незрозуміло — лише confidence < 0.5, без deadline і recurrence."""


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


def main() -> int:
    from db import get_client
    client = get_client()

    rows = (client.table("opportunities")
            .select("id, title, summary, details, opportunity_type, status, source")
            .in_("status", ["draft", "active"])
            .is_("deadline", "null")
            .is_("recurrence", "null")
            .order("status")            # чернетки першими — вони в черзі модерації
            .limit(BATCH).execute().data or [])
    logger.info("Записів без дати й періодичності: %d (беру до %d)", len(rows), BATCH)
    if not rows:
        return 0

    llm = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    today = date.today().isoformat()
    n_deadline = n_annual = n_ongoing = n_closed = n_skip = 0

    for o in rows:
        try:
            resp = llm.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=SYSTEM,
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "classify_deadline"},
                messages=[{"role": "user", "content":
                    f"Тип: {o['opportunity_type']}\nНазва: {o['title']}\n\n"
                    f"{(o.get('summary') or '')}\n\n{(o.get('details') or '')[:2500]}"}],
            )
            tu = next((b for b in resp.content if b.type == "tool_use"), None)
            out = tu.input if tu else {}
        except Exception as e:
            logger.error("LLM failed for «%s»: %s", o["title"], e)
            continue

        if out.get("confidence", 0) < 0.5:
            n_skip += 1
            continue

        patch = {}
        label = ""
        dl = out.get("deadline")
        if dl:
            patch["deadline"] = dl
            if dl < today and o["status"] == "draft":
                # Мертвій чернетці нема чого робити в черзі модерації.
                patch["status"] = "closed"
                label = f"⏰ {dl} (минув → закрито)"
                n_closed += 1
            else:
                label = f"⏰ {dl}"
                n_deadline += 1
        elif out.get("recurrence") == "annual":
            patch["recurrence"] = "annual"
            label = "🔁 щорічна"
            n_annual += 1
        elif out.get("recurrence") == "ongoing":
            patch["recurrence"] = "ongoing"
            label = "♾ постійна"
            n_ongoing += 1
        else:
            n_skip += 1
            continue

        logger.info("%-12s %s — %s", o["status"], label, o["title"][:70])
        if not DRY:
            try:
                client.table("opportunities").update(patch).eq("id", o["id"]).execute()
            except Exception as e:
                logger.error("update failed for %s: %s", o["id"], e)

    summary = (f"📅 <b>Бекфіл дат: оброблено {len(rows)}</b>\n\n"
               f"⏰ поставлено дат: {n_deadline}\n"
               f"🔁 щорічних: {n_annual}\n"
               f"♾ постійних: {n_ongoing}\n"
               f"🗑 мертвих чернеток закрито: {n_closed}\n"
               f"❓ незрозумілих (без змін): {n_skip}")
    logger.info("\n%s", summary.replace("<b>", "").replace("</b>", ""))
    if not DRY:
        tg(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
