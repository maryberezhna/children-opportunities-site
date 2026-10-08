"""Листи батькам від онлайн-олімпіади: запрошення після оплати й диплом після тесту.

Марія, 05.10.2026: «на вказаний імейл прийде запрошення до тесту» і «є 72
години до проходження». З 07.10.2026 запрошення шле сам сайт у мить оплати
(lib/olimpiada-mail.js) — розклад GitHub запізнюється на 3–7 годин. Цей
скрипт лишається запасним шляхом для запрошень (сайт не зміг надіслати) і
єдиним — для дипломів. Запис «бронюється» через `invite_sent_at` лише там, де
його ще немає, тож сайт і скрипт не пошлють двох листів.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  DITYAM_GMAIL_APP_PASSWORD — пароль застосунку пошти проєкту
  DITYAM_GMAIL_FROM         — адреса (типово hellodityam.com.ua@gmail.com)

  python olimpiada_invites.py            # надіслати всім, хто чекає (запрошення й дипломи)
  python olimpiada_invites.py --dry-run  # лише показати, кому пішло б
  python olimpiada_invites.py --check    # лише перевірити вхід у пошту
  python olimpiada_invites.py --test-email адреса  # пробне запрошення (демо-запис, база не потрібна)
"""
import argparse
import html
import logging
import os
import smtplib
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from zoneinfo import ZoneInfo
from log_privacy import mask_email, short_id

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
PRINT_PRICE = 199
# Dityam+ після олімпіади — перший місяць за 1 грн (Марія, 08.10.2026: «показуй
# і тут, і в імейлі»; замість подарункового місяця). Ціни — як у lib/wayforpay.js.
PLUS_FIRST = 1
PLUS_PRICE = 119
PLUS_LINK = "https://t.me/DityamPlusBot?start=from_olimpiada"
PLUS_TEXT = ("Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини "
             "і завчасно нагадує про дедлайни — у Telegram. "
             # Марія, 08.10.2026: «можна додати — дізнаватися про наші можливості
             # першими». Обіцянка: нові олімпіади й конкурси Dityam.com.ua
             # анонсуємо в Dityam+ раніше, ніж у каналі.
             "А ще підписники першими дізнаються про наші нові олімпіади й конкурси. "
             f"Перший місяць — {PLUS_FIRST} грн, далі {PLUS_PRICE} грн/міс, скасувати можна будь-коли.")

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
    # З 08.10.2026 участь безкоштовна, і посилання не згорає; 72 години діють
    # лише для старих платних заявок.
    if not float(entry.get("amount") or 0):
        return True
    return now < access_until(paid)


def build_message(entry: dict):
    """(тема, текст, html) листа-запрошення."""
    name = str(entry.get("child_name") or "").strip() or "ваша дитина"
    link = f"{SITE}/olimpiada/test?t={entry['token']}"
    subject = f"Запрошення до онлайн-олімпіади з логіки — {name}"
    # Ті самі слова, що в lib/olimpiada-mail.js. З 08.10.2026 участь безкоштовна:
    # ні строку «72 години після оплати», ні рядка про неповернення внеску.
    points = [
        f"тест можна пройти в зручний час: {QUESTIONS} завдань із варіантами за {MINUTES} хвилин, 1 спроба; "
        "час піде після натискання «Почати»;",
        # Яке саме відкрите завдання — секрет до тесту (Марія, 06.10.2026).
        "останнє завдання — відкрите: без варіантів і без таймера, дитина пише свою відповідь; воно вирішує, "
        "хто отримає приз місяця;",
        "коли час на завдання з варіантами вийде, відповіді на них відправляться самі, "
        "а відкрите завдання можна дописати без поспіху;",
        "диплом зʼявиться на тій самій сторінці одразу після тесту; за бажанням можна замовити друкований — "
        f"{PRINT_PRICE} грн, доставка у відділення або поштомат Нової пошти включена;",
        f"переможців місяця оголосимо до 7-го числа наступного місяця; якщо {name} виграє, повідомимо вас "
        "окремим листом на цю адресу.",
    ]
    text = "\n".join([
        "Добрий день!",
        "",
        f"Заявку отримали — {name} бере участь в онлайн-олімпіаді з логіки Dityam.com.ua. Участь безкоштовна.",
        f"Посилання на тест: {link}",
        "",
        "Що важливо:",
        *[f"• {p}" for p in points],
        "",
        "Марія Шутяк, Dityam.com.ua",
        FROM,
    ])
    esc = html.escape
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>Заявку отримали — <b>{esc(name)}</b> бере участь в онлайн-олімпіаді з логіки Dityam.com.ua. Участь безкоштовна.</p>
<p><a href="{esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Перейти до тесту</a></p>
<p>Що важливо:</p>
<ul>{''.join(f'<li>{esc(p)}</li>' for p in points)}</ul>
<p>Якщо кнопка не відкривається, скопіюйте посилання:<br><a href="{esc(link)}">{esc(link)}</a></p>
<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a></p>
</div>"""
    return subject, text, body


def needs_diploma(entry: dict) -> bool:
    """Тест пройдено, диплом листом ще не йшов."""
    return bool(entry.get("finished_at")) and not entry.get("diploma_sent_at") \
        and "@" in str(entry.get("parent_email") or "")


def build_diploma_message(entry: dict):
    """(тема, текст, html) листа з дипломом — сам диплом іде вкладенням."""
    name = str(entry.get("child_name") or "").strip() or "ваша дитина"
    link = f"{SITE}/olimpiada/test?t={entry['token']}"
    score = entry.get("score")
    maximum = entry.get("max_score")
    # Приз місяця розігрується лише серед тих, хто надіслав відкрите завдання.
    competes = bool(str(entry.get("open_answer") or "").strip())
    winner = (f"Переможців оголосимо до 7-го числа наступного місяця; якщо {name} виграє, "
              "повідомимо вас окремим листом на цю адресу.")
    # Друкований диплом уже оплачено — пропонувати вдруге нема чого.
    offer_post = not entry.get("print_paid_at")
    # Оплачено разом з участю (249 грн), а адреси ще немає — просимо вказати.
    need_address = bool(entry.get("print_paid_at")) and not entry.get("print_order")
    post_link = f"{link}#dostavka"
    post_offer = (f"Надрукуємо диплом і надішлемо у відділення або поштомат Нової пошти по Україні — "
                  f"{PRINT_PRICE} грн, доставка включена.")
    address_ask = ("Друкований диплом ви оплатили разом з участю. Вкажіть, куди його надіслати: "
                   "отримувач, телефон, місто й відділення чи поштомат Нової пошти.")
    subject = f"Диплом онлайн-олімпіади з логіки — {name}"
    text = "\n".join([
        "Добрий день!",
        "",
        f"{name} пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат {score} з {maximum} балів.",
        "Диплом — у вкладенні до цього листа. Його можна надрукувати або зберегти.",
        "",
        f"Сторінка з результатом і дипломом: {link}",
        *([
            "",
            f"Відкрите завдання отримали — воно бере участь у конкурсі на приз місяця. {winner}",
        ] if competes else []),
        *([
            "",
            "Бажаєте друкований диплом?",
            f"{post_offer} Замовити: {post_link}",
        ] if offer_post else []),
        *([
            "",
            f"{address_ask} {post_link}",
        ] if need_address else []),
        "",
        "Що далі після олімпіади?",
        f"{PLUS_TEXT} Спробувати за {PLUS_FIRST} грн: {PLUS_LINK}",
        "",
        "Марія Шутяк, Dityam.com.ua",
        FROM,
    ])
    esc = html.escape
    prize_html = (f"<p>Відкрите завдання отримали — воно бере участь у конкурсі на приз місяця. {esc(winner)}</p>\n"
                  if competes else "")
    post_html = (
        f"<p><b>Бажаєте друкований диплом?</b><br>{esc(post_offer)}</p>\n"
        f'<p><a href="{esc(post_link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;'
        f'background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">'
        f"Замовити друкований диплом · {PRINT_PRICE} грн</a></p>\n"
    ) if offer_post else ""
    if need_address:
        post_html = (
            f"<p><b>Куди надіслати друкований диплом?</b><br>{esc(address_ask)}</p>\n"
            f'<p><a href="{esc(post_link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;'
            f'background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">'
            f"Вказати адресу доставки</a></p>\n"
        )
    plus_html = (
        f"<p><b>Що далі після олімпіади?</b><br>{esc(PLUS_TEXT)}</p>\n"
        f'<p><a href="{esc(PLUS_LINK)}" style="display:inline-block;padding:14px 28px;border-radius:999px;'
        f'background:#16307a;color:#ffffff;font-weight:bold;text-decoration:none">'
        f"Спробувати Dityam+ за {PLUS_FIRST} грн</a></p>\n"
    )
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p><b>{esc(name)}</b> пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат <b>{esc(str(score))} з {esc(str(maximum))}</b> балів.</p>
<p>Диплом — у вкладенні до цього листа. Його можна надрукувати або зберегти.</p>
<p><a href="{esc(link)}">Сторінка з результатом і дипломом</a></p>
{prize_html}{post_html}{plus_html}<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a></p>
</div>"""
    return subject, text, body


def fetch_diploma(entry: dict) -> bytes:
    url = f"{SITE}/api/olimpiada/diploma?t={entry['token']}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def make_diploma_email(entry: dict, png: bytes) -> MIMEMultipart:
    subject, text, body = build_diploma_message(entry)
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Dityam.com.ua", FROM))
    msg["To"] = entry["parent_email"]
    msg["Reply-To"] = FROM
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text, "plain", "utf-8"))
    alt.attach(MIMEText(body, "html", "utf-8"))
    msg.attach(alt)
    image = MIMEImage(png, "png")
    image.add_header("Content-Disposition", "attachment", filename="dyplom-olimpiada-dityam.png")
    msg.attach(image)
    return msg


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
    ap.add_argument("--test-email", default="", help="надіслати пробне запрошення на цю адресу")
    args = ap.parse_args()

    if args.test_email:
        # Перевірка доставки на ukr.net, i.ua, Outlook тощо: той самий лист,
        # що отримають батьки, але з демо-записом і без бази.
        if not PASSWORD:
            logger.error("DITYAM_GMAIL_APP_PASSWORD не задано")
            return 1
        demo = {"token": "0" * 32, "child_name": "Марк Петренко", "parent_email": args.test_email,
                "paid_at": datetime.now(timezone.utc).isoformat()}
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(FROM, PASSWORD)
            smtp.sendmail(FROM, [args.test_email], make_email(demo).as_string())
        logger.info("Пробне запрошення надіслано")
        return 0

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
    try:
        done_rows = (client.table("olimpiada_entries").select("*")
                     .not_.is_("finished_at", "null").is_("diploma_sent_at", "null")
                     .execute().data or [])
    except Exception:
        # Колонки diploma_sent_at ще немає (міграція не застосована) —
        # запрошення від цього страждати не мають.
        logger.exception("Дипломи листом: не вдалося прочитати записи")
        done_rows = []
    diplomas = [r for r in done_rows if needs_diploma(r)]
    logger.info("Чекають на запрошення: %d, на диплом: %d", len(todo), len(diplomas))
    if not todo and not diplomas:
        return 0
    if args.dry_run:
        for r in todo:
            logger.info("dry-run запрошення: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
        for r in diplomas:
            logger.info("dry-run диплом: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
        return 0
    if not PASSWORD:
        logger.error("DITYAM_GMAIL_APP_PASSWORD не задано — листи не надіслано")
        return 1

    failed = 0
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(FROM, PASSWORD)
        for r in todo:
            # «Бронюємо» запис: якщо сайт уже надіслав запрошення (або шле
            # його саме зараз), оновлення нічого не змінить — і ми не шлемо.
            claimed = (client.table("olimpiada_entries").update(
                {"invite_sent_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", r["id"]).is_("invite_sent_at", "null").execute().data or [])
            if not claimed:
                logger.info("Запрошення вже надіслав сайт: %s", short_id(r.get("id")))
                continue
            try:
                smtp.sendmail(FROM, [r["parent_email"]], make_email(r).as_string())
                logger.info("Надіслано: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
                client.table("olimpiada_entries").update({"invite_sent_at": None}).eq("id", r["id"]).execute()
        for r in diplomas:
            try:
                png = fetch_diploma(r)
                smtp.sendmail(FROM, [r["parent_email"]], make_diploma_email(r, png).as_string())
                client.table("olimpiada_entries").update(
                    {"diploma_sent_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", r["id"]).execute()
                logger.info("Диплом надіслано: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати диплом: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
