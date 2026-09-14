"""deadline_reminders.py — нагадування Dityam+ про дедлайни.

Люди втрачають можливості не тому, що не знали, а тому що відклали «на потім».
Це і є та частина обіцянки «ми нагадаємо», за яку платить підписник.

Щодня знаходить можливості, до дедлайну яких лишилось стільки, скільки
потрібно на заявку саме цього типу (див. WINDOWS_BY_TYPE: від 4 тижнів для
стипендій до тижня для гуртків), звіряє з профілем підписника
(вік × інтереси × вартість) і надсилає коротке нагадування.

Вікна саме діапазони, а не точний день: у каталозі буває 5-6 дедлайнів на два
тижні, і на «рівно сьомий день» не потрапляє майже ніщо. Можливість, додана з
5 днями в запасі, має отримати нагадування одразу, а не ніколи.

Логіка збігу профілю спільна з personal_digest — імпортуємо звідти, щоб дві
копії не розійшлись.

Захист від повторів: пара (підписник × можливість × вікно) пишеться в
digest_reminders_sent ПЕРЕД відправкою. UNIQUE ловить повторний запуск крона,
тож двічі те саме не прийде.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN,
     GMAIL_FROM, GMAIL_APP_PASSWORD, SITE_URL (опційно).

Прапорці:
  --dry-run   лише друкує, кому що пішло б; нічого не шле й не пише в журнал
  --days 7,2  однакові вікна для всіх типів (для тесту); без прапорця — за типом
  --demo      синтетичні профілі замість реальних підписників: дає перевірити
              матчинг на живому каталозі, поки платних підписників ще немає
  --any-time  ігнорувати ворота часу (див. send_window.py): слати негайно,
              о котрій би не запустили

Про годину відправки. Розклад cron у GitHub Actions для цього репозиторію
запізнюється на 4-5 годин щодня — заміряно 11.09.2026, подробиці й цифри в
send_window.py. Тому воркфлоу просить кілька ранкових запусків, а ворота
відсікають ті з них, що прийшли до 9:00 за Києвом. Дубля від зайвого запуску
не буде: пара (підписник × можливість × вікно) захищена UNIQUE.
"""
import argparse
import html
import logging
import sys

from datetime import date, timedelta

import send_window
from personal_digest import (
    SITE_URL,
    age_overlaps,
    match_themes,
    send_email,
    send_telegram,
)

logger = logging.getLogger("deadline_reminders")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Скільки заздалегідь нагадувати, залежить від того, скільки часу забирає сама
# заявка. Раніше для всіх було 7 і 2 дні — для стипендії чи обміну з есе,
# рекомендаціями й документами тиждень означає «вже пізно».
#
# Аналіз активних записів 14.09.2026, медіана днів від появи запису до
# дедлайну: стипендії 184, обміни 266, конкурси 191, олімпіади 141, стажування
# 173 — це відбори, до яких готуються місяцями. Курси 19, гуртки 25, воркшопи
# 14 — там подача є формою на хвилину. Гранти — виняток: медіана лише 20 днів,
# але заявка найважча, тож вони в першій групі, і нагадування про них піде
# одразу, щойно запис зʼявиться.
#
# Останній дзвінок у кожній групі лишається. Більше трьох нагадувань про одне
# й те саме читаються як спам.
LONG_WINDOWS = (28, 14, 3)     # стипендії, гранти, обміни, стажування, навчальні програми
MEDIUM_WINDOWS = (14, 3)       # конкурси, олімпіади, хакатони, табори, фестивалі, конференції
SHORT_WINDOWS = (7, 2)         # курси, гуртки, воркшопи й усе інше

WINDOWS_BY_TYPE = {
    "scholarship": LONG_WINDOWS,
    "grant": LONG_WINDOWS,
    "exchange": LONG_WINDOWS,
    "internship": LONG_WINDOWS,
    "study_program": LONG_WINDOWS,
    "summer_school": LONG_WINDOWS,
    "residency": LONG_WINDOWS,
    "competition": MEDIUM_WINDOWS,
    "olympiad": MEDIUM_WINDOWS,
    "hackathon": MEDIUM_WINDOWS,
    "camp": MEDIUM_WINDOWS,
    "festival": MEDIUM_WINDOWS,
    "conference": MEDIUM_WINDOWS,
}
DEFAULT_WINDOWS = SHORT_WINDOWS


def windows_for(opportunity_type) -> tuple:
    """Вікна нагадувань для типу програми. Невідомий тип — короткі вікна."""
    return WINDOWS_BY_TYPE.get(opportunity_type or "", DEFAULT_WINDOWS)


def tightest_window(left: int, windows) -> int | None:
    """Найтісніше вікно, у яке потрапляє залишок днів, або None.

    Можливість з одним днем у запасі підпадає і під «3», і під «14» — без
    вибору найтіснішого людина отримала б два повідомлення за один ранок."""
    fitting = [w for w in windows if left <= w]
    return min(fitting) if fitting else None
MAX_ITEMS = 5

MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня",
              "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]


def days_word(n: int) -> str:
    """1 день · 2-4 дні · 5+ днів, з винятком 11-14 (завжди «днів»)."""
    if 11 <= n % 100 <= 14:
        return "днів"
    last = n % 10
    if last == 1:
        return "день"
    if 2 <= last <= 4:
        return "дні"
    return "днів"


def human_date(iso: str) -> str:
    """«2026-08-19» → «19 серпня». Сира ISO-дата в повідомленні для батьків
    читається як помилка, а не як дедлайн."""
    try:
        d = date.fromisoformat(str(iso))
    except (TypeError, ValueError):
        return str(iso)
    return f"{d.day} {MONTHS_GEN[d.month - 1]}"


def matches_profile(sub: dict, o: dict) -> bool:
    if sub.get("cost_pref") == "free_only" and o.get("cost_type") != "free":
        return False
    if not age_overlaps(o["age_from"], o["age_to"], sub.get("age_bands") or []):
        return False
    interests = set(sub.get("interests") or [])
    if interests and not (interests & o["_themes"]):
        return False
    return True


def build_text(items: list, days: int) -> str:
    # Орієнтуємось на РЕАЛЬНИЙ залишок у найтерміновішої, а не на номер вікна:
    # інакше запис із двома днями в «тижневому» вікні отримав би спокійний тон.
    left = min((o.get("_left", days) for o in items), default=days)
    if left <= 0:
        when, urgency = "сьогодні", "🔔"
    elif left == 1:
        when, urgency = "завтра", "🔔"
    else:
        when = f"через {left} {days_word(left)}"
        urgency = "🔔" if left <= 3 else "⏳"
    if left <= 3:
        head = f"{urgency} <b>Останній дзвінок — подача закривається {when}</b>"
    elif left > 7:
        head = (f"{urgency} <b>Нагадуємо заздалегідь: подача закривається {when}</b>"
                "\nСаме час готувати документи.")
    else:
        head = f"{urgency} <b>Нагадуємо: подача закривається {when}</b>"
    lines = [head, ""]
    for o in items:
        url = f"{SITE_URL}/o/{o['slug']}"
        lines.append(f"🔸 <a href=\"{html.escape(url)}\"><b>{html.escape(o['title'])}</b></a>")
        lines.append(f"подача до {human_date(o['deadline'])}")
        lines.append("")
    lines.append("<i>Підібрано під профіль вашої дитини.</i>")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--days", default="",
                    help="однакові вікна для всіх типів через кому, напр. 7,2 "
                         "(для тесту); без прапорця — вікна за типом програми")
    ap.add_argument("--demo", action="store_true",
                    help="синтетичні профілі — перевірка матчингу без підписників")
    ap.add_argument("--any-time", action="store_true",
                    help="не зважати на ворота часу (ручний запуск, тест)")
    args = ap.parse_args()

    # Ворота часу — до будь-яких запитів у базу. dry-run і demo нічого не
    # шлють, тож їх не блокуємо.
    if not (args.dry_run or args.demo or args.any_time) and send_window.too_early():
        return 0

    override = [int(x) for x in str(args.days).split(",") if x.strip().isdigit()]

    from db import get_client
    client = get_client()

    if args.demo:
        # Три типові профілі — щоб побачити, що кому дісталось би.
        args.dry_run = True
        subs = [
            {"id": "demo-teen", "channel": "telegram", "telegram_chat_id": None,
             "age_bands": ["15-18"], "interests": ["international", "contests"],
             "cost_pref": "any"},
            {"id": "demo-junior", "channel": "telegram", "telegram_chat_id": None,
             "age_bands": ["7-10"], "interests": ["arts", "stem"], "cost_pref": "any"},
            {"id": "demo-any", "channel": "telegram", "telegram_chat_id": None,
             "age_bands": [], "interests": [], "cost_pref": "any"},
        ]
        logger.info("DEMO: %d синтетичних профілів", len(subs))
    else:
        subs = (client.table("digest_subscribers").select("*")
                .eq("status", "active").execute().data or [])
        logger.info("Активних підписників: %d", len(subs))
    if not subs:
        return 0

    today = date.today()
    widest = max(override) if override else max(
        max(w) for w in (*WINDOWS_BY_TYPE.values(), DEFAULT_WINDOWS))
    opps = (client.table("opportunities")
            .select("id, title, slug, deadline, age_from, age_to, cost_type, summary, opportunity_type")
            .eq("status", "active")
            .gte("deadline", today.isoformat())
            .lte("deadline", (today + timedelta(days=widest)).isoformat())
            .execute().data or [])
    for o in opps:
        o["_themes"] = match_themes(f"{o['title']} {o.get('summary') or ''}")
        o["_left"] = (date.fromisoformat(o["deadline"]) - today).days
        # Одне вікно на запис на цей запуск — найтісніше з вікон його типу.
        o["_window"] = tightest_window(
            o["_left"], override or windows_for(o.get("opportunity_type")))
    opps = [o for o in opps if o["_window"] is not None]
    logger.info("Можливостей у вікнах нагадувань: %d (найширше вікно %d дн.)", len(opps), widest)
    if not opps:
        return 0

    sent = 0
    for sub in subs:
        # Кожен запис уже знає своє вікно (найтісніше для його типу), тож
        # групуємо за ним: одне повідомлення на вікно, від найтерміновішого.
        for days in sorted({o["_window"] for o in opps}):
            batch = [o for o in opps
                     if o["_window"] == days
                     and matches_profile(sub, o)]
            if not batch:
                continue
            batch.sort(key=lambda o: o["_left"])
            batch = batch[:MAX_ITEMS]

            if args.dry_run:
                logger.info("[dry] sub=%s вікно=%dд → %d шт", sub["id"], days, len(batch))
                for line in build_text(batch, days).split("\n"):
                    logger.info("      %s", line)
                continue

            # Пишемо в журнал ПЕРЕД відправкою: якщо крон запуститься двічі,
            # другий раз впаде на UNIQUE і повтору не буде.
            fresh = []
            for o in batch:
                try:
                    client.table("digest_reminders_sent").insert({
                        "subscriber_id": sub["id"],
                        "opportunity_id": o["id"],
                        "days_before": days,
                    }).execute()
                    fresh.append(o)
                except Exception:
                    pass          # вже нагадували — тихо пропускаємо
            if not fresh:
                continue

            text = build_text(fresh, days)
            ok = False
            if sub["channel"] == "telegram" and sub.get("telegram_chat_id"):
                ok = send_telegram(sub["telegram_chat_id"], text)
            elif sub["channel"] == "email" and sub.get("email"):
                ok = send_email(sub["email"], text.replace("\n", "<br>"))
            if ok:
                sent += 1
                logger.info("sub %s — нагадування -%dд про %d можливостей",
                            sub["id"], days, len(fresh))
            else:
                # Відправка не вдалась — знімаємо позначки, щоб завтра спробувати ще
                for o in fresh:
                    client.table("digest_reminders_sent").delete() \
                        .eq("subscriber_id", sub["id"]) \
                        .eq("opportunity_id", o["id"]) \
                        .eq("days_before", days).execute()

    logger.info("Готово. Надіслано нагадувань: %d", sent)
    return 0


if __name__ == "__main__":
    sys.exit(main())
