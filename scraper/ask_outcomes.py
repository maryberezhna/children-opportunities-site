"""ask_outcomes.py — Dityam+: «чим закінчилось» для можливості, що минула.

Марія 23.09.2026: «відмічають цікаво — коли можливість пройшла, то зʼявляється
питання: ви скористалися цією можливістю? Так чи ні. Якщо так — то розкажіть,
як вам. Якщо ні — то чому, і дропдаун з опціями».

Памʼять Dityam+ досі обривалась на вході: 👍 під карткою і «✍️ Подаємося»
лягали в базу, а що з того вийшло — не знав ніхто. Цей скрипт замикає коло:
через три дні після того, як можливість минула, @DityamPlusBot питає, і
відповідь лягає в plus_applications (кнопки обробляє /api/telegram/plus).

Правила відбору (рішення Марії того ж дня):
  • питаємо через ASK_AFTER_DAYS = 3 дні після найпізнішої наявної дати —
    deadline, event_end_date/event_start_date або results_date;
  • постійні й безстрокові не питаємо НІКОЛИ: timing_kind='permanent' або
    recurrence='ongoing' без жодної дати. Там нічого не «минуло»;
  • кого: активні підписники, які по цій можливості натиснули 👍
    (opportunity_feedback.value='yes') або «✍️ Подаємося»
    (plus_applications.stage='applying');
  • не більше ОДНОГО питання на людину на день;
  • про одну можливість питаємо рівно один раз (asked_at). Якщо за тиждень
    минуло кілька — питаємо про найсвіжішу, решту глушимо позначкою asked_at,
    щоб не смикати людину заднім числом.

Проміжного кроку «Тримаємо кулаки 🤞 Уже є відповідь?» тут немає свідомо:
Марія відхилила його 23.09.2026.

Ключі різні, і це легко переплутати: opportunity_feedback тримає
telegram_user_id (bigint, id користувача Telegram), plus_applications —
subscriber_id (uuid). Звʼязок один: digest_subscribers.telegram_chat_id — у
приватному чаті він дорівнює id користувача.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN
     (TELEGRAM_BOT_TOKEN — запасний, див. send_telegram у personal_digest).

Прапорці:
  --dry-run   нічого не шле й не пише asked_at — лише друкує, кому що пішло б
  --any-time  ігнорувати ворота часу (див. send_window.py)
"""
from __future__ import annotations

import argparse
import html
import logging
import sys
from datetime import date, datetime, timedelta, timezone

import send_window
from personal_digest import MONTHS_GEN, send_telegram

logger = logging.getLogger("ask_outcomes")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Три дні — щоб питання не прилетіло людині в день дедлайну, коли вона ще
# збирає документи або чекає на лист від організатора.
ASK_AFTER_DAYS = 3

# Одне питання на людину на добу. Крон запускається раз на день, але
# workflow_dispatch і повільний GitHub можуть дати два запуски поспіль.
ONE_PER_HOURS = 24

# Що саме минуло. Ранг потрібен лише для збігу дат: якщо результати
# оголошують у день події, говоримо про результати — це пізніша точка в житті
# можливості (див. dityam-event-vs-deadline: deadline ≠ дата події ≠ розіграш).
DATE_FIELDS = (
    ("results_date", "results", 3),
    ("event_end_date", "event", 2),
    ("event_start_date", "event", 2),
    ("deadline", "deadline", 1),
)

WHEN_PHRASE = {
    "deadline": "подача закрилась",
    "event": "подія пройшла",
    "results": "результати оголосили",
}


def _day(value) -> date | None:
    try:
        return date.fromisoformat(str(value or "")[:10])
    except ValueError:
        return None


def human_date(day: date, today: date | None = None) -> str:
    """«2026-09-20» → «20 вересня». Рік дописуємо, лише якщо він не поточний:
    сира ISO-дата в повідомленні для батьків читається як помилка."""
    today = today or date.today()
    year = f" {day.year}" if day.year != today.year else ""
    return f"{day.day} {MONTHS_GEN[day.month - 1]}{year}"


def last_date(o: dict) -> tuple[date, str] | None:
    """Найпізніша наявна дата можливості й що це за дата, або None."""
    found = [(d, kind, rank) for field, kind, rank in DATE_FIELDS
             if (d := _day(o.get(field))) is not None]
    if not found:
        return None
    day, kind, _ = max(found, key=lambda x: (x[0], x[2]))
    return day, kind


def is_open_ended(o: dict) -> bool:
    """Постійна або безстрокова можливість — питати нема про що.

    «Державна підтримка», гурток із постійним набором, Prometheus: у них
    нічого не закривається, і питання «ви скористалися?» звучало б як докір."""
    if o.get("timing_kind") == "permanent":
        return True
    return o.get("recurrence") == "ongoing" and last_date(o) is None


def past_by(o: dict, today: date, ask_after_days: int = ASK_AFTER_DAYS):
    """(дата, вид), якщо можливість минула щонайменше ask_after_days тому."""
    if is_open_ended(o):
        return None
    found = last_date(o)
    if not found:
        return None
    day, kind = found
    if (today - day).days < ask_after_days:
        return None
    return day, kind


def due_map(opps: list, today: date, ask_after_days: int = ASK_AFTER_DAYS) -> dict:
    """{opportunity_id: (дата, вид)} — про що взагалі можна питати сьогодні."""
    out = {}
    for o in opps:
        past = past_by(o, today, ask_after_days)
        if past:
            out[o["id"]] = past
    return out


def parse_ts(value):
    if not value:
        return None
    text = str(value).strip().replace(" ", "T")
    if text.endswith("+00"):
        text = text[:-3] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def asked_recently(rows: list, now: datetime, hours: int = ONE_PER_HOURS) -> bool:
    """Чи питали цю людину про щось за останні `hours` годин."""
    edge = now - timedelta(hours=hours)
    return any((ts := parse_ts(r.get("asked_at"))) and ts >= edge for r in rows)


def pick_for_subscriber(marked: set, rows: list, due: dict, now: datetime):
    """Про що спитати цю людину й що позначити пропущеним.

    Повертає (ask, skip): ask — (opportunity_id, (дата, вид)) або None,
    skip — список opportunity_id, яким ставимо asked_at без повідомлення.

    Чому решту глушимо. Якщо за тиждень минуло три позначені можливості,
    питання про найстарішу прилетить із запізненням і читатиметься як докір.
    Марія 23.09.2026: беремо найсвіжішу, решту не питаємо зовсім.
    """
    if asked_recently(rows, now):
        return None, []
    asked = {r["opportunity_id"] for r in rows if r.get("asked_at")}
    cands = [(oid, due[oid]) for oid in marked if oid in due and oid not in asked]
    if not cands:
        return None, []
    cands.sort(key=lambda c: c[1][0], reverse=True)
    return cands[0], [oid for oid, _ in cands[1:]]


def build_question(title: str, day: date, kind: str, today: date | None = None) -> str:
    return (f"<b>{html.escape(title or '')}</b> — {WHEN_PHRASE[kind]} "
            f"{human_date(day, today)}.\n\nВи скористалися цією можливістю?")


def keyboard(opportunity_id: str) -> dict:
    """«Так» / «Ні». callback_data розбирає parseOutcome у lib/plusOutcomes.js;
    pout:yes:<uuid> — 45 байтів, ліміт Telegram 64."""
    return {"inline_keyboard": [[
        {"text": "Так", "callback_data": f"pout:yes:{opportunity_id}"},
        {"text": "Ні", "callback_data": f"pout:no:{opportunity_id}"},
    ]]}


# --- Читання бази -----------------------------------------------------------

def load_rows(client, subs: list) -> dict:
    """{subscriber_id: [рядки plus_applications]}.

    select('*') навмисне: колонок asked_at / answered_at / reason / note може
    ще не бути, якщо міграцію 20260923_plus_outcomes.sql не застосували —
    перелік полів у запиті впав би, а '*' віддає те, що є."""
    ids = [s["id"] for s in subs if s.get("id")]
    if not ids:
        return {}
    rows = (client.table("plus_applications").select("*")
            .in_("subscriber_id", ids).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["subscriber_id"]), []).append(r)
    return out


def load_liked(client, subs: list) -> dict:
    """{telegram_chat_id: {opportunity_id}} — що позначили 👍 під карткою.

    Дзеркало load_disliked із personal_digest, тільки value='yes'."""
    chats = sorted({str(s["telegram_chat_id"]) for s in subs if s.get("telegram_chat_id")})
    if not chats:
        return {}
    rows = (client.table("opportunity_feedback").select("opportunity_id, telegram_user_id")
            .eq("value", "yes").in_("telegram_user_id", chats).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["telegram_user_id"]), set()).add(r["opportunity_id"])
    return out


def marked_by(sub: dict, rows: list, liked: dict) -> set:
    """Що ця людина позначила: 👍 або «✍️ Подаємося»."""
    mine = {r["opportunity_id"] for r in rows if r.get("stage") == "applying"}
    return mine | liked.get(str(sub.get("telegram_chat_id")), set())


def mark_asked(client, sub_id: str, opportunity_id: str, exists: bool) -> None:
    """asked_at = зараз. Рядок створюємо, якщо його ще немає — це випадок 👍
    без «Подаємося».

    stage='asked', а не 'applying': 👍 означає «цікаво», і записати людині
    «подаємося» означало б вигадати за неї (правило «нічого не вигадувати»)."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        if exists:
            (client.table("plus_applications").update({"asked_at": now, "updated_at": now})
             .eq("subscriber_id", sub_id).eq("opportunity_id", opportunity_id).execute())
        else:
            client.table("plus_applications").insert({
                "subscriber_id": sub_id, "opportunity_id": opportunity_id,
                "stage": "asked", "asked_at": now, "updated_at": now,
            }).execute()
    except Exception as e:
        # Міграції ще немає або база недоступна — не валимо весь прогін.
        logger.warning("mark_asked %s/%s failed: %s", sub_id, opportunity_id, e)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--any-time", action="store_true",
                    help="не зважати на ворота часу (ручний запуск, тест)")
    args = ap.parse_args()

    if not (args.dry_run or args.any_time) and send_window.too_early():
        return 0

    from db import get_client
    client = get_client()

    subs = (client.table("digest_subscribers")
            .select("id, telegram_chat_id, telegram_handle, status")
            .eq("status", "active").execute().data or [])
    subs = [s for s in subs if s.get("telegram_chat_id")]
    logger.info("Активних підписників із Telegram: %d", len(subs))
    if not subs:
        return 0

    rows_by_sub = load_rows(client, subs)
    liked = load_liked(client, subs)

    # Можливості беремо лише ті, які хтось позначив: це десятки записів, а не
    # вся база. Статус не фільтруємо — те, що минуло, вже закрите
    # scripts/check-deadlines.mjs, і саме про нього ми й питаємо.
    wanted = set()
    for sub in subs:
        wanted |= marked_by(sub, rows_by_sub.get(str(sub["id"]), []), liked)
    if not wanted:
        logger.info("Ніхто нічого не позначав — питати нема про що")
        return 0

    opps = []
    ids = sorted(wanted)
    for start in range(0, len(ids), 200):
        opps.extend(client.table("opportunities")
                    .select("id, title, slug, deadline, event_start_date, event_end_date, "
                            "results_date, timing_kind, recurrence")
                    .in_("id", ids[start:start + 200]).execute().data or [])
    by_id = {o["id"]: o for o in opps}

    today = date.today()
    now = datetime.now(timezone.utc)
    due = due_map(opps, today)
    logger.info("Позначених можливостей: %d, з них минуло ≥%d дн.: %d",
                len(wanted), ASK_AFTER_DAYS, len(due))

    asked = 0
    for sub in subs:
        rows = rows_by_sub.get(str(sub["id"]), [])
        marked = marked_by(sub, rows, liked)
        ask, skip = pick_for_subscriber(marked, rows, due, now)
        if not ask:
            continue
        opp_id, (day, kind) = ask
        opp = by_id.get(opp_id) or {}
        text = build_question(opp.get("title"), day, kind, today)
        have = {r["opportunity_id"] for r in rows}

        if args.dry_run:
            logger.info("[dry] sub=%s → %s (%s %s), глушимо %d",
                        sub["id"], opp.get("title"), kind, day, len(skip))
            continue

        if not send_telegram(sub["telegram_chat_id"], text, reply_markup=keyboard(opp_id)):
            continue
        mark_asked(client, sub["id"], opp_id, opp_id in have)
        for other in skip:
            mark_asked(client, sub["id"], other, other in have)
        asked += 1

    logger.info("Done. Питань надіслано: %d", asked)
    return 0


if __name__ == "__main__":
    sys.exit(main())
