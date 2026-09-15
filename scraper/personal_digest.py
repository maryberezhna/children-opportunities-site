"""personal_digest.py — Dityam+: нові можливості під профіль дитини (щодня).

Для кожного активного платного підписника (`digest_subscribers`) добирає активні
можливості під профіль родини — окремо під кожну дитину (plus_children: вік,
вподобання, формат, особливі обставини) з урахуванням спільних для родини
місця й вартості — і шле підбірку в його канал, Telegram або email.

Модель: платформа відкрита для всіх і нічого не ховає. Dityam+ — це послуга:
відбір під профіль дитини, нагадування про дедлайни, допомога із заявкою.
Підписник платить за зняту з нього роботу, а не за доступ.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN (TELEGRAM_BOT_TOKEN —
     запасний), RESEND_API_KEY (є — листи йдуть через Resend із dityam.com.ua;
     нема — GMAIL_FROM і GMAIL_APP_PASSWORD), SITE_URL (optional).

Прапорці:
  --dry-run   нічого не шле й не оновлює last_sent_at — лише друкує, кому що пішло б
  --force     ігнорує вікно «14 днів» (слати всім активним зараз)
  --demo      синтетичний підписник — прев'ю матчингу без доступу до таблиці підписників
  --any-time  ігнорувати ворота часу (див. send_window.py)

Про годину відправки: те саме, що в deadline_reminders — розклад cron у
GitHub Actions запізнюється на 4-5 годин, тож воркфлоу просить кілька
ранкових запусків, а ворота відсікають зарані. Повтору не буде: last_sent_at
не дає надіслати ту саму добірку двічі.
"""
import argparse
import html
import logging
import os
import smtplib
import sys
import time
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

import plus_profile
import send_window

logger = logging.getLogger("personal_digest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SITE_URL = os.environ.get("SITE_URL", "https://dityam.com.ua")
# Підписник оформлює Dityam+ у платному боті @DityamPlusBot, тож писати йому
# треба звідти: Telegram не дає боту першим написати людині, яка його не
# запускала. До 14.09.2026 добірки й нагадування йшли з основного бота і до
# підписників платного просто не доходили. Основний лишається запасним — для
# тих, хто колись привʼязав канал через нього (/start <token> у webhook).
PLUS_BOT_TOKEN = os.environ.get("TELEGRAM_PLUS_BOT_TOKEN", "")
MAIN_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GMAIL_FROM = os.environ.get("GMAIL_FROM", "mashaberezhna0209@gmail.com")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
MAX_ITEMS = 8             # максимум можливостей в одному сповіщенні
MIN_LEAD_DAYS = int(os.environ.get("MIN_LEAD_DAYS", "3"))  # мінімум днів до дедлайну

# --- 12 канонічних тем (у синхроні з lib/themes.js / keywords.py) ---
THEME_CATEGORIES = {
    "format": ["гурток", "гуртк", "студія", "студії", "секці", "курс", "майстер-клас", "воркшоп", "інтенсив", "буткемп", "факультатив", "спецкурс", "майстерн", "дитяча академія", "розвивальні заняття", "ранній розвиток", "підготовка до школи"],
    "stem": ["stem", "steam", "робототехн", "програмуванн", "coding", "scratch", "python", "дитяче it", "юний технік", "винахідник", "наука для дітей", "науковий гурток", "астроном", "біотех", "дрон", "інженер"],
    "arts": ["арт-студія", "малюванн", "живопис", "керамік", "гончар", "музична школа", "вокал", "хоровий", "театр", "акторськ", "танц", "хореограф", "дизайн", "анімаці", "мультипліка", "фотошкол", "фотограф", "креативн", "мистецьк"],
    "sport": ["спортивна секці", "спортивна школа", "дюсш", "плаванн", "гімнастик", "єдиноборств", "скелелазінн", "фізична активн", "адаптивн спорт", "інклюзивний спорт", "футбол", "баскетбол", "шахи"],
    "languages": ["мовна школа", "англійськ", "розмовний клуб", "language club", "білінгвальн", "cambridge", "ielts", "друга іноземна", "мовний табір", "німецьк", "французьк", "іспанськ"],
    "soft_skills": ["soft skills", "лідерств", "публічні виступи", "ораторськ", "дебати", "критичне мисленн", "емоційний інтелект", "тайм-менеджмент", "фінансова грамотн", "особистісний розвиток"],
    "contests": ["олімпіад", "конкурс", "турнір", "змаганн", "хакатон", "челендж", "вікторин", "кастинг", "open call", "конкурс проєктів", "конкурс есе", "конкурс малюнків"],
    "camps": ["табір", "табор", "stem-camp", "кемп", " camp", "літня школа", "зимова школа", "виїзний інтенсив", "оздоровленн"],
    "career": ["профорієнтац", "career", "стажуванн", "internship", "job shadowing", "підприємництв", "стартап", "акселератор", "менторств", "наставництв", "mentorship"],
    "international": ["exchange", "обмін", "flex", "erasmus", "uwc", "issos", "summer school", "scholarship", "стипенді", "youth program", "international", "mobility", "upshift", "за кордон"],
    "online": ["онлайн-курс", "онлайн-школа", "онлайн курс", "вебінар", "дистанційн", "освітня платформа", "self-paced", "безкоштовний онлайн"],
    "nonformal": ["позашкільн", "неформальна освіта", "додаткова освіта", "проєктне навчання", "освітній хаб", "дитячий простір"],
}
THEME_LABEL = {"format": "Гуртки/курси", "stem": "STEM/IT", "arts": "Творчість", "sport": "Спорт", "languages": "Мови", "soft_skills": "Soft skills", "contests": "Конкурси/олімпіади", "camps": "Табори", "career": "Кар'єра", "international": "Міжнародні", "online": "Онлайн", "nonformal": "Позашкілля"}
AGE_BANDS = {"0-3": (0, 3), "4-6": (4, 6), "7-10": (7, 10), "11-14": (11, 14), "15-18": (15, 18)}


def match_themes(text: str) -> set:
    low = (text or "").lower()
    return {k for k, kws in THEME_CATEGORIES.items() if any(kw in low for kw in kws)}


def age_overlaps(a_from, a_to, bands) -> bool:
    if not bands:
        return True
    for b in bands:
        r = AGE_BANDS.get(b)
        if r and a_from <= r[1] and a_to >= r[0]:
            return True
    return False


def parse_ts(s):
    if not s:
        return None
    s = str(s).strip().replace(" ", "T")
    if s.endswith("+00"):
        s = s[:-3] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


EMPTY_NOTICE_DAYS = 30    # як рідко нагадувати, що під профіль нічого немає


QUIET_DAYS = 14           # скільки мовчимо, перш ніж слати добірку з наявного


def _quiet_too_long(sub: dict) -> bool:
    """Чи давно нічого не надсилали. Новому підписнику (last_sent_at порожній)
    добірку віддаємо одразу — інакше він заплатив і тиждень не бачить нічого."""
    last = parse_ts(sub.get("last_sent_at"))
    if last is None:
        return True
    return (datetime.now(timezone.utc) - last).days >= QUIET_DAYS


def _needs_empty_notice(sub: dict) -> bool:
    last = parse_ts(sub.get("last_empty_notice_at"))
    if last is None:
        return True
    return (datetime.now(timezone.utc) - last).days >= EMPTY_NOTICE_DAYS


def notify_empty_profile(client, sub: dict) -> None:
    """Під профіль немає жодної можливості — кажемо про це прямо."""
    text = (
        "🧡 <b>Поки нічого не знайшли під профіль вашої дитини</b>\n\n"
        "Можливостей саме за обраними віком та інтересами зараз немає — "
        "але щойно зʼявиться, надішлемо першими.\n\n"
        "Хочете отримувати більше — розширте інтереси або віковий діапазон: "
        "надішліть /start і оновіть форму."
    )
    ok = False
    if sub["channel"] == "telegram" and sub.get("telegram_chat_id"):
        ok = send_telegram(sub["telegram_chat_id"], text)
    elif sub["channel"] == "email" and sub.get("email"):
        # send_email віддає тіло як HTML — переноси рядків там не працюють.
        ok = send_email(sub["email"], text.replace("\n", "<br>"))
    if ok:
        client.table("digest_subscribers").update(
            {"last_empty_notice_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", sub["id"]).execute()
        logger.info("sub %s — надіслано нагадування про порожній профіль", sub["id"])


def pick_for(sub: dict, opps: list, since=None, children=None) -> list:
    """Можливості під профіль родини. since (datetime) — лише новіші за цей момент.

    З 14.09.2026 профіль — окремо на кожну дитину (plus_profile.py). Кожен
    запис повертається один раз; якщо дітей кілька, у полі "_for" — кому саме.
    Місця в добірці діляться між дітьми по черзі."""
    kids = children if children is not None else plus_profile.children_of(sub, [])
    fresh = [o for o in opps
             if not (since and (o["_created"] is None or o["_created"] <= since))]
    fresh.sort(key=lambda o: o.get("created_at") or "", reverse=True)
    matches = plus_profile.match_family(sub, kids, fresh)
    picked = plus_profile.pick_fair(matches, kids, MAX_ITEMS)
    return [dict(m["o"], _for=plus_profile.for_line(m, len(kids))) for m in picked]


MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня",
              "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]
SUMMARY_CHARS = 220       # скільки опису показувати в листі


def _deadline(o) -> str:
    """«до 30 жовтня» (рік — лише якщо не поточний). Сира ISO-дата в листі
    для батьків читалась би як помилка."""
    try:
        y, m, d = (int(x) for x in str(o.get("deadline") or "")[:10].split("-"))
    except ValueError:
        return ""
    year = f" {y}" if y != datetime.now(timezone.utc).year else ""
    return f"до {d} {MONTHS_GEN[m - 1]}{year}"


def _meta(o) -> str:
    bits = [THEME_LABEL.get(next(iter(o["_themes"]), ""), "") or "Можливість"]
    bits.append(f"{o['age_from']}–{o['age_to']} р.")
    if o.get("cost_type") == "free":
        bits.append("безкоштовно")
    # Дедлайн — те, заради чого читають добірку; /plus обіцяє його в повідомленні.
    deadline = _deadline(o)
    if deadline:
        bits.append(deadline)
    return " · ".join(b for b in bits if b)


def short_summary(o) -> str:
    """Опис для листа: до SUMMARY_CHARS символів, обрізаний по слову. До
    15.09.2026 опису в листі не було зовсім — лише назва, тип і вік."""
    text = " ".join(str(o.get("summary") or "").split())
    if len(text) <= SUMMARY_CHARS:
        return text
    cut = text[:SUMMARY_CHARS].rsplit(" ", 1)[0].rstrip(" ,.;:—-")
    return f"{cut}…"


PLUS_BOT = "DityamPlusBot"


def feedback_url(sub, o, value: str) -> str:
    """«👍 Цікаво / 👎 Не цікаво» з листа. Сторінка на сайті сама відправляє
    POST — сканери посилань у поштових сервісах відкривають лише GET і голос
    не ставлять (app/api/plus/feedback/route.js)."""
    return f"{SITE_URL}/api/plus/feedback?t={sub['unsub_token']}&o={o['id']}&v={value}"


def calendar_url(o):
    """«Додати в календар» — лише коли є дедлайн: без дати подію немає куди
    поставити, і /api/events/<slug>/ics без неї відповідає 422."""
    return f"{SITE_URL}/events/{o['slug']}/add" if o.get("deadline") else None


def email_footer(sub) -> str:
    """Керування підпискою з листа (прохання Марії 15.09.2026). Профіль і
    підписка живуть у @DityamPlusBot, тож посилання відкривають бот одразу на
    потрібному кроці: start=edit — анкета, start=sub — деталі підписки й /stop."""
    unsub = f"{SITE_URL}/api/unsubscribe?t={sub['unsub_token']}"
    return (
        '<p style="font-size:13px;margin-top:20px;line-height:1.9">'
        f'<a href="https://t.me/{PLUS_BOT}?start=edit" style="color:#1e4fd6">✏️ Редагувати інтереси</a> · '
        f'<a href="https://t.me/{PLUS_BOT}?start=sub" style="color:#1e4fd6">⭐ Керувати підпискою</a> · '
        f'<a href="{html.escape(unsub)}" style="color:#6b6b6b">Відписатись</a></p>'
    )


def telegram_keyboard(items) -> dict:
    """Кнопки під добіркою в Telegram: рядок на можливість, номер — як у тексті.
    callback_data вміщується в ліміт Telegram 64 байти: pfb:yes:<uuid> — 44."""
    rows = []
    for n, o in enumerate(items, 1):
        row = [
            {"text": f"👍 {n}", "callback_data": f"pfb:yes:{o['id']}"},
            {"text": f"👎 {n}", "callback_data": f"pfb:no:{o['id']}"},
        ]
        cal = calendar_url(o)
        if cal:
            row.append({"text": f"📅 {n}", "url": cal})
        rows.append(row)
    return {"inline_keyboard": rows}


def load_disliked(client, subs) -> dict:
    """«👎 Не цікаво» → цю можливість підписнику більше не надсилаємо ні в
    добірках, ні в нагадуваннях. Позначки лежать в opportunity_feedback за
    Telegram-id — і з кнопок у Telegram, і з листа. Повертає {chat_id: {id}}."""
    chats = sorted({str(s["telegram_chat_id"]) for s in subs if s.get("telegram_chat_id")})
    if not chats:
        return {}
    rows = (client.table("opportunity_feedback").select("opportunity_id, telegram_user_id")
            .eq("value", "no").in_("telegram_user_id", chats).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["telegram_user_id"]), set()).add(r["opportunity_id"])
    return out


def build_telegram(sub, items, revival: bool = False) -> str:
    # revival — це не нові записи, а добірка з того, що вже є в каталозі.
    # Називати їх «новими» було б неправдою.
    head = ("🧡 <b>Добірка під вашу дитину</b>" if revival
            else "🧡 <b>Нові можливості для вашої дитини</b>")
    lines = [head, ""]
    for n, o in enumerate(items, 1):
        url = f"{SITE_URL}/o/{o['slug']}"
        # Номер, а не маркер: кнопки під повідомленням підписані тими самими номерами.
        lines.append(f"{n}. <a href=\"{html.escape(url)}\"><b>{html.escape(o['title'])}</b></a>")
        lines.append(html.escape(_meta(o)))
        if o.get("_for"):
            lines.append(f"<i>{html.escape(o['_for'])}</i>")
        lines.append("")
    lines.append("Під повідомленням: 👍 цікаво · 👎 не цікаво · 📅 додати в календар — номер як у списку.")
    lines.append("")
    lines.append("<i>Відібрано під профіль вашої дитини. Усі можливості — відкриті для всіх на dityam.com.ua</i>")
    lines.append("Змінити профіль — /start · Відписатись — /stop")
    return "\n".join(lines)


EMAIL_BUTTON = ("display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border:1px solid #d4cfc1;"
                "border-radius:9999px;color:#131b28;font-size:13px;text-decoration:none")


def build_email(sub, items, revival: bool = False) -> str:
    rows = []
    for o in items:
        url = f"{SITE_URL}/o/{o['slug']}"
        actions = [
            f'<a href="{html.escape(feedback_url(sub, o, "yes"))}" style="{EMAIL_BUTTON}">👍 Цікаво</a>',
            f'<a href="{html.escape(feedback_url(sub, o, "no"))}" style="{EMAIL_BUTTON}">👎 Не цікаво</a>',
        ]
        cal = calendar_url(o)
        if cal:
            actions.append(f'<a href="{html.escape(cal)}" style="{EMAIL_BUTTON}">📅 Додати в календар</a>')
        rows.append(
            f'<tr><td style="padding:14px 0;border-bottom:1px solid #eee">'
            f'<a href="{html.escape(url)}" style="color:#131b28;font-size:16px;font-weight:700;text-decoration:none">{html.escape(o["title"])}</a>'
            f'<div style="color:#54617a;font-size:13px;margin-top:4px">{html.escape(_meta(o))}</div>'
            + (f'<div style="color:#131b28;font-size:14px;line-height:1.5;margin-top:6px">{html.escape(short_summary(o))}</div>' if short_summary(o) else "")
            + (f'<div style="color:#6b6b6b;font-size:12px;margin-top:4px">{html.escape(o["_for"])}</div>' if o.get("_for") else "")
            + f'<div style="margin-top:10px">{"".join(actions)}</div>'
            + '</td></tr>'
        )
    return (
        f'<div style="max-width:560px;margin:0 auto;font-family:system-ui,Arial,sans-serif;color:#131b28">'
        f'<div style="font-size:12px;color:#c8501a;font-weight:700;letter-spacing:.04em">DITYAM+</div>'
        f'<h1 style="font-size:22px;margin:6px 0 4px">{"Добірка під вашу дитину" if revival else "Нові можливості для вашої дитини"}</h1>'
        f'<p style="color:#54617a;font-size:14px;margin:0 0 8px">Підібрано під вік та інтереси дитини.</p>'
        f'<table style="width:100%;border-collapse:collapse">{"".join(rows)}</table>'
        f'<p style="color:#6b6b6b;font-size:12px;margin-top:20px">Відібрано під профіль вашої дитини. Усі можливості — відкриті для всіх на <a href="{SITE_URL}" style="color:#1e4fd6">dityam.com.ua</a>.</p>'
        f'{email_footer(sub)}</div>'
    )


# Відповіді Telegram, після яких є сенс спробувати інший бот: цей бот людині
# писати не може, бо вона його не запускала. «bot was blocked by the user» сюди
# свідомо не входить — людина сама заблокувала платний бот, і дописувати їй з
# основного було б нахабством.
_TRY_NEXT_BOT = ("chat not found", "can't initiate conversation")


def send_telegram(chat_id, text, reply_markup=None) -> bool:
    tokens = [t for t in (PLUS_BOT_TOKEN, MAIN_BOT_TOKEN) if t]
    if not tokens:
        logger.warning("TELEGRAM_PLUS_BOT_TOKEN not set")
        return False
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    detail = ""
    for i, token in enumerate(tokens):
        r = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload, timeout=20)
        try:
            body = r.json()
        except ValueError:
            body = {}
        if r.status_code == 200 and body.get("ok"):
            if i:
                logger.info("chat %s — надіслано запасним (основним) ботом", chat_id)
            return True
        detail = r.text[:200]
        if not any(s in str(body.get("description", "")).lower() for s in _TRY_NEXT_BOT):
            break
    logger.warning("TG send failed for %s: %s", chat_id, detail)
    return False


RESEND_URL = "https://api.resend.com/emails"
# Відправник — адреса на домені, підтвердженому в Resend (скринька за нею не
# потрібна); відповіді людей ідуть у пошту проєкту.
RESEND_FROM = os.environ.get("RESEND_FROM", "Dityam.com.ua <hello@dityam.com.ua>")
REPLY_TO = "hellodityam.com.ua@gmail.com"
PLAIN_TEXT = "Відкрий лист у HTML, щоб побачити підбірку. dityam.com.ua"


def _send_resend(api_key, to_addr, html_body, subject) -> bool:
    payload = {
        "from": RESEND_FROM, "to": [to_addr], "subject": subject,
        "html": html_body, "text": PLAIN_TEXT, "reply_to": REPLY_TO,
    }
    for attempt in range(3):
        try:
            r = httpx.post(RESEND_URL, json=payload, timeout=20,
                           headers={"Authorization": f"Bearer {api_key}"})
        except Exception as e:
            logger.warning("Resend send failed for %s: %s", to_addr, e)
            return False
        # Resend пускає лише кілька запитів на секунду — на 429 чекаємо й
        # пробуємо ще, щоб розсилка списку очікування не губила листи.
        if r.status_code == 429 and attempt < 2:
            time.sleep(1)
            continue
        if r.status_code < 300:
            return True
        logger.warning("Resend send failed for %s: %s %s", to_addr, r.status_code, r.text[:200])
        return False
    return False


def send_email(to_addr, html_body, subject="🧡 Нові можливості для вашої дитини — Dityam+") -> bool:
    # Gmail відбиває автоматичні HTML-листи зі звичайної gmail.com: «550 5.7.30
    # DKIM authentication didn't pass» (15.09.2026 не дійшов жоден пробний лист
    # із пошти проєкту). Підписати лист DKIM можна лише доменом відправника,
    # тож щойно є ключ Resend — шлемо з dityam.com.ua; без ключа — Gmail.
    api_key = os.environ.get("RESEND_API_KEY", "")
    if api_key:
        return _send_resend(api_key, to_addr, html_body, subject)
    if not GMAIL_APP_PASSWORD:
        logger.warning("GMAIL_APP_PASSWORD not set")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Dityam.com.ua <{GMAIL_FROM}>"
    msg["To"] = to_addr
    msg.attach(MIMEText(PLAIN_TEXT, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_FROM, GMAIL_APP_PASSWORD)
            smtp.sendmail(GMAIL_FROM, [to_addr], msg.as_string())
        return True
    except Exception as e:
        logger.warning("Email send failed for %s: %s", to_addr, e)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--any-time", action="store_true",
                    help="не зважати на ворота часу (ручний запуск, тест)")
    # Пробний лист перед запуском Dityam+ (15.09.2026): демо-родина, справжній
    # шаблон і справжня пошта — але таблицю підписників не читаємо й не змінюємо.
    ap.add_argument("--test-to", metavar="EMAIL",
                    help="надіслати пробну добірку демо-родини на цю адресу")
    args = ap.parse_args()

    if not (args.dry_run or args.demo or args.any_time or args.test_to) and send_window.too_early():
        return 0

    from db import get_client
    client = get_client()

    # Сторінками: PostgREST віддає щонайбільше 1000 рядків, а активних записів
    # уже понад тисячу. Без цього дайджест мовчки не бачив частину бази.
    # Злиті дублі (canonical_slug) відсіюємо так само, як сайт.
    opps = []
    for start in range(0, 20000, 1000):
        page = client.table("opportunities").select(
            "id, title, summary, slug, age_from, age_to, cost_type, created_at, deadline, "
            "opportunity_type, format, cities, countries, is_international, child_needs"
        ).eq("status", "active").is_("canonical_slug", "null") \
            .order("id").range(start, start + 999).execute().data or []
        opps.extend(page)
        if len(page) < 1000:
            break

    # Дедлайн «сьогодні» або «завтра» — це не можливість, а привід засмутитись:
    # поки підписник прочитає підбірку й збере документи, подача вже закриється.
    # Тому відсіваємо все, до чого лишилось менше MIN_LEAD_DAYS днів. Записи без
    # дедлайну (набір триває постійно) лишаються.
    min_deadline = (datetime.now(timezone.utc).date() + timedelta(days=MIN_LEAD_DAYS)).isoformat()
    before = len(opps)
    opps = [o for o in opps if not o.get("deadline") or str(o["deadline"])[:10] >= min_deadline]
    dropped = before - len(opps)

    for o in opps:
        o["_themes"] = match_themes(f"{o['title']} {o.get('summary') or ''}")
        o["_created"] = parse_ts(o.get("created_at"))
    logger.info(
        "Loaded %d active opportunities (%d skipped — дедлайн ближче ніж за %d дні)",
        len(opps), dropped, MIN_LEAD_DAYS,
    )

    if args.demo or args.test_to:
        subs = [{
            "id": "demo", "channel": "email" if args.test_to else "telegram", "telegram_chat_id": None,
            "email": args.test_to, "unsub_token": "demo",
            "age_bands": [], "interests": [], "places": [],
            "cost_pref": "free_only", "last_sent_at": None,
        }]
        # Демо-родина з двома дітьми — щоб бачити, як ділиться добірка.
        child_rows = [
            {"subscriber_id": "demo", "position": 1, "age_bands": ["7-10"],
             "likes": ["stem", "arts"], "formats": [], "needs": []},
            {"subscriber_id": "demo", "position": 2, "age_bands": ["15-18"],
             "likes": [], "formats": ["contests", "grants"], "needs": []},
        ]
    else:
        subs = client.table("digest_subscribers").select("*").eq("status", "active").execute().data or []
        ids = [s["id"] for s in subs]
        child_rows = (client.table("plus_children").select("*").in_("subscriber_id", ids)
                      .execute().data or []) if ids else []
    logger.info("Active subscribers: %d", len(subs))
    disliked = {} if (args.demo or args.test_to) else load_disliked(client, subs)

    sent = 0
    for sub in subs:
        # Шлемо лише можливості, що зʼявились після останнього сповіщення.
        # --force / --demo / --test-to ігнорують новизну (для тесту).
        since = None if (args.force or args.demo or args.test_to) else parse_ts(sub.get("last_sent_at"))
        kids = plus_profile.children_of(sub, child_rows)
        # «👎 Не цікаво» — цю можливість підписнику більше не пропонуємо.
        skip = disliked.get(str(sub.get("telegram_chat_id")), set())
        pool = [o for o in opps if o["id"] not in skip] if skip else opps
        items = pick_for(sub, pool, since, kids)

        # Немає НОВИХ збігів — ще не привід мовчати місяцями. У каталозі лише
        # кілька десятків записів з відкритою подачею, решта — довідкові
        # (курси, держпослуги), і вони не «нові» вже давно. Підписник платить,
        # тож раз на QUIET_DAYS надсилаємо добірку з усього, що йому підходить.
        revival = False
        if not items and not (args.dry_run or args.demo or args.test_to):
            all_matches = pick_for(sub, pool, None, kids)
            if not all_matches:
                # Під профіль немає нічого взагалі (напр. вік 0-3, де контенту
                # обмаль) — тут доречна не добірка, а пропозиція розширити фільтри.
                if _needs_empty_notice(sub):
                    notify_empty_profile(client, sub)
                continue
            if _quiet_too_long(sub):
                items = all_matches
                revival = True

        if not items:
            logger.info("sub %s — no new matching opportunities, skip", sub["id"])
            continue

        if args.dry_run or args.demo:
            titles = " | ".join(i["title"][:48] for i in items)
            logger.info("[dry] sub=%s ch=%s → %d items: %s", sub["id"], sub["channel"], len(items), titles)
            continue

        ok = False
        if sub["channel"] == "telegram" and sub.get("telegram_chat_id"):
            ok = send_telegram(sub["telegram_chat_id"], build_telegram(sub, items, revival),
                               reply_markup=telegram_keyboard(items))
        elif sub["channel"] == "email" and sub.get("email"):
            if args.test_to:
                ok = send_email(sub["email"], build_email(sub, items, revival),
                                subject="[Тест] 🧡 Нові можливості для вашої дитини — Dityam+")
            else:
                ok = send_email(sub["email"], build_email(sub, items, revival))
        else:
            logger.info("sub %s — channel not connected yet, skip", sub["id"])
            continue

        if ok and args.test_to:
            # Демо-підписника в базі немає — last_sent_at не чіпаємо.
            logger.info("Пробну добірку (%d можливостей) надіслано на %s", len(items), sub["email"])
            sent += 1
        elif ok:
            client.table("digest_subscribers").update(
                {"last_sent_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", sub["id"]).execute()
            sent += 1

    logger.info("Done. Digests sent: %d", sent)


if __name__ == "__main__":
    sys.exit(main())
