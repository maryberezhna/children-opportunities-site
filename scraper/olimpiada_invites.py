"""Запрошення до тесту онлайн-олімпіади — лист батькам після оплати.

Марія, 05.10.2026: «на вказаний імейл прийде запрошення до тесту» і «є 72
години до проходження». Сайт листів не шле (на Vercel немає поштових ключів),
тому запрошення надсилає цей скрипт із GitHub Actions — з пошти проєкту, а не
з особистої. Запис позначається `invite_sent_at`, тож двічі лист не піде.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  DITYAM_GMAIL_APP_PASSWORD — пароль застосунку пошти проєкту
  DITYAM_GMAIL_FROM         — адреса (типово hellodityam.com.ua@gmail.com)

  python olimpiada_invites.py            # надіслати всім, хто чекає
  python olimpiada_invites.py --dry-run  # лише показати, кому пішло б
  python olimpiada_invites.py --check    # лише перевірити вхід у пошту
"""
import argparse
import html
import logging
import os
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from zoneinfo import ZoneInfo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("olimpiada_invites")

SITE = "https://dityam.com.ua"
FROM = os.environ.get("DITYAM_GMAIL_FROM", "hellodityam.com.ua@gmail.com")
PASSWORD = os.environ.get("DITYAM_GMAIL_APP_PASSWORD", "")
KYIV = ZoneInfo("Europe/Kyiv")

# Ті самі числа, що в lib/olimpiada.js (OLIMP) — звіряє tests/test_olimpiada_invites.py.
QUESTIONS = 25
MINUTES = 35
ACCESS_HOURS = 72

MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня",
              "серпня", "вересня", "жовтня", "листопада", "грудня"]


def parse_ts(value):
    if not value:
        return None
    s = str(value).strip().replace(" ", "T").replace("Z", "+00:00")
    if s.endswith("+00"):
        s += ":00"
    try:
        ts = datetime.fromisoformat(s)
    except ValueError:
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def access_until(paid_at):
    return paid_at + timedelta(hours=ACCESS_HOURS)


def kyiv_text(ts) -> str:
    local = ts.astimezone(KYIV)
    return f"{local.day} {MONTHS_GEN[local.month - 1]}, {local:%H:%M}"


def needs_invite(entry: dict, now=None) -> bool:
    """Оплачено, лист ще не йшов, тест не пройдено й час на нього не минув."""
    now = now or datetime.now(timezone.utc)
    paid = parse_ts(entry.get("paid_at"))
    if not paid or entry.get("invite_sent_at") or entry.get("finished_at"):
        return False
    if "@" not in str(entry.get("parent_email") or ""):
        return False
    return now < access_until(paid)


def build_message(entry: dict):
    """(тема, текст, html) листа-запрошення."""
    name = str(entry.get("child_name") or "").strip() or "ваша дитина"
    link = f"{SITE}/olimpiada/test?t={entry['token']}"
    until = kyiv_text(access_until(parse_ts(entry["paid_at"])))
    subject = f"Запрошення до онлайн-олімпіади з логіки — {name}"
    points = [
        f"почати тест треба до {until} за київським часом — це {ACCESS_HOURS} години після оплати;",
        f"{QUESTIONS} завдань, {MINUTES} хвилин, 1 спроба; час піде після натискання «Почати»;",
        "диплом зʼявиться на тій самій сторінці одразу після тесту;",
        "останнє завдання — відкрите, без таймера: воно вирішує, хто отримає приз місяця.",
    ]
    text = "\n".join([
        "Добрий день!",
        "",
        f"Оплату отримали — {name} бере участь в онлайн-олімпіаді з логіки Dityam.com.ua.",
        f"Посилання на тест: {link}",
        "",
        "Що важливо:",
        *[f"• {p}" for p in points],
        "",
        "Після початку тесту або коли час на проходження минув, внесок не повертається.",
        "",
        "Марія Шутяк, Dityam.com.ua",
        FROM,
    ])
    esc = html.escape
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>Оплату отримали — <b>{esc(name)}</b> бере участь в онлайн-олімпіаді з логіки Dityam.com.ua.</p>
<p><a href="{esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Перейти до тесту</a></p>
<p>Що важливо:</p>
<ul>{''.join(f'<li>{esc(p)}</li>' for p in points)}</ul>
<p>Якщо кнопка не відкривається, скопіюйте посилання:<br><a href="{esc(link)}">{esc(link)}</a></p>
<p style="color:#6b6b6b;font-size:14px">Після початку тесту або коли час на проходження минув, внесок не повертається.</p>
<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a></p>
</div>"""
    return subject, text, body


def make_email(entry: dict) -> MIMEMultipart:
    subject, text, body = build_message(entry)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Dityam.com.ua", FROM))
    msg["To"] = entry["parent_email"]
    msg["Reply-To"] = FROM
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(body, "html", "utf-8"))
    return msg


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true", help="лише перевірити вхід у пошту")
    args = ap.parse_args()

    if args.check:
        if not PASSWORD:
            logger.error("DITYAM_GMAIL_APP_PASSWORD не задано")
            return 1
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(FROM, PASSWORD)
        logger.info("Вхід у пошту %s працює", FROM)
        return 0

    from db import get_client
    client = get_client()
    since = (datetime.now(timezone.utc) - timedelta(hours=ACCESS_HOURS)).isoformat()
    rows = (client.table("olimpiada_entries").select("*")
            .not_.is_("paid_at", "null").is_("invite_sent_at", "null")
            .gte("paid_at", since).execute().data or [])
    todo = [r for r in rows if needs_invite(r)]
    logger.info("Чекають на запрошення: %d", len(todo))
    if not todo:
        return 0
    if args.dry_run:
        for r in todo:
            logger.info("dry-run: %s → %s", r.get("child_name"), r.get("parent_email"))
        return 0
    if not PASSWORD:
        logger.error("DITYAM_GMAIL_APP_PASSWORD не задано — листи не надіслано")
        return 1

    failed = 0
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(FROM, PASSWORD)
        for r in todo:
            try:
                smtp.sendmail(FROM, [r["parent_email"]], make_email(r).as_string())
                client.table("olimpiada_entries").update(
                    {"invite_sent_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", r["id"]).execute()
                logger.info("Надіслано: %s", r.get("parent_email"))
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати: %s", r.get("parent_email"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
