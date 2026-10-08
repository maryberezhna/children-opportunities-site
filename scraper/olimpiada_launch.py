"""Лист «ми стартували» всім зі списку очікування онлайн-олімпіади.

До старту сторінка /olimpiada збирає email (таблиця olimpiada_waitlist):
«Повідомити про старт» — і на сайті, і в попапі на фільтрі каталогу. Кожному
обіцяно лист, щойно відкриємо реєстрацію. Його й надсилає цей скрипт — лише
вручну, з воркфлоу «Олімпіада — лист про старт», і лише коли продаж на сайті
справді відкритий (OLIMP_OPEN = true): інакше людина перейде за посиланням і
побачить ту саму форму очікування.

Кожен запис позначається notified_at — двічі лист не піде, і перезапуск
продовжить з того місця, де зупинився (Gmail дає ~500 листів на добу).

Env:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  DITYAM_GMAIL_APP_PASSWORD, DITYAM_GMAIL_FROM

  python olimpiada_launch.py --dry-run   # кому пішло б і перевірка сайту
  python olimpiada_launch.py --send      # надіслати (до LIMIT за запуск)
"""
import argparse
import html
import logging
import os
import smtplib
import sys
import time
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from log_privacy import mask_email

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("olimpiada_launch")

SITE = "https://dityam.com.ua"
FROM = os.environ.get("DITYAM_GMAIL_FROM", "hellodityam.com.ua@gmail.com")
PASSWORD = os.environ.get("DITYAM_GMAIL_APP_PASSWORD", "")
OLIMP = "lohika-9-11"

# Ті самі числа, що в lib/olimpiada.js (OLIMP) — звіряє tests/test_olimpiada_launch.py.
QUESTIONS = 25
MINUTES = 35
PRINT_PRICE = 199
GIFT_DAYS = 30

# Gmail обмежує ~500 листів на добу з особистого акаунта; лишаємо запас на
# запрошення й дипломи, які йдуть із тієї самої пошти.
LIMIT = 400

# Наші посилання з UTM (#674): у статистиці видно, що людина прийшла з листа.
LINK = f"{SITE}/olimpiada?utm_source=email&utm_medium=waitlist&utm_campaign=olimpiada_start#uchast"

# Ознака відкритої реєстрації на сторінці: кнопка «Взяти участь безкоштовно»
# замість «Повідомити про старт» (app/olimpiada/page.js, OLIMP_OPEN). З
# 08.10.2026 участь безкоштовна; до того в кнопці стояла ціна.
OPEN_MARK = "Взяти участь безкоштовно"


def build_message():
    """(тема, текст, html) — лист однаковий для всіх, email у ньому не потрібен."""
    subject = "Онлайн-олімпіада з логіки Dityam.com.ua стартувала"
    points = [
        "участь безкоштовна;",
        f"{QUESTIONS} завдань на кмітливість за {MINUTES} хвилин — у зручний час;",
        f"диплом з результатом одразу після тесту і {GIFT_DAYS} днів Dityam+;",
        "призи місяця за найкращі відповіді на останнє, відкрите завдання;",
        f"друкований диплом — за бажанням: {PRINT_PRICE} грн, доставка у відділення або поштомат Нової пошти включена.",
    ]
    lead = ("Ви просили повідомити, коли стартуємо: реєстрацію на онлайн-олімпіаду з логіки "
            "для дітей 9–11 років відкрито.")
    text = "\n".join([
        "Добрий день!",
        "",
        lead,
        "",
        *[f"• {p}" for p in points],
        "",
        f"Взяти участь: {LINK}",
        "",
        "Марія Шутяк, Dityam.com.ua",
        FROM,
    ])
    esc = html.escape
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>{esc(lead)}</p>
<ul>{''.join(f'<li>{esc(p)}</li>' for p in points)}</ul>
<p><a href="{esc(LINK)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Взяти участь безкоштовно</a></p>
<p>Якщо кнопка не відкривається, скопіюйте посилання:<br><a href="{esc(LINK)}">{esc(LINK)}</a></p>
<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a></p>
</div>"""
    return subject, text, body


def make_email(to: str) -> MIMEMultipart:
    subject, text, body = build_message()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Dityam.com.ua", FROM))
    msg["To"] = to
    msg["Reply-To"] = FROM
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(body, "html", "utf-8"))
    return msg


def registration_open(page_html: str) -> bool:
    return OPEN_MARK in page_html


def fetch_page() -> str:
    req = urllib.request.Request(f"{SITE}/olimpiada?noga=1&c={int(time.time())}",
                                 headers={"User-Agent": "dityam-olimpiada-launch"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def main() -> int:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--send", action="store_true")
    args = ap.parse_args()

    is_open = registration_open(fetch_page())
    logger.info("Реєстрація на сайті: %s", "відкрита" if is_open else "ЗАКРИТА (OLIMP_OPEN = false)")

    from db import get_client
    client = get_client()
    rows = (client.table("olimpiada_waitlist").select("id, email, notified_at")
            .eq("olimp", OLIMP).is_("notified_at", "null").order("created_at")
            .limit(LIMIT).execute().data or [])
    todo = [r for r in rows if "@" in str(r.get("email") or "")]
    logger.info("Чекають на лист про старт: %d (за запуск щонайбільше %d)", len(todo), LIMIT)

    if args.dry_run:
        for r in todo:
            logger.info("dry-run: %s", mask_email(r["email"]))
        return 0
    if not is_open:
        logger.error("Реєстрацію ще не відкрито — лист не надіслано. Спершу OLIMP_OPEN = true і деплой.")
        return 1
    if not PASSWORD:
        logger.error("DITYAM_GMAIL_APP_PASSWORD не задано — листи не надіслано")
        return 1

    failed = 0
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(FROM, PASSWORD)
        for r in todo:
            try:
                smtp.sendmail(FROM, [r["email"]], make_email(r["email"]).as_string())
                client.table("olimpiada_waitlist").update(
                    {"notified_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", r["id"]).execute()
                logger.info("Надіслано: %s", mask_email(r["email"]))
                time.sleep(1)
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати: %s", mask_email(r.get("email")))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
