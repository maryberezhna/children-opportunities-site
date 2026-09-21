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
  5. проставляє пропозиції статус: `imported`, `duplicate` або `rejected`.

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
import logging
import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$")


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

<p>Марія Бережна<br>
Dityam.com.ua<br>
<a href="{site}">{site}</a></p>"""

BODY_DUPLICATE = """<p>Доброго дня!</p>

<p>Ви надіслали нам можливість «{title}». Дякуємо, що подумали про нас.</p>

<p>Вона вже є на платформі: <a href="{url}">{url}</a>. Перевірте, будь ласка,
чи все там правильно — дати, вік, вартість. Якщо щось застаріло, напишіть у
відповідь на цей лист, і ми виправимо того ж дня.</p>

<p>Марія Бережна<br>
Dityam.com.ua<br>
<a href="{site}">{site}</a></p>"""

BODY_NEEDS_HUMAN = """<p>Доброго дня!</p>

<p>Ви надіслали нам можливість «{title}». Дякуємо — ми її отримали.</p>

<p>Автоматично зібрати дані зі сторінки не вийшло, тож її дивитиметься людина.
Щоб пришвидшити, можете надіслати у відповідь чотири речі: вік учасників,
дедлайн подачі або дату проведення, вартість участі та формат (онлайн, офлайн
чи за кордоном). Без них ми не публікуємо нічого — батькам така картка не
допомагає.</p>

<p>Марія Бережна<br>
Dityam.com.ua<br>
<a href="{site}">{site}</a></p>"""


def send_email(to_addr: str, subject: str, html: str) -> bool:
    if not GMAIL_FROM or not GMAIL_APP_PASSWORD:
        logger.warning("GMAIL_FROM/GMAIL_APP_PASSWORD не задані — лист не піде")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Dityam.com.ua <{GMAIL_FROM}>"
    msg["To"] = to_addr
    plain = re.sub(r"<[^>]+>", "", html)
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


def process_one(sb, normalizer, s: dict, apply: bool, seen: set) -> tuple[str, str]:
    """Повертає (новий статус, пояснення для дампу)."""
    url = (s.get("url") or "").strip()
    title = (s.get("title") or "").strip()
    contact = (s.get("contact") or "").strip()
    email = contact if EMAIL_RE.match(contact) else None

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
        if apply and email:
            send_email(email, SUBJECT_DUP, BODY_DUPLICATE.format(
                title=title or url, url=f"{SITE}/o/{existing['slug']}", site=SITE))
        return "duplicate", f"вже в базі: {existing['title'][:50]}"

    page, http = fetch_text(url)
    if not page:
        if apply and email:
            send_email(email, SUBJECT_OK, BODY_NEEDS_HUMAN.format(
                title=title or url, site=SITE))
        return "needs_human", f"сторінку не прочитали ({http})"

    try:
        data = normalizer.normalize(page, source="Пропозиція від організатора",
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
    trace = "💡 пропозиція з форми на сайті"
    if contact:
        trace += f" · контакт: {contact}"
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
        contact = (s.get("contact") or "").strip()
        if EMAIL_RE.match(contact):
            send_email(contact, SUBJECT_DUP, BODY_DUPLICATE.format(
                title=s.get("title") or url, url=f"{SITE}/o/{existing['slug']}", site=SITE))
    return closed


def run(apply: bool = False, limit: int = 50) -> dict:
    sb = get_client()
    # Спершу — ті, що вже чекають людини: частина з них могла стати дублем.
    rechecked = recheck_waiting(sb, apply)
    if rechecked:
        print(f"З черги «потребує людини» закрито як дублі: {rechecked}\n")

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
