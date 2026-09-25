"""personal_digest.py — Dityam+: нові можливості під профіль дитини (щодня).

Для кожного активного платного підписника (`digest_subscribers`) добирає активні
можливості під профіль родини — окремо під кожну дитину (plus_children: вік,
вподобання, формат, особливі обставини) з урахуванням спільних для родини
місця й вартості — і шле підбірку в Telegram.

Імейл прибрано повністю 15.09.2026 (рішення Марії): Gmail відбивав автоматичні
листи без DKIM-підпису домену, а жоден підписник доставку листом не обрав.

Модель: платформа відкрита для всіх і нічого не ховає. Dityam+ — це послуга:
відбір під профіль дитини й нагадування про дедлайни (допомога із заявкою
позначена «скоро» — 19.09.2026 її ще не робимо).
Підписник платить за зняту з нього роботу, а не за доступ.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN (TELEGRAM_BOT_TOKEN —
     запасний), SITE_URL (optional).

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
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

import calendar_link
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
MAX_ITEMS = 8             # максимум можливостей в одному сповіщенні
MIN_LEAD_DAYS = int(os.environ.get("MIN_LEAD_DAYS", "3"))  # мінімум днів до дедлайну

# --- 16 канонічних тем (у синхроні з lib/themes.js; 4 останні додано 19.09.2026
#     для анкети Dityam+ — без них вибір «Природа», «Медицина», «Історія»
#     чи «Підприємництво» не ловив би жодного запису) ---
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
    "nature": ["екологі", "довкілл", "природознавств", "натураліст", "тварин", "зоопарк", "ботаніч", "кліматичн", "сталий розвиток", "заповідник"],
    "health": ["медицин", "медичн", "перша допомога", "домедичн", "анатомі", "здоровий спосіб життя", "ментальне здоров", "психолог", "нутриціолог", "фармаці", "реабілітац"],
    "history": ["краєзнавч", "краєзнавств", "археолог", "музе", "екскурс", "спадщин", "етнограф", "фольклор", "історія україни", "історичн"],
    "business": ["підприємництв", "стартап", "бізнес", "економік", "акселератор", "маркетинг", "фінансова грамотн"],
}
THEME_LABEL = {"format": "Гуртки/курси", "stem": "STEM/IT", "arts": "Творчість", "sport": "Спорт", "languages": "Мови", "soft_skills": "Soft skills", "contests": "Конкурси/олімпіади", "camps": "Табори", "career": "Кар'єра", "international": "Міжнародні", "online": "Онлайн", "nonformal": "Позашкілля", "nature": "Природа", "health": "Здоровʼя", "history": "Історія й культура", "business": "Підприємництво"}
AGE_BANDS = {"0-3": (0, 3), "4-6": (4, 6), "7-10": (7, 10), "11-14": (11, 14), "15-18": (15, 18)}


# Скільки календарних днів (за Києвом) між добірками для кожного варіанта.
# «⚡ Щойно зʼявиться» (instant) прибрано 21.09.2026 — обіцяв те, чого
# розсилка раз на день не виконує; того ж дня Марія повернула чесне «щодня»,
# першим і за замовчуванням. Дзеркало в JS: lib/digestFlow.js (FLOW_FREQ, freqOf).
FREQ_DAYS = {"daily": 1, "2days": 2, "weekly": 7}
DEFAULT_FREQ = "daily"
KYIV = ZoneInfo("Europe/Kyiv")


def drop_assumed(opps: list) -> tuple[list, int]:
    """Прибрати записи, чий вид у часі — здогад, а не факт зі сторінки."""
    kept = [o for o in opps if not o.get("timing_assumed")]
    return kept, len(opps) - len(kept)


def freq_days(value) -> int:
    """Пауза між добірками в днях. Порожнє, невідоме й старе «instant» —
    це «щодня»."""
    return FREQ_DAYS.get(value, FREQ_DAYS[DEFAULT_FREQ])


def freq_due(sub: dict, now=None) -> bool:
    """Чи можна слати добірку цьому підписнику зараз.

    Рахуємо календарні дні за Києвом, а не години: розклад GitHub запускає
    розсилку то о 12:00, то о 16:00, і «24 години від минулої» інколи
    припадали б на завтра — людина, що обрала «щодня», пропускала б день.
    Тепер «щодня» = не більше однієї добірки за київську добу, «раз на 2
    дні» = через день, і повторний запуск того самого дня дубля не шле.

    Порожній last_sent_at (новий підписник) — можна завжди: перша добірка не
    має чекати ні двох днів, ні тижня."""
    days = freq_days(sub.get("digest_freq"))
    last = parse_ts(sub.get("last_sent_at"))
    if not last:
        return True
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    now = now or datetime.now(timezone.utc)
    return (now.astimezone(KYIV).date() - last.astimezone(KYIV).date()).days >= days


def match_themes(text: str) -> set:
    low = (text or "").lower()
    return {k for k, kws in THEME_CATEGORIES.items() if any(kw in low for kw in kws)}

# --- Категорії з джерела (opportunities.categories) → наші теми ---
#
# Поле categories заповнює модель при екстракції, словника там немає: у базі
# ~500 різних значень трьома мовами й у різному регістрі — «танець», «танці»,
# «dance», «Танець». Брати їх як теми не можна, викидати шкода: саме вони
# описують запис, назва якого не каже нічого («Зразковий колектив „Дивосвіт“»).
#
# Тому два проходи: ключові слова по тексту категорій (ловлять українські
# написання) і ця мапа — для англомовних та абстрактних значень.
#
# Дзеркало lib/themes.js (CATEGORY_THEMES) — правити обидва файли.
CATEGORY_THEMES = {
    "arts": [
        "arts", "art", "creative", "creativity", "crafts", "craft", "handicraft",
        "handicrafts", "handcrafts", "needlework", "music", "musik", "singing", "vocal",
        "choir", "dance", "design", "photography", "animation", "film", "video", "visual arts",
        "performing arts", "artistic creativity", "ceramics", "drawing", "sewing", "acting",
        "modeling", "circus arts", "folk art", "traditional crafts", "traditional arts",
        "folk instruments", "clothing", "мистецтво", "творчість", "музика", "танець",
        "рукоділля", "ремесло", "ремесла", "кераміка", "спів", "хор", "мода", "кіно", "медіа",
    ],
    "sport": [
        "sport", "sports", "fitness", "swimming", "football", "chess", "climbing", "cycling",
        "triathlon", "martial arts", "physical activity", "roller skating", "фітнес",
        "бойові мистецтва", "карате", "дзюдо", "бокс", "боротьба", "акробатика", "самбо",
        "хортинг", "тхеквондо", "таеквон до", "кікбоксинг", "велоспорт", "тенніс", "бадмінтон",
        "йога", "аеробіка", "фізкультура", "фізична культура", "фізична підготовка",
        "фізичний розвиток", "туризм", "спорт", "стрільба", "автоспорт", "верхова їзда",
        "кінна справа", "орієнтування", "силовий спорт", "волейбол", "фізична активність",
    ],
    "stem": [
        "stem", "science", "sciences", "technology", "tech", "it", "digital", "digital skills",
        "digital literacy", "programming", "robotics", "computer science", "engineering",
        "mathematics", "physics", "chemistry", "biology", "ai", "game development",
        "web development", "3d design", "innovation", "research", "наука", "науки",
        "технології", "техніка", "математика", "хімія", "біологія", "фізика",
        "штучний інтелект", "кібербезпека", "радіотехніка", "конструювання", "моделювання",
        "дослідження", "технічна творчість", "веб дизайн",
    ],
    "languages": [
        "languages", "language", "language learning", "english", "speaking",
        "ukrainian language", "мови", "мова", "англійська", "іноземна мова", "іноземні мови",
        "мовні курси", "мовна практика", "лінгвістика", "мовлення", "розвиток мовлення",
        "культура мовлення",
    ],
    "soft_skills": [
        "leadership", "teamwork", "team building", "communication", "communications",
        "debates", "soft skills", "life skills", "skills", "skills development",
        "skill development", "personal development", "self development", "self expression",
        "etiquette", "лідерство", "комунікація", "навички", "саморозвиток", "самопізнання",
        "самоорганізація", "командна робота", "соціальні навички", "навички спілкування",
        "комунікативні навички", "media literacy", "медіаграмотність", "розвиток навичок",
        "переговори", "дипломатія",
    ],
    "international": [
        "international", "eu", "erasmus", "erasmus+", "exchange", "youth exchange",
        "volunteer exchange", "mobility", "єс", "еразмус+", "обміни", "молодіжний обмін",
        "молодіжні обміни", "міжнародна мобільність", "міжнародна програма",
        "міжнародні змагання",
    ],
    "nature": [
        "nature", "environment", "ecology", "animals", "природа", "природознавство",
        "натуралістика", "квітникарство", "флористика", "ветеринарія", "конярство",
    ],
    "health": [
        "health", "psychology", "medical", "mental health", "rehabilitation", "wellness",
        "care", "safety", "здоров'я", "безпека", "логопедія", "іппотерапія", "арт терапія",
        "адаптивна фізкультура", "інклюзія",
    ],
    "history": [
        "history", "culture", "cultural education", "heritage", "folk art",
        "traditional skills", "literature", "writing", "humanities", "історія", "культура",
        "традиції", "українська культура", "народне мистецтво", "література", "письменництво",
        "поезія", "писанкарство", "релігія",
    ],
    "business": [
        "business", "entrepreneurship", "economics", "finance", "marketing", "startups",
        "бізнес", "економіка", "підприємництво",
    ],
    "career": [
        "vocational", "vocational training", "vocational guidance", "professional",
        "career development", "paid work", "profession", "профорієнтація",
    ],
    "contests": [
        "competition", "competitions", "olympiad", "olympiad preparation", "конкурс",
        "олімпіади", "дебати",
    ],
    "camps": [
        "camp", "summer", "recreation", "оздоровлення", "рекреація", "літні курси",
    ],
    "online": [
        "online", "онлайн", "дистанційно", "video lessons",
    ],
    "nonformal": [
        "club", "clubs", "hobby", "гурток", "гуртки", "дитячі гуртки", "клуб", "дозвілля",
        "позашкільна освіта", "скаутизм", "скаутинг", "скаут", "волонтерство", "volunteering",
        "volunteer", "community service", "civic engagement", "civic education",
        "громадянська освіта", "патріотичне виховання", "громадська активність",
    ],
}


def normalize_category(value) -> str:
    low = str(value or "").lower()
    for ch in ("_", "-"):
        low = low.replace(ch, " ")
    return " ".join(low.split())


CATEGORY_INDEX = {}
for _theme, _values in CATEGORY_THEMES.items():
    for _v in _values:
        CATEGORY_INDEX.setdefault(normalize_category(_v), set()).add(_theme)


def themes_of(o: dict) -> set:
    """Теми можливості: ключові слова по назві, опису Й категоріях, плюс мапа
    категорій. Чим менше записів лишається без теми, тим менше можливостей не
    доходить до родини: вподобання дитини звіряються саме з темами."""
    cats = o.get("categories") or []
    out = match_themes(f"{o.get('title') or ''} {o.get('summary') or ''} {' '.join(cats)}")
    for c in cats:
        out |= CATEGORY_INDEX.get(normalize_category(c), set())
    return out


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
        "але коли зʼявиться, надішлемо першими.\n\n"
        "Хочете отримувати більше — розширте інтереси або віковий діапазон: "
        "надішліть /start і оновіть форму."
    )
    ok = bool(sub.get("telegram_chat_id")) and send_telegram(sub["telegram_chat_id"], text)
    if ok:
        client.table("digest_subscribers").update(
            {"last_empty_notice_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", sub["id"]).execute()
        logger.info("sub %s — надіслано нагадування про порожній профіль", sub["id"])


def _neg_created(o: dict):
    """Ключ «новіші спершу» для сортування за зростанням: рядок дати з мінусом
    не працює, тож повертаємо його перевернутим через кортеж-заглушку."""
    return tuple(-ord(c) for c in (o.get("created_at") or ""))


def pick_for(sub: dict, opps: list, since=None, children=None) -> list:
    """Можливості під профіль родини. since (datetime) — лише новіші за цей момент.

    З 14.09.2026 профіль — окремо на кожну дитину (plus_profile.py). Кожен
    запис повертається один раз; якщо дітей кілька, у полі "_for" — кому саме.
    Місця в добірці діляться між дітьми по черзі."""
    kids = children if children is not None else plus_profile.children_of(sub, [])
    fresh = [o for o in opps
             if not (since and (o["_created"] is None or o["_created"] <= since))]
    # Спершу те, чого не було в каналі. Добірка — те, за що платять, і вона не
    # має читатись як переказ безкоштовного каналу (Марія, 25.09.2026:
    # «розвести за змістом»). Опубліковане не викидаємо: канал читають не всі,
    # і пропустити доречну можливість гірше, ніж побачити її вдруге — вона
    # просто йде нижче й з позначкою.
    fresh.sort(key=lambda o: (bool(o.get("telegram_posted_at")),
                              _neg_created(o)))
    matches = plus_profile.match_family(sub, kids, fresh)
    picked = plus_profile.pick_fair(matches, kids, MAX_ITEMS)
    return [dict(m["o"], _for=plus_profile.for_line(m, len(kids))) for m in picked]


MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня",
              "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]


def _day(iso) -> tuple[int, int, int] | None:
    try:
        y, m, d = (int(x) for x in str(iso or "")[:10].split("-"))
        return y, m, d
    except ValueError:
        return None


def _deadline(o) -> str:
    """«до 30 жовтня» (рік — лише якщо не поточний). Сира ISO-дата в
    повідомленні для батьків читалась би як помилка."""
    ymd = _day(o.get("deadline"))
    if not ymd:
        return ""
    y, m, d = ymd
    year = f" {y}" if y != datetime.now(timezone.utc).year else ""
    return f"до {d} {MONTHS_GEN[m - 1]}{year}"


def _event(o) -> str:
    """«6–8 листопада» — коли подія ВІДБУВАЄТЬСЯ. Окремо від дедлайну подачі:
    до 17.09.2026 добірка знала лише дедлайн, і подія без нього не мала дати
    зовсім, а з ним — підписник не бачив, коли саме їхати."""
    start = _day(o.get("event_start_date")) or _day(o.get("event_end_date"))
    end = _day(o.get("event_end_date")) or start
    if not start:
        return ""
    now_year = datetime.now(timezone.utc).year
    year = f" {end[0]}" if end[0] != now_year else ""
    if start == end:
        return f"{start[2]} {MONTHS_GEN[start[1] - 1]}{year}"
    if start[:2] == end[:2]:
        return f"{start[2]}–{end[2]} {MONTHS_GEN[end[1] - 1]}{year}"
    return f"{start[2]} {MONTHS_GEN[start[1] - 1]} – {end[2]} {MONTHS_GEN[end[1] - 1]}{year}"


def _meta(o) -> str:
    bits = [THEME_LABEL.get(next(iter(o["_themes"]), ""), "") or "Можливість"]
    bits.append(f"{o['age_from']}–{o['age_to']} р.")
    if o.get("cost_type") == "free":
        bits.append("безкоштовно")
    # Дедлайн — те, заради чого читають добірку; /plus обіцяє його в повідомленні.
    deadline = _deadline(o)
    if deadline:
        bits.append(f"заявки {deadline}")
    event = _event(o)
    if event:
        bits.append(f"проходить {event}")
    # Чесно кажемо, що це вже бачили в каналі: інакше платна добірка виглядає
    # переказом безкоштовного (Марія, 25.09.2026).
    if o.get("telegram_posted_at"):
        bits.append("було в каналі")
    return " · ".join(b for b in bits if b)


def calendar_url(o, today=None):
    """«У календар» — пряма адреса Google Calendar із заповненою подією.

    До 25.09.2026 тут була сторінка сайту /events/<slug>/add: людина тиснула
    посилання, потрапляла на сайт і мусила клікнути ще раз (Марія: «чому він
    відкриває сайт, коли можна напряму дати те посилання»). Тепер календар
    відкривається одразу.

    Умова та сама, що на сайті (calendar_link.calendar_target): дедлайн, поки
    він попереду, інакше дати самої події. Раніше кнопка з'являлась за будь-якої
    дати, навіть торішньої, а сторінка на таке відповідала редиректом на саму
    можливість — клік у нікуди.
    """
    target = calendar_link.calendar_target(o, today or date.today())
    return calendar_link.google_calendar_url(o, target, SITE_URL) if target else None


def telegram_keyboard(items) -> dict:
    """Кнопки під добіркою: дві на можливість, номер — як у тексті.

    Було чотири (👍 👎 ✍️ 📅), і на восьми можливостях це 29 кнопок суцільною
    стіною — читати неможливо (Марія, 24.09.2026). Лишились ті, що змінюють
    поведінку системи:

    • ✍️ «подаюсь» — памʼять про пройдене: більше не пропонуємо як нову,
      нагадування звучить інакше, і з цього виростає питання «чим закінчилось»;
    • 👎 «не цікаво» — ховає можливість від цієї людини назавжди (load_disliked).

    👍 прибрано: єдиним його споживачем був ask_outcomes, де воно рівнозначне
    ✍️ (marked_by = 👍 або ✍️), тобто слабший дубль тієї самої дії. 📅 нікуди
    не зник — переїхав у текст посиланням, бо кнопкою він займав чверть стіни.

    callback_data вміщується в ліміт Telegram 64 байти: pfb:no:<uuid> — 43."""
    rows = []
    for n, o in enumerate(items, 1):
        rows.append([
            {"text": f"✍️ {n}", "callback_data": f"papp:{o['id']}"},
            {"text": f"👎 {n}", "callback_data": f"pfb:no:{o['id']}"},
        ])
    return {"inline_keyboard": rows}


def load_disliked(client, subs) -> dict:
    """«👎 Не цікаво» → цю можливість підписнику більше не надсилаємо ні в
    добірках, ні в нагадуваннях. Позначки лежать в opportunity_feedback за
    Telegram-id — з кнопок під добіркою. Повертає {chat_id: {id}}."""
    chats = sorted({str(s["telegram_chat_id"]) for s in subs if s.get("telegram_chat_id")})
    if not chats:
        return {}
    rows = (client.table("opportunity_feedback").select("opportunity_id, telegram_user_id")
            .eq("value", "no").in_("telegram_user_id", chats).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["telegram_user_id"]), set()).add(r["opportunity_id"])
    return out


def load_applications(client, subs) -> dict:
    """«✍️ Подаємося» під карткою → памʼять про пройдене. Повертає
    {subscriber_id: {opportunity_id}}.

    Навіщо. Обіцянка Dityam+ — «памʼятаємо пройдене»: те, на що родина вже
    подає заявку, не має приходити ще раз як свіжа знахідка."""
    ids = [s["id"] for s in subs if s.get("id")]
    if not ids:
        return {}
    rows = (client.table("plus_applications").select("subscriber_id, opportunity_id")
            .in_("subscriber_id", ids).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["subscriber_id"]), set()).add(r["opportunity_id"])
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
        # Календар — посиланням у тексті, а не кнопкою: кнопкою він займав
        # чверть клавіатури. На сторінці можливості його немає, тож прибрати
        # зовсім не можна — тільки перенести.
        meta = html.escape(_meta(o))
        cal = calendar_url(o)
        if cal:
            link = f"<a href=\"{html.escape(cal)}\">📅 у календар</a>"
            meta = f"{meta} · {link}" if meta else link
        lines.append(meta)
        if o.get("_for"):
            lines.append(f"<i>{html.escape(o['_for'])}</i>")
        lines.append("")
    lines.append("Під повідомленням: ✍️ подаюсь · 👎 не цікаво — номер як у списку.")
    lines.append("")
    # Рядка «Змінити профіль — /start · Відписатись — /stop» тут більше немає
    # (Марія, 24.09.2026: «дивно постійно пропонувати відписатися»). Добірка
    # приходить регулярно, і щоразу пропонувати вихід — це не турбота.
    # /stop нікуди не подівся: він лишається командою і в «⭐ Деталі підписки».
    lines.append("<i>Відібрано під профіль вашої дитини. Усі можливості — відкриті для всіх на dityam.com.ua</i>")
    return "\n".join(lines)


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--any-time", action="store_true",
                    help="не зважати на ворота часу (ручний запуск, тест)")
    args = ap.parse_args()

    if not (args.dry_run or args.demo or args.any_time) and send_window.too_early():
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
            "event_start_date, event_end_date, timing_kind, timing_assumed, "
            "opportunity_type, format, cities, countries, is_international, child_needs, "
            "categories, telegram_posted_at"
        ).eq("status", "active").is_("canonical_slug", "null") \
            .order("id").range(start, start + 999).execute().data or []
        opps.extend(page)
        if len(page) < 1000:
            break

    # Дедлайн «сьогодні» або «завтра» — це не можливість, а привід засмутитись:
    # поки підписник прочитає підбірку й збере документи, подача вже закриється.
    # Тому відсіваємо все, до чого лишилось менше MIN_LEAD_DAYS днів. Записи без
    # дедлайну лишаються: це постійні можливості, періодичні з відкритим набором
    # або події, де відома лише дата проведення.
    min_deadline = (datetime.now(timezone.utc).date() + timedelta(days=MIN_LEAD_DAYS)).isoformat()
    before = len(opps)
    opps = [o for o in opps if not o.get("deadline") or str(o["deadline"])[:10] >= min_deadline]
    dropped = before - len(opps)

    # «Набір постійний», поставлений за замовчуванням, а не прочитаний на
    # сторінці (timing_assumed), — у платну добірку не йде, доки планова
    # перевірка не підтвердить його цитатою (рішення Марії 21.09.2026: на сайті
    # лишаються, у канал і Dityam+ — ні). Таких на 21.09 — 703 гуртки й курси.
    opps, assumed = drop_assumed(opps)

    for o in opps:
        o["_themes"] = themes_of(o)
        o["_created"] = parse_ts(o.get("created_at"))
    logger.info(
        "Loaded %d active opportunities (%d skipped — дедлайн ближче ніж за %d дні, "
        "%d — «набір постійний» лише припущення)",
        len(opps), dropped, MIN_LEAD_DAYS, assumed,
    )

    if args.demo:
        subs = [{
            "id": "demo", "channel": "telegram", "telegram_chat_id": None,
            "unsub_token": "demo",
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
    disliked = {} if args.demo else load_disliked(client, subs)
    # Памʼять про пройдене: на що родина вже подає заявку (кнопка «✍️ Подаємося»).
    applied = {} if args.demo else load_applications(client, subs)

    sent = 0
    for sub in subs:
        # Частота з анкети (digest_subscribers.digest_freq): «щодня», «раз на 2
        # дні» чи «раз на тиждень»; старе «instant» і порожнє — «щодня». Пропущені
        # дні не втрачаються: наступного разу підуть усі можливості, що
        # зʼявились від останньої відправки. Нагадування про дедлайни живуть у deadline_reminders.py і
        # цієї межі не знають — пропущений дедлайн не «менше листів», а
        # втрачена можливість.
        if not (args.force or args.demo) and not freq_due(sub):
            logger.info("Sub %s: рано за частотою (%s)", sub["id"], sub.get("digest_freq"))
            continue
        # Шлемо лише можливості, що зʼявились після останнього сповіщення.
        # --force / --demo ігнорують новизну (для тесту).
        since = None if (args.force or args.demo) else parse_ts(sub.get("last_sent_at"))
        kids = plus_profile.children_of(sub, child_rows)
        # «👎 Не цікаво» — цю можливість підписнику більше не пропонуємо.
        # Не показуємо вдруге ні те, що позначили «не цікаво», ні те, на що
        # вже подаються: перше людина відкинула, про друге вона й так памʼятає.
        skip = disliked.get(str(sub.get("telegram_chat_id")), set()) \
            | applied.get(str(sub["id"]), set())
        pool = [o for o in opps if o["id"] not in skip] if skip else opps
        items = pick_for(sub, pool, since, kids)

        # Немає НОВИХ збігів — ще не привід мовчати місяцями. У каталозі лише
        # кілька десятків записів з відкритою подачею, решта — довідкові
        # (курси, держпослуги), і вони не «нові» вже давно. Підписник платить,
        # тож раз на QUIET_DAYS надсилаємо добірку з усього, що йому підходить.
        revival = False
        if not items and not (args.dry_run or args.demo):
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

        if not sub.get("telegram_chat_id"):
            logger.info("sub %s — Telegram not connected yet, skip", sub["id"])
            continue
        ok = send_telegram(sub["telegram_chat_id"], build_telegram(sub, items, revival),
                           reply_markup=telegram_keyboard(items))

        if ok:
            client.table("digest_subscribers").update(
                {"last_sent_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", sub["id"]).execute()
            sent += 1

    logger.info("Done. Digests sent: %d", sent)


if __name__ == "__main__":
    sys.exit(main())
