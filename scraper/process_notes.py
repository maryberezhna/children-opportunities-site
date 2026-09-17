"""process_notes.py — застосовує нотатки модерації до чернеток.

Адмін на картці кандидата в боті тисне «💬 Нотатка» і пише, що виправити
(«вік 6–12», «це Київ, офлайн», «перепиши заголовок коротше»). Вебхук кладе
текст у opportunities.moderation_note зі note_status='pending'. Цей скрипт:

1. бере чернетки з note_status='pending';
2. просить Claude застосувати нотатку до полів запису (лише білий список
   полів — slug/status/хеш LLM не чіпає);
3. зберігає зміни, ставить note_status='applied';
4. шле оновлену картку назад в адмін-чат із тими самими кнопками апруву —
   фінальне рішення завжди за людиною.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, SITE_URL (опц.)
"""
import json
import logging
import os
import sys
import urllib.request
from datetime import datetime, timezone

import anthropic


import api_guard  # відмова через ліміт/оплату робить запуск червоним
logger = logging.getLogger("process_notes")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SITE_URL = os.environ.get("SITE_URL", "https://dityam.com.ua")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

# Поля, які нотатка МОЖЕ змінювати. Решта (slug, status, content_hash,
# source_url…) — інфраструктура, LLM до неї не торкається.
EDITABLE = [
    "title", "summary", "details", "opportunity_type", "age_from", "age_to",
    "cost_type", "price_note", "format", "cities", "deadline", "child_needs",
    # З 17.09.2026: час можливості — не лише дедлайн (аудит, С8).
    "event_start_date", "event_end_date", "timing_kind", "apply_url",
]
DATE_FIELDS = ("deadline", "event_start_date", "event_end_date")

APPLY_TOOL = {
    "name": "apply_note",
    "description": "Поверни ЛИШЕ поля, які треба змінити за нотаткою редактора.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "summary": {"type": "string"},
            "details": {"type": "string"},
            "opportunity_type": {"type": "string"},
            "age_from": {"type": "integer"},
            "age_to": {"type": "integer"},
            "cost_type": {"type": "string",
                          "enum": ["free", "paid_affordable"]},
            "price_note": {"type": "string"},
            "format": {"type": "string"},
            "cities": {"type": "array", "items": {"type": "string"}},
            "deadline": {"type": "string",
                         "description": "YYYY-MM-DD — останній день ПОДАЧІ. Порожній рядок — прибрати дедлайн."},
            "event_start_date": {"type": "string",
                                 "description": "YYYY-MM-DD — перший день проведення. Порожній рядок — прибрати."},
            "event_end_date": {"type": "string",
                               "description": "YYYY-MM-DD — останній день проведення. Порожній рядок — прибрати."},
            "timing_kind": {"type": "string", "enum": ["one_time", "periodic", "permanent"],
                            "description": "Вид за часом: разова, повторюється циклами, будь-коли."},
            "apply_url": {"type": "string", "description": "Пряме посилання на подачу заявки."},
            "child_needs": {"type": "array", "items": {"type": "string"}},
        },
        "additionalProperties": False,
    },
}

SYSTEM = """Сьогодні {today}. Ти — редактор каталогу можливостей для українських дітей (0–18).
Редактор людською мовою написав нотатку, що виправити в записі. Застосуй
РІВНО те, про що просить нотатка: не переписуй поля, яких вона не стосується.
Пиши українською, стисло й фактично. Якщо нотатка просить неможливого для
цих полів — зміни лише те, що можеш, решту проігноруй.

Дати — різні речі: «до коли подати» → deadline; «коли відбувається» →
event_start_date / event_end_date. Якщо нотатка просить прибрати дату, поверни
для цього поля порожній рядок. Рік не вказано — найближчий майбутній."""


def build_patch(raw: dict) -> dict:
    """Що з відповіді моделі справді писати в запис. Чиста функція — під тести.

    Дати — лише YYYY-MM-DD; порожній рядок для дати означає «прибрати» (раніше
    нотатка не могла стерти дедлайн узагалі). Вид — лише з трьох значень.
    Посилання на подачу — лише справжня адреса, не чат чи соцмережа.
    """
    import re
    from normalizer import valid_apply_url
    from timing import clean_kind
    patch = {}
    for key, value in (raw or {}).items():
        if key not in EDITABLE:
            continue
        if key in DATE_FIELDS:
            if value == "":
                patch[key] = None
            elif isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()):
                patch[key] = value.strip()
            continue
        if key == "timing_kind":
            if clean_kind(value):
                patch[key] = value
            continue
        if key == "apply_url":
            url = valid_apply_url(value)
            if url:
                patch[key] = url
            continue
        if value not in (None, "", []):
            patch[key] = value
    return patch

TG_ESC = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;"})


def tg(method: str, payload: dict) -> bool:
    if not BOT_TOKEN:
        return False
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp).get("ok", False)
    except Exception as e:
        logger.error("Telegram %s failed: %s", method, e)
        return False


def candidate_card(o: dict) -> str:
    esc = lambda v: str(v).translate(TG_ESC)
    meta = []
    if o.get("age_from") is not None and o.get("age_to") is not None:
        meta.append(f"👶 {o['age_from']}–{o['age_to']} р.")
    if o.get("cost_type") == "free":
        meta.append("✅ безкоштовно")
    if o.get("format"):
        meta.append(esc(o["format"]))
    lines = [
        "✍️ <b>Нотатку застосовано — перевірте</b>",
        "",
        f"🎓 <b>{esc(o['title'])}</b>",
        " · ".join(meta) if meta else "",
        f"⏰ Заявки до: {o['deadline']}" if o.get("deadline") else "",
        (f"📅 Коли: {o.get('event_start_date') or ''}"
         f"{' — ' + o['event_end_date'] if o.get('event_end_date') and o.get('event_end_date') != o.get('event_start_date') else ''}")
        if (o.get("event_start_date") or o.get("event_end_date")) else "",
        "",
        esc((o.get("summary") or "")[:400]),
        "",
        f"💬 <i>Нотатка була: {esc((o.get('moderation_note') or '')[:200])}</i>",
    ]
    if o.get("source_url"):
        lines.append(f'🔗 <a href="{esc(o["source_url"])}">Джерело</a>')
    return "\n".join(l for l in lines if l is not None)


def main() -> int:
    from db import get_client
    client = get_client()

    rows = (client.table("opportunities").select("*")
            .eq("status", "draft").eq("note_status", "pending")
            .limit(10).execute().data or [])
    if not rows:
        logger.info("Нотаток немає — виходжу.")
        return 0

    llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
    done = 0

    for o in rows:
        current = {k: o.get(k) for k in EDITABLE}
        try:
            resp = llm.messages.create(
                model="claude-sonnet-5",
                max_tokens=1500,
                system=SYSTEM.format(today=datetime.now(timezone.utc).date().isoformat()),
                tools=[APPLY_TOOL],
                tool_choice={"type": "tool", "name": "apply_note"},
                messages=[{"role": "user", "content":
                    f"ПОТОЧНИЙ ЗАПИС:\n{json.dumps(current, ensure_ascii=False, indent=1)}\n\n"
                    f"НОТАТКА РЕДАКТОРА:\n{o['moderation_note']}\n\n"
                    "Поверни лише поля, які змінюються."}],
            )
            tool_use = next((b for b in resp.content if b.type == "tool_use"), None)
            patch = build_patch(tool_use.input if tool_use else {})
        except Exception as e:
            logger.error("LLM failed for %s: %s", o["id"], e)
            continue

        patch["note_status"] = "applied"
        # ISO-час, а не рядок "now()": PostgREST передає значення як є, і
        # рядок "now()" у timestamptz — не функція, а невалідна дата.
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            client.table("opportunities").update(patch).eq("id", o["id"]).execute()
        except Exception as e:
            logger.error("Update failed for %s: %s", o["id"], e)
            continue

        done += 1
        changed = [k for k in patch if k in EDITABLE]
        logger.info("Застосовано нотатку до «%s» — змінено: %s", o["title"], ", ".join(changed) or "нічого")

        merged = {**o, **patch}
        if ADMIN_CHAT_ID:
            tg("sendMessage", {
                "chat_id": ADMIN_CHAT_ID,
                "text": candidate_card(merged),
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
                "reply_markup": {"inline_keyboard": [
                    [{"text": "✅ Додати на сайт", "callback_data": f"mod:add:{o['id']}"},
                     {"text": "❌ Пропустити", "callback_data": f"mod:skip:{o['id']}"}],
                    [{"text": "⏭ Відкласти", "callback_data": f"mod:later:{o['id']}"},
                     {"text": "✏️ Редагувати", "url": f"{SITE_URL}/admin/edit/{o['id']}"}],
                    [{"text": "💬 Ще нотатка", "callback_data": f"mod:note:{o['id']}"}],
                ]},
            })

    logger.info("Готово: %d/%d", done, len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
