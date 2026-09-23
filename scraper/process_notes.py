"""process_notes.py — застосовує відкриті коментарі модератора до записів.

Один вхід для коментарів — таблиця moderation_notes. Туди пишуть обидві
кнопки: «💬 Залишити коментар» на картці в /admin і «💬 Нотатка» на картці
кандидата в адмін-боті.

23.09.2026: до цього дня механізмів було два, і вони не бачили один одного.
Бот клав текст у opportunities.moderation_note + note_status='pending', а
адмінка — в moderation_notes; цей скрипт читав лише перше. Обидва зробили
паралельні сесії в один день, кожна не знала про іншу — через це коментарі
Марії з адмінки висіли необробленими, хоч поруч щогодини працював скрипт,
який рівно це й уміє.

Що робить:

1. бере відкриті коментарі (action='comment', resolved_at is null), ще не
   пробувані, і групує їх за записом — на один запис їх може бути кілька;
2. просить Claude застосувати їх до полів запису, КОЖЕН окремо (лише білий
   список полів — slug/status/хеш LLM не чіпає);
3. зберігає зміни й закриває кожен застосований коментар: resolved_at = now()
   і resolution — одним реченням, що саме зроблено;
4. якщо застосувати нічого (коментар — питання до людини, а не вказівка),
   рядок лишається ВІДКРИТИМ, щоб його показало ранкове зведення; ставимо
   лише attempted_at, щоб не ганяти LLM щогодини по тому самому;
5. шле оновлену картку в адмін-чат — фінальне рішення завжди за людиною.

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

# Підписи полів для resolution: його читає людина в базі й у ранковому
# зведенні, тож «event_start_date» там не місце.
FIELD_LABELS = {
    "title": "назву", "summary": "опис", "details": "деталі",
    "opportunity_type": "тип", "age_from": "вік від", "age_to": "вік до",
    "cost_type": "вартість", "price_note": "примітку про ціну",
    "format": "формат", "cities": "міста", "deadline": "дедлайн",
    "child_needs": "потреби дитини", "event_start_date": "початок події",
    "event_end_date": "кінець події", "timing_kind": "вид за часом",
    "apply_url": "посилання на подачу",
}

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

Нотатка може бути не вказівкою, а ПИТАННЯМ чи сумнівом («чи це точно
безкоштовно?», «звідки вік?», «перевірити організатора»). Відповіді на них
немає в самому записі, вигадувати її не можна: тоді не міняй нічого — поверни
порожній результат, і коментар дочекається людини.

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

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_notes(rows: list[dict]) -> dict:
    """Відкриті коментарі, згруповані за записом. Чиста функція — під тести.

    Відкритий = action='comment' і resolved_at порожній: питання чи прохання,
    на яке ще ніхто не відповів. Рядки з іншою дією (approve / skip / verify /
    remove) — це причини вже ухвалених рішень, їх виконувати нема чого.

    attempted_at — слід попередньої спроби: такий коментар LLM уже читав і
    нічого не змінив, тож це питання до людини. Він лишається відкритим (його
    щоранку показує зведення), але другого разу токенів не з'їдає.
    """
    groups: dict = {}
    for row in sorted(rows or [], key=lambda r: str(r.get("created_at") or "")):
        if (row.get("action") or "comment") != "comment":
            continue
        if row.get("resolved_at") or row.get("attempted_at"):
            continue
        body = (row.get("body") or "").strip()
        if not body or not row.get("opportunity_id"):
            continue
        groups.setdefault(str(row["opportunity_id"]), []).append({**row, "body": body})
    return groups


def resolution_text(patch: dict) -> str:
    """Одне речення, що саме зроблено. Порядок полів сталий — не як у моделі."""
    changed = [FIELD_LABELS.get(k, k) for k in EDITABLE if k in patch]
    if not changed:
        return ""
    return "Застосовано автоматично: змінено " + ", ".join(changed) + "."


def close_patch(patch: dict, now: str | None = None) -> dict | None:
    """Чим закривати рядок коментаря. Чиста функція — під тести.

    None означає «не закривати»: модель не змінила нічого, отже коментар —
    питання, яке має прочитати людина. Мовчки поставити resolved_at тут було б
    гірше за нинішню біду: коментар зник би і зі зведення, і з картки.
    """
    text = resolution_text(patch or {})
    if not text:
        return None
    return {"resolved_at": now or now_iso(), "resolution": text}


def legacy_inserts(rows: list[dict], existing: set) -> list[dict]:
    """Старі нотатки з opportunities.moderation_note → рядки moderation_notes.

    existing — пари (opportunity_id, body), які в таблиці вже є. Перенесення
    має бути безпечним при КОЖНОМУ запуску: міграцію до бази міг ще ніхто не
    застосувати, а дубль коментаря — це дубль питання до людини.
    """
    seen = set(existing or ())
    out = []
    for row in rows or []:
        body = (row.get("moderation_note") or "").strip()[:2000]
        if not body or not row.get("id"):
            continue
        key = (str(row["id"]), body)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "opportunity_id": row["id"],
            "body": body,
            "action": "comment",
            "created_at": row.get("updated_at") or now_iso(),
        })
    return out


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


def candidate_card(o: dict, note_text: str = "") -> str:
    esc = lambda v: str(v).translate(TG_ESC)
    live = o.get("status") != "draft"
    meta = []
    if o.get("age_from") is not None and o.get("age_to") is not None:
        meta.append(f"👶 {o['age_from']}–{o['age_to']} р.")
    if o.get("cost_type") == "free":
        meta.append("✅ безкоштовно")
    if o.get("format"):
        meta.append(esc(o["format"]))
    lines = [
        # Запис уже на сайті — про це кажемо першим рядком: зміна там видима
        # людям одразу, а не після апруву.
        "✍️ <b>Коментар застосовано до запису НА САЙТІ — перевірте</b>" if live
        else "✍️ <b>Коментар застосовано — перевірте</b>",
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
        f"💬 <i>Коментар був: {esc((note_text or '')[:300])}</i>",
    ]
    if o.get("source_url"):
        lines.append(f'🔗 <a href="{esc(o["source_url"])}">Джерело</a>')
    return "\n".join(l for l in lines if l is not None)


def ask_llm(llm, record: dict, body: str) -> dict:
    """Що модель пропонує змінити в записі за ОДНИМ коментарем.

    По одному, а не всі коментарі запису разом: у кожного свій resolution, і
    прохання «вік 6–12» поруч із питанням «чи справді безкоштовно?» не закриє
    це питання заразом.
    """
    current = {k: record.get(k) for k in EDITABLE}
    resp = llm.messages.create(
        model="claude-sonnet-5",
        max_tokens=1500,
        system=SYSTEM.format(today=datetime.now(timezone.utc).date().isoformat()),
        tools=[APPLY_TOOL],
        tool_choice={"type": "tool", "name": "apply_note"},
        messages=[{"role": "user", "content":
            f"ПОТОЧНИЙ ЗАПИС:\n{json.dumps(current, ensure_ascii=False, indent=1)}\n\n"
            f"КОМЕНТАР РЕДАКТОРА:\n{body}\n\n"
            "Поверни лише поля, які змінюються."}],
    )
    tool_use = next((b for b in resp.content if b.type == "tool_use"), None)
    return build_patch(tool_use.input if tool_use else {})


def keyboard(o: dict) -> dict:
    """Кнопки під карткою. Чернетка чекає на апрув; запис, що вже на сайті,
    кнопок «додати / пропустити» не має — вони міняли б йому статус."""
    oid = o["id"]
    edit = {"text": "✏️ Редагувати", "url": f"{SITE_URL}/admin/edit/{oid}"}
    more = {"text": "💬 Ще коментар", "callback_data": f"mod:note:{oid}"}
    if o.get("status") != "draft":
        return {"inline_keyboard": [[edit], [more]]}
    return {"inline_keyboard": [
        [{"text": "✅ Додати на сайт", "callback_data": f"mod:add:{oid}"},
         {"text": "❌ Пропустити", "callback_data": f"mod:skip:{oid}"}],
        [{"text": "⏭ Відкласти", "callback_data": f"mod:later:{oid}"}, edit],
        [more],
    ]}


def adopt_legacy(client) -> int:
    """Перенести нотатки зі старого механізму в moderation_notes.

    23.09.2026: бот писав їх у opportunities.moderation_note з
    note_status='pending', а адмінка — в таблицю. Міст лишається постійно й
    безпечний при кожному запуску: міграцію до бази могли ще не застосувати,
    а нотатка, написана до деплою, не сміє загубитись.

    Беремо ЛИШЕ note_status='pending' — це слід людини. Те саме поле пишуть
    audit_seed.py і audit_clubs.py, пояснюючи, чому сховали запис; вони
    свідомо лишають note_status порожнім, і вказівкою редактора це не є.
    """
    try:
        rows = (client.table("opportunities")
                .select("id, moderation_note, updated_at")
                .eq("note_status", "pending")
                .not_.is_("moderation_note", "null")
                .limit(200).execute().data or [])
    except Exception as e:
        logger.error("Старі нотатки прочитати не вдалося: %s", e)
        return 0
    if not rows:
        return 0

    ids = [r["id"] for r in rows]
    existing = set()
    try:
        have = (client.table("moderation_notes").select("opportunity_id, body")
                .in_("opportunity_id", ids).execute().data or [])
        existing = {(str(h["opportunity_id"]), h.get("body") or "") for h in have}
    except Exception as e:
        # Без цієї вибірки перенесення могло б задвоїти коментар — краще
        # пропустити цей запуск, ніж поставити людині те саме питання двічі.
        logger.error("Наявні коментарі прочитати не вдалося: %s", e)
        return 0

    inserts = legacy_inserts(rows, existing)
    try:
        if inserts:
            client.table("moderation_notes").insert(inserts).execute()
        client.table("opportunities").update({"note_status": "migrated"}).in_("id", ids).execute()
    except Exception as e:
        logger.error("Перенесення старих нотаток не вдалося: %s", e)
        return 0
    logger.info("Перенесено старих нотаток: %d (записів позначено: %d)", len(inserts), len(ids))
    return len(inserts)


def main() -> int:
    from db import get_client
    client = get_client()

    adopt_legacy(client)

    # select('*') навмисне: attempted_at додає міграція 20260923, і поки її не
    # застосували, перелік колонок поіменно повертав би помилку. Зайве
    # відсіюємо в Python.
    try:
        rows = (client.table("moderation_notes").select("*")
                .eq("action", "comment").is_("resolved_at", "null")
                .order("created_at").limit(400).execute().data or [])
    except Exception as e:
        logger.error("Коментарі прочитати не вдалося: %s", e)
        return 1
    groups = open_notes(rows)
    if not groups:
        logger.info("Відкритих коментарів немає — виходжу.")
        return 0
    has_attempted = any("attempted_at" in r for r in rows)
    if not has_attempted:
        logger.warning("Колонки attempted_at ще немає — міграцію 20260923 не застосовано; "
                       "коментар, який не вдасться застосувати, спробується знову наступної години.")

    ids = list(groups)[:10]
    try:
        opps = (client.table("opportunities").select("*").in_("id", ids).execute().data or [])
    except Exception as e:
        logger.error("Записи прочитати не вдалося: %s", e)
        return 1
    by_id = {str(o["id"]): o for o in opps}

    llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
    done = 0

    for oid in ids:
        o = by_id.get(oid)
        if not o:
            logger.warning("Коментар на запис %s, якого вже немає — пропускаю.", oid)
            continue

        record = dict(o)
        applied = []
        for note in groups[oid][:5]:
            try:
                patch = ask_llm(llm, record, note["body"])
            except Exception as e:
                logger.error("LLM failed for %s: %s", oid, e)
                continue

            closing = close_patch(patch)
            if not closing:
                # Питання, а не вказівка: лишаємо відкритим для людини, лише
                # позначаємо спробу, щоб не читати його LLM щогодини наново.
                logger.info("Коментар до «%s» сам не застосовується — лишаю людині: %s",
                            o.get("title"), note["body"][:80])
                if has_attempted:
                    try:
                        (client.table("moderation_notes").update({"attempted_at": now_iso()})
                         .eq("id", note["id"]).execute())
                    except Exception as e:
                        logger.error("Позначити спробу не вдалося для %s: %s", note["id"], e)
                continue

            # ISO-час, а не рядок "now()": PostgREST передає значення як є, і
            # рядок "now()" у timestamptz — не функція, а невалідна дата.
            patch["updated_at"] = now_iso()
            try:
                client.table("opportunities").update(patch).eq("id", oid).execute()
            except Exception as e:
                logger.error("Update failed for %s: %s", oid, e)
                continue
            record.update(patch)

            # Запис уже змінено — коментар закриваємо окремим запитом. Якщо він
            # не пройде, коментар лишиться відкритим: побачити зміну двічі краще,
            # ніж вважати обробленим те, що загубилось.
            try:
                (client.table("moderation_notes").update(closing)
                 .eq("id", note["id"]).execute())
            except Exception as e:
                logger.error("Закрити коментар не вдалося для %s: %s", note["id"], e)

            done += 1
            applied.append(note["body"])
            logger.info("Коментар до «%s»: %s", o.get("title"), closing["resolution"])

        if applied and ADMIN_CHAT_ID:
            tg("sendMessage", {
                "chat_id": ADMIN_CHAT_ID,
                "text": candidate_card(record, "\n".join(f"— {b}" for b in applied)),
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
                "reply_markup": keyboard(record),
            })

    logger.info("Готово: застосовано коментарів %d, записів у роботі %d", done, len(ids))
    return 0


if __name__ == "__main__":
    sys.exit(main())
