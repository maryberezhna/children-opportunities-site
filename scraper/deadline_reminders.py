"""deadline_reminders.py — нагадування Dityam+ про дедлайни.

Люди втрачають можливості не тому, що не знали, а тому що відклали «на потім».
Це і є та частина обіцянки «ми нагадаємо», за яку платить підписник.

Щодня знаходить можливості, до подачі яких лишилось НЕ БІЛЬШЕ 7 і не більше
2 днів, звіряє з профілем підписника (вік × інтереси × вартість) і надсилає
коротке нагадування.

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
  --days 7,2  які вікна перевіряти (для тесту)
  --demo      синтетичні профілі замість реальних підписників: дає перевірити
              матчинг на живому каталозі, поки платних підписників ще немає
"""
import argparse
import html
import logging
import sys

from datetime import date, timedelta

from personal_digest import (
    SITE_URL,
    age_overlaps,
    match_themes,
    send_email,
    send_telegram,
)

logger = logging.getLogger("deadline_reminders")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# 7 днів — ще встигнути зібрати документи. 2 дні — останній дзвінок.
# Проміжних не робимо: більше нагадувань про одне й те саме читаються як спам.
DEFAULT_WINDOWS = (7, 2)
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
    head = (f"{urgency} <b>Останній дзвінок — подача закривається {when}</b>"
            if left <= 3 else
            f"{urgency} <b>Нагадуємо: подача закривається {when}</b>")
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
    ap.add_argument("--days", default=",".join(map(str, DEFAULT_WINDOWS)),
                    help="вікна нагадувань через кому, напр. 7,2")
    ap.add_argument("--demo", action="store_true",
                    help="синтетичні профілі — перевірка матчингу без підписників")
    args = ap.parse_args()
    windows = [int(x) for x in str(args.days).split(",") if x.strip().isdigit()]

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

    if not windows:
        logger.warning("Не задано жодного вікна — нічого робити")
        return 0
    windows = sorted(set(windows))          # від найтіснішого до найширшого

    today = date.today()
    widest = max(windows)
    opps = (client.table("opportunities")
            .select("id, title, slug, deadline, age_from, age_to, cost_type, summary")
            .eq("status", "active")
            .gte("deadline", today.isoformat())
            .lte("deadline", (today + timedelta(days=widest)).isoformat())
            .execute().data or [])
    for o in opps:
        o["_themes"] = match_themes(f"{o['title']} {o.get('summary') or ''}")
        o["_left"] = (date.fromisoformat(o["deadline"]) - today).days
    logger.info("Можливостей у межах %d днів: %d", widest, len(opps))
    if not opps:
        return 0

    sent = 0
    for sub in subs:
        # Найтісніше вікно виграє: можливість із одним днем у запасі підпадає
        # і під «2», і під «7» — без цього людина отримала б два повідомлення
        # про те саме за один ранок.
        assigned = set()
        for days in windows:
            batch = [o for o in opps
                     if o["id"] not in assigned
                     and o["_left"] <= days
                     and matches_profile(sub, o)]
            if not batch:
                continue
            batch.sort(key=lambda o: o["_left"])
            batch = batch[:MAX_ITEMS]
            assigned.update(o["id"] for o in batch)

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
