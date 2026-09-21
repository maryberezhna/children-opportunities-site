"""process_suggestions.py — пропозиції від людей доходять до кінця.

Що було. Форма на сайті писала в `opportunity_suggestions` і слала сповіщення
в адмінський чат. На цьому все й закінчувалось. 12.09.2026 Seniv Studio
надіслала два дитячі вокальні конкурси, лишила пошту для звʼязку — і не
отримала ні відповіді, ні своєї можливості на сайті. Чотири пропозиції за
весь час лежали зі статусом `new`.

Людина, яка витратила пʼять хвилин на нашу форму і не отримала нічого,
вдруге не напише. А організатор, який сам приносить можливість, — це
найдешевше й найточніше джерело з усіх, що в нас є.

Що робить скрипт:
  1. бере пропозиції зі статусом `new`;
  2. відкриває вказану сторінку й проганяє через звичайний нормалізатор —
     той самий, з правилом «нічого не вигадувати» і обовʼязковим мінімумом
     із пʼяти полів. Ніяких пільг за те, що можливість принесли руками;
  3. кладе результат у `opportunities` чернеткою, з позначкою, що це
     пропозиція, і з контактом відправника в коментарі;
  4. відповідає листом на вказану пошту — тим самим Gmail SMTP, яким уже
     ходять нагадування про дедлайни;
  5. проставляє пропозиції статус: `imported`, `duplicate` або `rejected`;
  6. коли можливість із пропозиції вийшла на сайт — шле відправнику другий
     лист: посилання, дати з картки й пропозицію «Топ тижня» (з 21.09.2026).

Чернетка, а не публікація, — свідомо. Пропозиція від організатора це заявка,
а не факт: у ній буває реклама, буває вік «від 6 до 18» на програмі, куди
беруть із 14, буває платна послуга під виглядом конкурсу. Рішення лишається
за людиною, але тепер воно лежить у черзі модерації, а не в окремій таблиці,
куди ніхто не заходить.

Запуск:
    python process_suggestions.py            # дамп, нічого не пише й не шле
    python process_suggestions.py --apply

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     GMAIL_FROM + GMAIL_APP_PASSWORD (без них лист просто не піде).
"""
import argparse
import html
import logging
import os
import re
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from canonical import canonical_url
from db import get_client
from normalizer import Normalizer, missing_required

logger = logging.getLogger("process_suggestions")

UA = "Mozilla/5.0 (compatible; DityamSuggest/1.0; +https://dityam.com.ua)"
GMAIL_FROM = os.environ.get("GMAIL_FROM", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SITE = "https://dityam.com.ua"

# Пошта у полі «контакт». Люди лишають там і телефон, і нікнейм у Telegram —
# відповісти листом можна лише на пошту, решту видно модератору в коментарі.
# Та сама перевірка — у lib/suggestions.js (адмінка пише «лист пішов»).
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$")

# Хто приніс — колонка origin (з 21.09.2026). Поп-ап — людина ззовні; решту
# внесли ми самі: Марія або наше дослідження. Для них contact — організатор,
# а не той, хто нам писав, тож листа «дякуємо, що надіслали» не шлемо, а
# джерелом на картці ставимо домен сторінки, не «Пропозицію від організатора».
ORIGIN_TRACE = {
    "popup": "💡 пропозиція з форми на сайті",
    "maria": "💡 принесла Марія",
    "research": "🔎 з нашого дослідження, не з форми",
}


def origin_of(s: dict) -> str:
    o = s.get("origin")
    return o if o in ORIGIN_TRACE else "popup"


def reply_email(s: dict) -> str | None:
    """Куди відповісти листом: лише людині з поп-апа, яка лишила пошту."""
    contact = (s.get("contact") or "").strip()
    if origin_of(s) != "popup" or not EMAIL_RE.match(contact):
        return None
    return contact


def source_label(s: dict, url: str) -> str:
    if origin_of(s) == "popup":
        return "Пропозиція від організатора"
    host = (urlparse(url).hostname or "").removeprefix("www.")
    return host or "Пропозиція від організатора"


def fetch_text(url: str) -> tuple[str | None, str]:
    try:
        with httpx.Client(timeout=25, follow_redirects=True,
                          headers={"User-Agent": UA,
                                   "Accept-Language": "uk,en;q=0.8"}) as c:
            r = c.get(url)
    except Exception as e:
        return None, f"не відповів: {type(e).__name__}"
    if r.status_code >= 400:
        return None, f"HTTP {r.status_code}"
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "svg"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    if len(text) < 200:
        return None, f"порожня сторінка ({len(text)} символів)"
    return text[:15000], f"HTTP {r.status_code}"


# ── Листи ───────────────────────────────────────────────────────────────────
# Тон: подяка без підлабузництва, чесно про те, що далі, і без обіцянок, яких
# ми не можемо дати. Слова «каталог» немає навмисно — у нас платформа.
# Виправдань на кшталт «ми нічого не продаємо» теж немає: про них не питали.

SUBJECT_OK = "Ваша можливість на Dityam.com.ua"
SUBJECT_DUP = "Ваша можливість уже є на Dityam.com.ua"
SUBJECT_PUBLISHED = "Вашу можливість опубліковано на Dityam.com.ua"

# Підпис — як у листах Марії до медіа. До 21.09.2026 тут стояло «Марія
# Бережна» — імʼя, яким Марія більше не підписується.
SIGNATURE = """<p>З повагою,<br>
Марія Шутяк<br>
Засновниця платформи Dityam.com.ua<br>
<a href="{site}">{site}</a><br>
hellodityam.com.ua@gmail.com · +380 63 476 3998</p>"""

# Платне просування для організаторів — слова Марії з листа Seniv Studio
# 21.09.2026. Лише в листах про те, що можливість УЖЕ на сайті: пропонувати
# «Топ тижня» для чернетки, якої ніхто не бачить, — дивно.
OFFER = """<p>І ще питання: чи було б вам цікаво потрапити в «Топ тижня» на платформі
й отримати окремий пост про вас у нашому
<a href="https://t.me/dityam_com_ua">Telegram-каналі</a> та
<a href="https://www.instagram.com/dityam.com.ua">Instagram</a>? Це нова послуга
для організаторів, ми саме її запускаємо. Вартість — 500 грн.</p>"""

BODY_PUBLISHED = """<p>Доброго дня!</p>

<p>Дякую, що надіслали нам можливість «{title}». Ми її опублікували:<br>
<a href="{url}">{url}</a></p>

{facts}""" + OFFER + "\n\n" + SIGNATURE

BODY_IMPORTED = """<p>Доброго дня!</p>

<p>Ви надіслали нам можливість «{title}». Дякуємо — ми справді читаємо кожну
пропозицію, і саме від організаторів приходять найточніші дані.</p>

<p>Можливість уже в нашій черзі на перевірку. Ми звіряємо вік, дати, вартість
і формат із вашою сторінкою, після чого вона зʼявляється на платформі. Зазвичай
це займає один-два дні.</p>

<p>Якщо на сторінці зміняться дати або умови — просто напишіть у відповідь на
цей лист, ми оновимо.</p>

<p>Dityam.com.ua — безкоштовна платформа, яка збирає можливості для українських
дітей 0–18 років: конкурси, табори, олімпіади, стипендії, гуртки.</p>

""" + SIGNATURE

BODY_DUPLICATE = """<p>Доброго дня!</p>

<p>Ви надіслали нам можливість «{title}». Дякуємо, що подумали про нас.</p>

<p>Вона вже є на платформі: <a href="{url}">{url}</a>. Перевірте, будь ласка,
чи все там правильно — дати, вік, вартість. Якщо щось застаріло, напишіть у
відповідь на цей лист, і ми виправимо того ж дня.</p>

{offer}""" + SIGNATURE

BODY_NEEDS_HUMAN = """<p>Доброго дня!</p>

<p>Ви надіслали нам можливість «{title}». Дякуємо — ми її отримали.</p>

<p>Автоматично зібрати дані зі сторінки не вийшло, тож її дивитиметься людина.
Щоб пришвидшити, можете надіслати у відповідь чотири речі: вік учасників,
дедлайн подачі або дату проведення, вартість участі та формат (онлайн, офлайн
чи за кордоном). Без них ми не публікуємо нічого — батькам така картка не
допомагає.</p>

""" + SIGNATURE


def send_email(to_addr: str, subject: str, html: str) -> bool:
    if not GMAIL_FROM or not GMAIL_APP_PASSWORD:
        logger.warning("GMAIL_FROM/GMAIL_APP_PASSWORD не задані — лист не піде")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Dityam.com.ua <{GMAIL_FROM}>"
    msg["To"] = to_addr
    # Посилання під словом («Telegram-каналі») у текстовій версії інакше
    # губиться — лишаємо адресу в дужках.
    plain = re.sub(r'<a href="([^"]+)">([^<]+)</a>',
                   lambda m: m.group(2) if m.group(1) == m.group(2)
                   else f"{m.group(2)} ({m.group(1)})", html)
    plain = re.sub(r"<[^>]+>", "", plain)
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_FROM, GMAIL_APP_PASSWORD)
            smtp.sendmail(GMAIL_FROM, [to_addr], msg.as_string())
        return True
    except Exception as e:
        logger.warning("Лист на %s не пішов: %s", to_addr, e)
        return False


def find_existing(sb, url: str) -> dict | None:
    """Чи є вже така можливість. Шукаємо за канонічним URL — тим самим ключем,
    яким дедуплікація ловить дублі між двома конвеєрами."""
    canon = canonical_url(url)
    for column in ("canonical_url", "source_url"):
        try:
            rows = (sb.table("opportunities").select("slug, title, status")
                    .eq(column, canon).limit(1).execute().data or [])
        except Exception:
            continue
        if rows:
            return rows[0]
    rows = (sb.table("opportunities").select("slug, title, status")
            .eq("source_url", url).limit(1).execute().data or [])
    return rows[0] if rows else None


# ── Лист «опубліковано» ─────────────────────────────────────────────────────
# Перший лист («у черзі на перевірку») іде в момент імпорту, а публікація —
# через день-два, після модерації. До 21.09.2026 про неї відправник не
# дізнавався взагалі. Тепер кожен прохід скрипта перевіряє, чи не вийшли
# чернетки з пропозицій на сайт, і шле другий лист — один раз:
# opportunity_suggestions.published_letter_at.

PUBLISHED_FIELDS = "slug, title, status, deadline, event_start_date, event_end_date, cities"

# Статуси, з яких можливість виходить на сайт пізніше: імпортована скриптом,
# додана вручну в адмінці або дубль запису, що ще лежав чернеткою.
AWAITING_PUBLISH = ["imported", "added", "duplicate"]

# Пропозиція, що пролежала чернеткою квартал, — уже не новина для відправника.
# Без межі прохід щоразу перебирав би й усі старі рядки без пошти.
PUBLISHED_WINDOW_DAYS = 90


def find_published(sb, url: str) -> dict | None:
    """Запис про цю сторінку, який люди бачать на сайті. Злиті дублі
    (canonical_slug) не беремо: їхня сторінка веде на інший запис."""
    canon = canonical_url(url)
    for column, value in (("canonical_url", canon), ("source_url", canon), ("source_url", url)):
        if not value:
            continue
        try:
            rows = (sb.table("opportunities").select(PUBLISHED_FIELDS)
                    .eq(column, value).eq("status", "active").is_("canonical_slug", "null")
                    .limit(1).execute().data or [])
        except Exception:
            continue
        if rows:
            return rows[0]
    return None


MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня",
              "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]


def uk_date(iso) -> str:
    """«2026-10-25» → «25 жовтня»; рік — лише якщо не поточний."""
    try:
        d = datetime.fromisoformat(str(iso)[:10]).date()
    except ValueError:
        return ""
    year = f" {d.year}" if d.year != datetime.now(timezone.utc).year else ""
    return f"{d.day} {MONTHS_GEN[d.month - 1]}{year}"


def card_facts(o: dict) -> str:
    """«На сторінці: заявки до 25 жовтня, проведення — 31 жовтня, місце — Львів.»
    Щоб організатор одним поглядом звірив картку зі своєю сторінкою. Чого на
    картці немає, того немає й у листі."""
    parts = []
    if d := uk_date(o.get("deadline") or ""):
        parts.append(f"заявки до {d}")
    start = uk_date(o.get("event_start_date") or "")
    end = uk_date(o.get("event_end_date") or "")
    if start and end and start != end:
        parts.append(f"проведення — {start} – {end}")
    elif start or end:
        parts.append(f"проведення — {start or end}")
    cities = [c for c in (o.get("cities") or []) if c]
    if cities:
        parts.append("місце — " + ", ".join(cities[:3]))
    if not parts:
        return ""
    return (f"<p>На сторінці: {html.escape(', '.join(parts))}. Якщо щось неточно, "
            "напишіть у відповідь на цей лист.</p>\n\n")


def mark_letter_sent(sb, ids: list) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for sid in ids:
        sb.table("opportunity_suggestions").update(
            {"published_letter_at": now}).eq("id", sid).execute()


def reply_duplicate(sb, s: dict, existing: dict, apply: bool) -> bool:
    """Лист «уже є на платформі» — лише коли сторінку справді видно на сайті.

    До 21.09.2026 він ішов і на дубль чернетки — з посиланням, яке віддає 404.
    Тепер такий рядок чекає: щойно чернетку опублікують, notify_published
    надішле лист про публікацію. Повертає, чи лист пішов."""
    email = reply_email(s)
    status = existing.get("status")
    if not apply or not email or status not in ("active", "closed"):
        return False
    url = (s.get("url") or "").strip()
    sent = send_email(email, SUBJECT_DUP, BODY_DUPLICATE.format(
        title=html.escape(s.get("title") or url), url=f"{SITE}/o/{existing['slug']}",
        site=SITE, offer=OFFER + "\n\n" if status == "active" else ""))
    if sent:
        mark_letter_sent(sb, [s["id"]])
    return sent


def notify_published(sb, apply: bool = False) -> int:
    """Відправникам, чия можливість уже на сайті, — лист «опубліковано».
    Повертає, скільки листів пішло б (у дампі) або пішло."""
    since = (datetime.now(timezone.utc) - timedelta(days=PUBLISHED_WINDOW_DAYS)).isoformat()
    rows = (sb.table("opportunity_suggestions").select("*")
            .in_("status", AWAITING_PUBLISH).is_("published_letter_at", "null")
            .gte("created_at", since).order("created_at").limit(500)
            .execute().data or [])
    # Та сама людина про ту саму можливість — один лист, навіть якщо
    # пропозицій кілька: Seniv Studio 12.09.2026 надіслала LORELEIFEST двічі.
    letters = {}
    for s in rows:
        email = reply_email(s)
        url = (s.get("url") or "").strip()
        if not email or not url.startswith(("http://", "https://")):
            continue
        opp = find_published(sb, url)
        if not opp:
            continue
        key = (email.lower(), opp["slug"])
        letter = letters.setdefault(key, {"email": email, "opp": opp, "ids": [],
                                          "title": (s.get("title") or "").strip() or opp["title"]})
        letter["ids"].append(s["id"])

    sent = 0
    for letter in letters.values():
        opp = letter["opp"]
        print(f"📬 {letter['title'][:56]:<56} опубліковано → {letter['email']}")
        if not apply:
            sent += 1
            continue
        ok = send_email(letter["email"], SUBJECT_PUBLISHED, BODY_PUBLISHED.format(
            title=html.escape(letter["title"]), url=f"{SITE}/o/{opp['slug']}",
            facts=card_facts(opp), site=SITE))
        # Лист не пішов — не позначаємо: наступний прохід спробує ще раз.
        if ok:
            mark_letter_sent(sb, letter["ids"])
            sent += 1
    return sent


def process_one(sb, normalizer, s: dict, apply: bool, seen: set) -> tuple[str, str]:
    """Повертає (новий статус, пояснення для дампу)."""
    url = (s.get("url") or "").strip()
    title = (s.get("title") or "").strip()
    contact = (s.get("contact") or "").strip()
    email = reply_email(s)
    origin = origin_of(s)

    if not url.startswith(("http://", "https://")):
        return "rejected", "немає посилання на сторінку можливості"

    # Та сама пропозиція двічі в одній партії. Seniv Studio 12.09.2026
    # надіслала LORELEIFEST двічі поспіль — людина не побачила підтвердження
    # й натиснула ще раз. Без цієї перевірки вона отримала б два листи за
    # хвилину: один «додали», другий «уже є на сайті».
    canon = canonical_url(url)
    if canon in seen:
        return "duplicate", "та сама пропозиція вже опрацьована в цій партії"
    seen.add(canon)

    existing = find_existing(sb, url)
    if existing:
        reply_duplicate(sb, s, existing, apply)
        return "duplicate", f"вже в базі: {existing['title'][:50]}"

    page, http = fetch_text(url)
    if not page:
        if apply and email:
            send_email(email, SUBJECT_OK, BODY_NEEDS_HUMAN.format(
                title=title or url, site=SITE))
        return "needs_human", f"сторінку не прочитали ({http})"

    try:
        data = normalizer.normalize(page, source=source_label(s, url),
                                    source_url=url, raw_title=title or None)
    except Exception as e:
        return "new", f"нормалізатор упав, спробуємо ще раз: {e}"

    if not data:
        reason = getattr(normalizer, "last_reject_reason", None) or "не схоже на можливість для дитини"
        if apply and email:
            send_email(email, SUBJECT_OK, BODY_NEEDS_HUMAN.format(
                title=title or url, site=SITE))
        return "needs_human", f"відхилено автоматично: {reason}"

    # Пропозиція завжди йде чернеткою, навіть якщо всі поля на місці. Це
    # заявка від зацікавленої сторони, а не наша знахідка.
    missing = missing_required(data)
    data["status"] = "draft"
    trace = ORIGIN_TRACE[origin]
    if contact:
        trace += f" · {'контакт' if origin == 'popup' else 'організатор'}: {contact}"
    if missing:
        trace += " · бракує: " + ", ".join(missing)
    data["admin_comment"] = ((data.get("admin_comment") or "") + " · " + trace).strip(" ·")

    if apply:
        from db import upsert_opportunity
        upsert_opportunity(sb, data)
        if email:
            body = BODY_NEEDS_HUMAN if missing else BODY_IMPORTED
            send_email(email, SUBJECT_OK, body.format(title=title or data["title"], site=SITE))

    label = f"→ чернетка «{data['title'][:44]}»"
    if missing:
        label += " (бракує: " + ", ".join(missing) + ")"
    return "imported", label


def recheck_waiting(sb, apply: bool = False, limit: int = 200) -> int:
    """Пропозиції, що чекають людини, ще раз звіряємо з базою.

    Дублі ловимо ДО читання сторінки — але лише раз, у момент надходження.
    Якщо запис про ту саму можливість зʼявився ПІЗНІШЕ, пропозиція так і
    висіла в «потребує людини»: 14.09.2026 дослідження «Дітям захисників»
    спершу створило пропозиції, а записи про ті самі виплати — того ж дня,
    але пізніше. Троє з шести тиждень чекали розбору, хоча давно були в базі
    (розбір Марії 21.09.2026).

    Прохід дешевий: два-три запити на пропозицію, без мережі й без моделі.
    Повертає, скільки закрито як дублі.
    """
    rows = (sb.table("opportunity_suggestions").select("*")
            .eq("status", "needs_human").order("created_at").limit(limit)
            .execute().data or [])
    closed = 0
    for s in rows:
        url = (s.get("url") or "").strip()
        if not url.startswith(("http://", "https://")):
            continue
        existing = find_existing(sb, url)
        if not existing:
            continue
        closed += 1
        title = (s.get("title") or url)[:56]
        print(f"♻️ {title:<56} тепер уже в базі: {existing['title'][:50]}")
        if not apply:
            continue
        sb.table("opportunity_suggestions").update(
            {"status": "duplicate"}).eq("id", s["id"]).execute()
        reply_duplicate(sb, s, existing, apply)
    return closed


def run(apply: bool = False, limit: int = 50) -> dict:
    sb = get_client()
    # Спершу — ті, що вже чекають людини: частина з них могла стати дублем.
    rechecked = recheck_waiting(sb, apply)
    if rechecked:
        print(f"З черги «потребує людини» закрито як дублі: {rechecked}\n")

    published = notify_published(sb, apply)
    if published:
        print(f"Листів «опубліковано»: {published}\n")

    rows = (sb.table("opportunity_suggestions").select("*")
            .eq("status", "new").order("created_at").limit(limit).execute().data or [])
    print(f"Пропозицій зі статусом «new»: {len(rows)}\n")
    if not rows:
        return {"duplicate": rechecked} if rechecked else {}

    normalizer = Normalizer()
    stats = {}
    seen = set()
    for s in rows:
        status, why = process_one(sb, normalizer, s, apply, seen)
        stats[status] = stats.get(status, 0) + 1
        mark = {"imported": "✅", "duplicate": "♻️", "needs_human": "🟡",
                "rejected": "❌", "new": "⏸"}.get(status, "·")
        print(f"{mark} {(s.get('title') or s.get('url') or '')[:56]:<56} {why}")
        if apply and status != "new":
            sb.table("opportunity_suggestions").update(
                {"status": status}).eq("id", s["id"]).execute()

    print("\n" + ", ".join(f"{k}: {v}" for k, v in sorted(stats.items())))
    if not apply:
        print("\nЦе дамп. Нічого не записано й не надіслано. Щоб застосувати: --apply")
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Пропозиції можливостей від людей")
    p.add_argument("--apply", action="store_true", help="писати в базу й слати листи")
    p.add_argument("--limit", type=int, default=50)
    args = p.parse_args()
    run(apply=args.apply, limit=args.limit)
