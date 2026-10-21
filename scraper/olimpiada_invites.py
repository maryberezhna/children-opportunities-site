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

  python olimpiada_invites.py            # надіслати всім, хто чекає (запрошення, дипломи, лист-питання через 7 днів)
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
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from zoneinfo import ZoneInfo
from log_privacy import mask_email, short_id
from utm import with_utm

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
PLUS_PRICE = 99
# З 21.10.2026 Dityam+ безкоштовний. Прапорець дублює PLUS_FREE з lib/plus.js —
# імпортувати константу з JS звідси нічим, тож міняти треба В ОБОХ місцях.
PLUS_FREE = True
PLUS_LINK = "https://t.me/DityamPlusBot?start=from_olimpiada"
PLUS_CTA = "Підключити Dityam+ безкоштовно" if PLUS_FREE else f"Спробувати Dityam+ за {PLUS_FIRST} грн"
PLUS_TEXT = ("Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини "
             "і завчасно нагадує про дедлайни — у Telegram. "
             # Марія, 08.10.2026: «можна додати — дізнаватися про наші можливості
             # першими». Обіцянка: нові олімпіади й конкурси Dityam.com.ua
             # анонсуємо в Dityam+ раніше, ніж у каналі.
             "А ще підписники першими дізнаються про наші нові олімпіади й конкурси. "
             + ("Підключити можна безкоштовно, одразу в боті." if PLUS_FREE else
                f"Перший місяць — {PLUS_FIRST} грн замість {PLUS_PRICE} грн, далі {PLUS_PRICE} грн/міс, скасувати можна будь-коли."))

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
    # Розбір у лист не кладемо (Марія, 11.10.2026): він лише на сторінці результату.
    subject = f"Диплом онлайн-олімпіади з логіки — {name}"
    text = "\n".join([
        "Добрий день!",
        "",
        f"{name} пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат {score} з {maximum} балів.",
        # Без вкладення (Марія, 11.10.2026): лише посилання — на сторінці диплома
        # стоїть і пропозиція друкованого диплома.
        f"Диплом чекає на сторінці з результатом — там його можна переглянути й завантажити: {link}",
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
        f"{PLUS_CTA}</a></p>\n"
    )
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p><b>{esc(name)}</b> пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат <b>{esc(str(score))} з {esc(str(maximum))}</b> балів.</p>
<p>Диплом чекає на сторінці з результатом — там його можна переглянути й завантажити.</p>
<p><a href="{esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Відкрити диплом</a></p>
{prize_html}{post_html}{plus_html}<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a></p>
</div>"""
    return subject, text, body


def make_diploma_email(entry: dict) -> MIMEMultipart:
    """Лист із посиланням на диплом — без вкладення (11.10.2026)."""
    subject, text, body = build_diploma_message(entry)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Dityam.com.ua", FROM))
    msg["To"] = entry["parent_email"]
    msg["Reply-To"] = FROM
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(body, "html", "utf-8"))
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


# ── Лист через тиждень: «розкажіть про ваш досвід» (Марія, 12.10.2026) ─────────
# «Додаємо лист через тиждень, де питаємо: розкажіть про ваш досвід пошуку
# можливостей для дитини, у чому складність, чого не вистачає; обіцяємо, що
# ми дослухаємося» — і «трошки коротше». Один лист на адресу (не на кожну
# дитину), лише справжнім учасникам: без тестів адміна й власних адрес Марії.
# Питання — за «The Mom Test»: про минулий досвід, а не «чи сподобалось би».
FEEDBACK_DAYS = 7
OWN_EMAILS = {"mashaberezhna0209@gmail.com", "maryberezhna@gmail.com", "hellodityam.com.ua@gmail.com"}
SKIP_SOURCES = {"check", "prelaunch-check"}
FEEDBACK_SUBJECT = "Розкажіть, як ви шукаєте можливості для дитини"
# «Оце треба переписати персонально» (Марія, 12.10.2026): імʼя дитини — лише в
# називному відмінку й без дієслова минулого часу, щоб не помилитися з родом.
FEEDBACK_WHO = ("Пишу вам особисто: я Марія Шутяк, засновниця Dityam.com.ua, "
                "і мені важливо почути саме вас. Розкажіть, будь ласка:")
FEEDBACK_QUESTIONS = [
    "Де ви зазвичай шукаєте для дитини конкурси, олімпіади, табори?",
    "Що в цьому найскладніше і чого не вистачає?",
    "Чи бувало, що дізналися про щось цікаве запізно?",
]
# Марія, 12.10.2026: «обіцяємо, ми дослухаємось» + обрала «буду дуже вдячна за відповідь».
FEEDBACK_PROMISE = "Буду дуже вдячна за відповідь. Обіцяємо: ми дослухаємося."
# Марія, 14.10.2026: «тут можна додати також: не забудьте, що ви можете
# замовити доставку диплома або пройти нашу нову можливість — олімпіаду з
# моди». Хто вже оплатив доставку — лише про олімпіаду з моди.
FEEDBACK_UTM = {"source": "email", "medium": "email", "campaign": "olimpiada_feedback"}
FEEDBACK_REMIND_PRINT = ("Не забудьте, що ви можете {print} або пройти нашу нову можливість — {mk}.")
FEEDBACK_REMIND_MK = "Не забудьте, що ви можете пройти нашу нову можливість — {mk}."


def feedback_reminder(entry: dict) -> tuple[str, str]:
    """(текст, html) рядка-нагадування: доставка диплома й «Модний код»."""
    esc = html.escape
    mk_url = with_utm(f"{SITE}/modnyi-kod", FEEDBACK_UTM)
    mk_text, mk_html = "олімпіаду з моди", f'<a href="{esc(mk_url)}">олімпіаду з моди</a>'
    token = entry.get("token")
    if token and not entry.get("print_paid_at"):
        pr_url = with_utm(f"{SITE}/olimpiada/test?t={token}#dostavka", FEEDBACK_UTM)
        text = FEEDBACK_REMIND_PRINT.format(print="замовити доставку диплома", mk=mk_text) + f"\nДоставка: {pr_url}\nОлімпіада з моди: {mk_url}"
        body = FEEDBACK_REMIND_PRINT.format(print=f'<a href="{esc(pr_url)}">замовити доставку диплома</a>', mk=mk_html)
        return text, body
    return FEEDBACK_REMIND_MK.format(mk=mk_text) + f"\nОлімпіада з моди: {mk_url}", FEEDBACK_REMIND_MK.format(mk=mk_html)


def feedback_greeting(names: list[str]) -> str:
    """«Олена тепер має диплом…» / «Олена і Марк тепер мають дипломи…»."""
    clean = [n for n in dict.fromkeys(str(x or "").strip() for x in names) if n][:3]
    if not clean:
        return "Ваша дитина тепер має диплом нашої онлайн-олімпіади з логіки — ще раз вітаю!"
    if len(clean) == 1:
        return f"{clean[0]} тепер має диплом нашої онлайн-олімпіади з логіки — ще раз вітаю!"
    joined = ", ".join(clean[:-1]) + f" і {clean[-1]}"
    return f"{joined} тепер мають дипломи нашої онлайн-олімпіади з логіки — ще раз вітаю!"


def feedback_targets(rows: list[dict], now: datetime | None = None) -> list[dict]:
    """По одному запису на адресу: тест пройдено, диплом пішов ≥ 7 днів тому,
    лист-питання на цю адресу ще не йшов. Чиста функція — під тести."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=FEEDBACK_DAYS)
    asked = {str(r.get("parent_email") or "").strip().lower() for r in rows if r.get("feedback_sent_at")}
    names: dict[str, list[str]] = {}
    for r in rows:
        if r.get("finished_at") and r.get("wfp_last_status") != "Test":
            names.setdefault(str(r.get("parent_email") or "").strip().lower(), []).append(r.get("child_name"))
    out, seen = [], set()
    for r in sorted(rows, key=lambda x: str(x.get("diploma_sent_at") or "")):
        email = str(r.get("parent_email") or "").strip().lower()
        if "@" not in email or email in OWN_EMAILS or email in asked or email in seen:
            continue
        if r.get("wfp_last_status") == "Test" or (r.get("source") or "") in SKIP_SOURCES:
            continue
        sent = parse_ts(r.get("diploma_sent_at"))
        if not r.get("finished_at") or not sent or sent > cutoff:
            continue
        seen.add(email)
        out.append({**r, "child_names": names.get(email, [])})
    return out


def build_feedback_message(entry: dict):
    """(тема, текст, html) листа-питання від Марії."""
    esc = html.escape
    greeting = feedback_greeting(entry.get("child_names") or [entry.get("child_name")])
    remind_text, remind_html = feedback_reminder(entry)
    text = "\n".join(["Добрий день!", "", greeting, "", FEEDBACK_WHO]
                     + [f"— {q}" for q in FEEDBACK_QUESTIONS]
                     + ["", FEEDBACK_PROMISE, "", remind_text, "", "Марія Шутяк", "засновниця Dityam.com.ua",
                        f"{FROM} · dityam.com.ua"])
    items = "".join(f'<li style="margin:0 0 6px">{esc(q)}</li>' for q in FEEDBACK_QUESTIONS)
    body = f"""<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px">
<p>Добрий день!</p>
<p>{esc(greeting)}</p>
<p>{esc(FEEDBACK_WHO)}</p>
<ul style="padding-left:20px">{items}</ul>
<p>{esc(FEEDBACK_PROMISE)}</p>
<p>{remind_html}</p>
<p>Марія Шутяк<br>засновниця Dityam.com.ua<br><a href="mailto:{esc(FROM)}">{esc(FROM)}</a> · <a href="{SITE}">dityam.com.ua</a></p>
</div>"""
    return FEEDBACK_SUBJECT, text, body


def make_feedback_email(entry: dict) -> MIMEMultipart:
    subject, text, body = build_feedback_message(entry)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    # Особистий лист — від імені Марії (як лист педагогам), відповіді — на пошту проєкту.
    msg["From"] = formataddr(("Марія Шутяк, Dityam.com.ua", FROM))
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
    try:
        fb_rows = (client.table("olimpiada_entries")
                   .select("id, token, parent_email, child_name, finished_at, diploma_sent_at, feedback_sent_at, wfp_last_status, source, print_paid_at")
                   .not_.is_("diploma_sent_at", "null").execute().data or [])
        feedback = feedback_targets(fb_rows)
    except Exception:
        # Колонки feedback_sent_at ще немає — решта листів від цього не страждає.
        logger.exception("Лист-питання: не вдалося прочитати записи")
        feedback = []
    logger.info("Чекають на запрошення: %d, на диплом: %d, на лист-питання: %d",
                len(todo), len(diplomas), len(feedback))
    if not todo and not diplomas and not feedback:
        return 0
    if args.dry_run:
        for r in todo:
            logger.info("dry-run запрошення: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
        for r in diplomas:
            logger.info("dry-run диплом: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
        for r in feedback:
            logger.info("dry-run лист-питання: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
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
                smtp.sendmail(FROM, [r["parent_email"]], make_diploma_email(r).as_string())
                client.table("olimpiada_entries").update(
                    {"diploma_sent_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", r["id"]).execute()
                logger.info("Диплом надіслано: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати диплом: %s → %s", short_id(r.get("id")), mask_email(r.get("parent_email")))
        for r in feedback:
            email = str(r.get("parent_email") or "").strip()
            # «Бронюємо» адресу: усі заявки на неї, де листа ще не було. Якщо
            # паралельний прогін уже забронював — нічого не оновиться.
            claimed = (client.table("olimpiada_entries").update(
                {"feedback_sent_at": datetime.now(timezone.utc).isoformat()}
            ).eq("parent_email", r["parent_email"]).is_("feedback_sent_at", "null").execute().data or [])
            if not claimed:
                continue
            try:
                smtp.sendmail(FROM, [email], make_feedback_email(r).as_string())
                logger.info("Лист-питання надіслано: %s → %s", short_id(r.get("id")), mask_email(email))
            except Exception:
                failed += 1
                logger.exception("Не вдалося надіслати лист-питання: %s", mask_email(email))
                client.table("olimpiada_entries").update({"feedback_sent_at": None}).eq(
                    "parent_email", r["parent_email"]).execute()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
