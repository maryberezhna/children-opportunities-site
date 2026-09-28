"""Сайти організацій діаспори: одне джерело — один сайт, щотижня.

Напрям «Діаспора» (рішення Марії 22 і 28.09.2026): діти з України, які вже
ЖИВУТЬ за кордоном. Суботні школи, студії, гуртки й конкурси українських
організацій там — наше, і платні теж («платно»). Суботня школа — одна
постійна картка, а не картка на кожен урок. Подія з українським змістом чи
від української організації — наша, навіть якщо відкрита для всіх. Місцеві
послуги без українського змісту — ні. Агрегатори-конкуренти (espanaua.es,
ua.pl, afisha.it, чужі Telegram-канали) джерелом не стають ніколи: тут лише
сайти самих організацій, і картка веде на їхню сторінку.

Як читаємо. Три способи, і кожен сайт описаний даними в SITES, а не кодом:
  • wp    — WordPress REST (/wp-json/wp/v2/…): дописи за вікно дат і
            «каталоги» (гуртки, курси), які живуть роками;
  • rss   — стрічка, коли REST закритий (cerkiew.net.pl: 401);
  • pages — сторінки без стрічки (Google Sites, конструктори): читаємо
            щоразу, а новизну визначає хеш-гейт raw_items — незмінна
            сторінка до моделі не йде.

Чому окремий рядок у sources на кожен сайт. Сайти оновлюються рідко, тож
обхід щотижневий (закріплений crawl_interval_days=7), а вимкнути один сайт
можна рядком у базі без деплою. Країну й місто за замовчуванням тримає
config рядка (default_countries, default_city): main.py підставляє їх, коли
модель не назвала місця, а участь не онлайн. У текст сирцю країну НЕ
дописуємо: ворота правди (proof.py) прийняли б наш рядок за цитату сторінки.

Мова. Текст іде в модель мовою сторінки — нормалізатор перекладає назву й
опис, а цитати-докази мусять лишатися дослівними, тобто німецькими чи
польськими. Де сайт має українську версію (Осередок, Polylang), беремо її.

Відсів до моделі (безкоштовний). Змішані стрічки — Український дім у
Дрездені, Об'єднання українців у Польщі, єпархія УГКЦ — здебільшого про
дорослих: зустрічі 60+, біржі праці, проповіді. У модель іде лише те, де є
слово про дитину, школу чи дитячий вік будь-якою з мов напряму, і не звіт
про подію, що вже минула.

Запуск без бази й без моделі — лише що зібрали б:
    python scrapers/diaspora_sites.py --dry-run [--only ucci]
"""
from __future__ import annotations

import asyncio
import logging
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

if __name__ == "__main__":  # запуск файлом: імпорти як із scraper/
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raw_store import with_published  # noqa: E402
from scrapers.rss_feeds import _clean, _link, _parse_date  # noqa: E402

logger = logging.getLogger(__name__)

# Нормалізатор читає перші 6000 знаків сирцю — довше різати немає сенсу, а
# головне ставимо першим.
MAX_TEXT = 6000
DEFAULT_LOOKBACK_DAYS = 30
# Каталог (гурток, курс, студія), якого не торкались понад рік, — найімовірніше
# покинута сторінка: торішній гурток живим записом ставати не має.
CATALOG_MAX_AGE_DAYS = 365
WP_PER_PAGE = 100
WP_MAX_PAGES = 5
DELAY_SECONDS = 0.5

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    # Англійська першою: службові написи Google Sites тоді англійські, і
    # _PLATFORM_CUTS їх зрізає. Мову самого вмісту це не змінює.
    "Accept-Language": "en;q=0.9,uk;q=0.8",
}

# ── Дитяча ознака, будь-якою мовою напряму ──────────────────────────────────
# Лише цілі слова: підрядок «kid» ловив «Kidruk» (письменник), «клас» —
# «майстер-клас». «Табір»/«obóz» свідомо не тут: у стрічці єпархії це і
# «концентраційний табір», а справжній дитячий табір і так називає дітей.
_CHILD_WORDS = (
    # українська
    r"діти|дітей|дітям|дітьми|дітях|дитин\w*|дитяч\w*|підліт\w*|школяр\w*|"
    r"учні|учнів|учням|учнями|учениц\w*|юнац\w*|малюк\w*|дошкільн\w*|"
    r"молодь|молоді|молоддю|школа|школи|школу|школі|шкіл|"
    # німецька
    r"kinder\w*|jugend\w*|schüler\w*|vorschul\w*|kita|ferienlager|schule|"
    # польська
    r"dzieci\w*|dziecię\w*|dziecko|młodzież\w*|uczni\w*|kolonie|szkoł\w*|szkol\w*|"
    # чеська
    r"děti|dětí|dětsk\w*|mládež\w*|žáci|žák\w*|škol\w*|"
    # іспанська, каталанська
    r"niñ[oa]s|infantil\w*|jóvenes|nens|escola|escuela|"
    # нідерландська
    r"kinderen|jongeren|leerling\w*|"
    # англійська
    r"child\w*|kids|teen\w*|youth|pupils?"
)
_AGE_UNITS = r"р\w*|jahr\w*|lat|let|años|jaar|years?"
CHILD = re.compile(
    rf"(?<!\w)(?:{_CHILD_WORDS})(?!\w)"
    rf"|\b\d{{1,2}}\s*[-–—]\s*\d{{1,2}}\s*(?:{_AGE_UNITS})(?!\w)"
    rf"|(?<!\w)(?:від|ab|od|from)\s+\d{{1,2}}\s*(?:{_AGE_UNITS})(?!\w)",
    re.IGNORECASE)

# Звіт про те, що вже відбулось, — у заголовку. На такий допис модель
# відповіла б «минуло» чи «закрито», а токени вже сплачені.
REPORT_TITLE = re.compile(
    r"відбул(?:ся|ася|ись|ося)|відбувся|пройшл[аио]|пройшов|"
    r"odbył[aoy]?\s+się|odbyły\s+się|"
    r"\bfand(?:en)?\b.{0,80}\bstatt\b|"
    r"\btook\s+place\b|konal[aoy]?\s+se",
    re.IGNORECASE)

# Порожні заголовки WordPress: чернетка, яку опублікували без назви.
_PLACEHOLDER_TITLES = {"авточернетка", "auto draft", "автозбереження", "(без назви)"}

# Службові написи платформ — не текст організації.
_PLATFORM_CUTS = (
    ("Embedded Files", "Google Sites Report abuse"),  # Google Sites
)


# Скільки знаків від початку допису дивитись на дитячу ознаку. У проповіді
# чи зверненні єпископа «діти» трапляються десь посередині мимохідь, а допис
# про табір чи фестиваль називає дітей у заголовку або першому абзаці.
CHILD_HEAD = 700


def is_for_children(text: str, head: int | None = None) -> bool:
    return bool(CHILD.search((text or "")[:head] if head else (text or "")))


def skipped_title(site: dict, title: str) -> bool:
    pattern = site.get("skip_title")
    return bool(pattern and re.search(pattern, title or "", re.IGNORECASE))


def is_report(title: str) -> bool:
    return bool(REPORT_TITLE.search(title or ""))


def clean_title(title: str, text: str) -> str:
    """Заголовок допису; порожній чи службовий — перше речення тексту."""
    t = " ".join((title or "").split())
    if t and t.lower() not in _PLACEHOLDER_TITLES:
        return t[:160]
    first = re.split(r"(?<=[.!?])\s", (text or "").strip(), maxsplit=1)[0]
    return first[:160]


def trim(text: str, start: str | None = None, end: str | None = None) -> str:
    """Текст між маркерами. Маркера нема — з того боку не ріжемо."""
    if start:
        i = text.find(start)
        if i != -1:
            text = text[i + len(start):]
    if end:
        j = text.find(end)
        if j != -1:
            text = text[:j]
    return text.strip()


def page_text(html: str, selector: str | None = None,
              drop: tuple[str, ...] = ()) -> str:
    """Основний текст сторінки: без меню, форм, скриптів і написів платформи.

    `drop` — CSS-селектори, які прибрати до читання тексту (напр. дата
    наступного заняття гуртка, що щотижня інша).
    """
    soup = BeautifulSoup(html or "", "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "form",
                     "svg", "noscript", "iframe", "button"]):
        tag.decompose()
    for sel in drop:
        for el in soup.select(sel):
            el.decompose()
    root = soup.select_one(selector) if selector else None
    text = " ".join((root or soup).get_text(" ").split())
    for start, end in _PLATFORM_CUTS:
        if start in text or end in text:
            text = trim(text, start, end)
    return text


def page_title(html: str) -> str:
    soup = BeautifulSoup(html or "", "lxml")
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        return " ".join(h1.get_text(" ").split())[:160]
    t = soup.find("title")
    return " ".join(t.get_text(" ").split())[:160] if t else ""


# ── Дата наступного заняття в Modern Events Calendar ────────────────────────
_MONTHS = {
    "січ": 1, "лют": 2, "бер": 3, "кві": 4, "тра": 5, "чер": 6,
    "лип": 7, "сер": 8, "вер": 9, "жов": 10, "лис": 11, "гру": 12,
    "jan": 1, "feb": 2, "mär": 3, "mar": 3, "apr": 4, "mai": 5, "may": 5,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "okt": 10, "oct": 10,
    "nov": 11, "dez": 12, "dec": 12,
}


def mec_last_date(html: str) -> date | None:
    """Найпізніша дата в блоці «Дата» події MEC («Вер 28 2026»).

    Для гуртка це наступне заняття; якщо воно в минулому — занять більше
    немає, і сторінку не читаємо.
    """
    soup = BeautifulSoup(html or "", "lxml")
    block = soup.select_one(".mec-single-event-date")
    if not block:
        return None
    text = block.get_text(" ").lower()
    found = []
    for mon, day, year in re.findall(r"([a-zа-яіїєґä]{3})\w*\.?\s+(\d{1,2}),?\s+(\d{4})", text):
        m = _MONTHS.get(mon)
        if m:
            try:
                found.append(date(int(year), m, int(day)))
            except ValueError:
                pass
    for day, mon, year in re.findall(r"(\d{1,2})\.?\s+([a-zа-яіїєґä]{3})\w*\.?\s+(\d{4})", text):
        m = _MONTHS.get(mon)
        if m:
            try:
                found.append(date(int(year), m, int(day)))
            except ValueError:
                pass
    return max(found) if found else None


# ── Розклад UCCI: рядок з календаря до сторінки курсу ───────────────────────
def ucci_calendar(html: str) -> dict[str, list[str]]:
    """Адреса курсу → рядки тижневого розкладу («Субота 10:00-15:00 SCHOOL
    UCCI KIDS School Street Flats, … Dublin 8»).

    На сторінці школи сказано лише «щосуботи», а де й о котрій — у календарі.
    Рядок складаємо зі слів календаря (день тижня з шапки колонки, час, назва,
    адреса) — це слова джерела в іншому порядку. Число в шапці («26 вер.»)
    відкидаємо: воно щотижня інше і змінювало б хеш сирцю.
    """
    soup = BeautifulSoup(html or "", "lxml")
    out: dict[str, list[str]] = {}
    table = soup.find("table")
    if not table:
        return out
    header = [" ".join(th.get_text(" ").split()) for th in table.select("thead th")]
    for row in table.select("tbody tr"):
        for idx, cell in enumerate(row.find_all("td")):
            for card in cell.select(".calendar-event-card"):
                link = card.select_one("a[href]")
                if not link:
                    continue
                day = header[idx].split(" ")[0] if idx < len(header) else ""
                line = f"{day} {' '.join(card.get_text(' ').split())}".strip()
                lines = out.setdefault(_slash(link["href"]), [])
                if line not in lines:
                    lines.append(line)
    return out


def _slash(url: str) -> str:
    return url.rstrip("/") + "/"


# ── Сайти ───────────────────────────────────────────────────────────────────
# name — назва джерела на картці («Джерело: …») і ключ рядка в sources.
# Країну й місто за замовчуванням тримає рядок sources (міграція
# 20260928_diaspora_sites.sql); тест звіряє, що вони не розійшлись.
SITES: list[dict] = [
    {
        "key": "ucci",
        "name": "Український кризовий центр в Ірландії (ucci.ie)",
        "country": "ie", "city": "Дублін",
        "wp": [
            # Курси, студії, табори — сторінки, що живуть роками.
            {"api": "https://ucci.ie/wp-json/wp/v2/our-projects",
             "catalog": True, "fetch_page": True, "selector": "main"},
            {"api": "https://ucci.ie/wp-json/wp/v2/events"},
            {"api": "https://ucci.ie/wp-json/wp/v2/posts"},
        ],
        # Уроки всередині суботньої школи (вокал, мультиплікація…) — частина
        # школи, а не окремі картки: одна суботня школа — одна картка.
        "skip_text": r"^SCHOOL UCCI KIDS\s",
        "calendar": "https://ucci.ie/kalendar/",
    },
    {
        "key": "dresden",
        "name": "Український дім у Дрездені (plattform-dresden.de)",
        "country": "de", "city": "Дрезден",
        # Стрічка лише німецькою; дописи щодня-два, більшість — для дорослих.
        "wp": [{"api": "https://plattform-dresden.de/wp-json/wp/v2/posts"}],
    },
    {
        "key": "oseredok",
        "name": "Український центр «Осередок» у Лейпцигу (oseredok-leipzig.de)",
        "country": "de", "city": "Лейпциг",
        "wp": [
            # Гуртки для дітей (71), для підлітків (562), змішані групи (569)
            # і все з мітками «Діти 0-12» (471) та «Підлітки» (490) —
            # українська версія (Polylang). Це постійні заняття: дату
            # наступного заняття прибираємо з тексту, інакше щотижня новий
            # хеш і нова екстракція тієї самої сторінки.
            {"api": "https://oseredok-leipzig.de/wp-json/wp/v2/mec-events",
             "params": {"lang": "uk", "mec_category": "71,562,569"},
             "catalog": True, "children_only": True, "fetch_page": True,
             "selector": ".mec-single-event", "mec": True,
             "drop": [".mec-single-event-date"]},
            {"api": "https://oseredok-leipzig.de/wp-json/wp/v2/mec-events",
             "params": {"lang": "uk", "tags": "471,490"},
             "catalog": True, "children_only": True, "fetch_page": True,
             "selector": ".mec-single-event", "mec": True,
             "drop": [".mec-single-event-date"]},
            # Решта подій за вікно дат — лише з дитячою ознакою (кінопоказ
            # «з воркшопом для дітей 8+»). Дата тут справжня, лишаємо.
            {"api": "https://oseredok-leipzig.de/wp-json/wp/v2/mec-events",
             "params": {"lang": "uk"}, "fetch_page": True,
             "selector": ".mec-single-event", "mec": True},
        ],
        # Той самий гурток для різних віків — окремі події («Паперове диво,
        # Група 1 (4-6 років)», «…Група 2 (6-8 років)»). Для батька це одна
        # можливість із кількома групами: зливаємо в одну картку.
        "merge_groups": True,
    },
    {
        "key": "rostock",
        "name": "Художня школа Ростока (kunstschule-rostock.de)",
        "country": "de", "city": "Росток",
        # Школа німецька; беремо лише курси «für ukrainische Kinder» —
        # звичайні курси без українського змісту не наші.
        "links": {
            "lists": [
                "https://www.kunstschule-rostock.de/kurse/kinderkurse-4-7-jaehrige",
                "https://www.kunstschule-rostock.de/kurse/kinderkurse-7-10-jaehrige",
                "https://www.kunstschule-rostock.de/kurse/kinderkurse-10-13-jaehrige",
                "https://www.kunstschule-rostock.de/kurse/kurse-fuer-14-bis-18-jaehrige",
                "https://www.kunstschule-rostock.de/kurse/ferienkurse",
            ],
            "follow": r"/kurs/[^\"'#?]*ukrain",
            # Один курс висить у двох вікових переліках — ключ за номером курсу.
            "key": r"/([0-9A-Z]{6,})/?$",
            "trim": ["Kursdetails Kursdetails", "Kurs teilen:"],
        },
        # «(1 Platz aus 10 ist frei)» міняється щотижня — не привід читати знову.
        "volatile": r"\(\d+\s+Pl[aä]tze?\s+aus\s+\d+\s+(?:ist|sind)\s+frei\)|Status:\s*\d+\s+Pl[aä]tze?\s+frei",
    },
    {
        "key": "zuwp",
        "name": "Об'єднання українців у Польщі (ukraincy.org.pl)",
        "country": "pl", "city": None,
        # Кілька дитячих подій на рік (фестиваль дитячих колективів, конкурс
        # писанок) — вікно довге, щоб щорічне потрапило хоч закритим і
        # повернулось плановою перевіркою наступного сезону.
        "wp": [{"api": "https://ukraincy.org.pl/wp-json/wp/v2/posts"}],
        "lookback_days": 180,
    },
    {
        "key": "cerkiew",
        "name": "Вроцлавсько-Кошалінська єпархія УГКЦ (cerkiew.net.pl)",
        "country": "pl", "city": None,
        # REST закритий (401, Kadence Security) — стрічки. «Життя єпархії»:
        # 12 дописів ≈ 10 днів, тож друга сторінка — запас на тижневий обхід.
        # Пошук «табір»/«obóz» тягне табори за кілька місяців.
        "rss": [
            "https://cerkiew.net.pl/kategoria/zycie-eparchii/feed/",
            "https://cerkiew.net.pl/kategoria/zycie-eparchii/feed/?paged=2",
            "https://cerkiew.net.pl/?s=%D1%82%D0%B0%D0%B1%D1%96%D1%80&feed=rss2",
            "https://cerkiew.net.pl/?s=ob%C3%B3z&feed=rss2",
        ],
        "lookback_days": 90,
        # Постійні рубрики єпархії — богословʼя, памʼятні дати, оголошення
        # парафій: дітей там згадують, але можливості для дитини немає.
        "skip_title": (r"ВІРА ЦЕРКВИ|ДЕНЬ НАРОДЖЕННЯ|ДЕНЬ ПОМИНАННЯ|ДУШПАСТИРСЬК|"
                       r"PEŁNI WIARY|Pójdź za Mną|Іди за Мною|НЕДІЛЯ ПО|ПРОПОВІДЬ"),
    },
    {
        "key": "beregynia",
        "name": "Асоціація «Берегиня», Барселона (beregynia.info)",
        "country": "es", "city": "Барселона",
        "pages": [
            # Конкурс україноспіву «Диво-вишиванка» для дітей діаспори.
            ["https://www.beregynia.info/міжнародний-конкурс-україноспіву-диво-вишиванка"],
            # Суботня школа «Мрія» — одна картка.
            ["https://www.beregynia.info/українська-школа-мрія-м-барселона",
             "https://www.beregynia.info/українська-школа-мрія-м-барселона/що-потрібно-для-вступу-в-школу"],
            # Школа мистецтв «Сузір'я» при школі «Мрія».
            ["https://www.beregynia.info/школа-мистецтв-сузіря",
             "https://www.beregynia.info/школа-мистецтв-сузіря/музичне-мистецтво",
             "https://www.beregynia.info/школа-мистецтв-сузіря/образотворче-мистецтво",
             "https://www.beregynia.info/школа-мистецтв-сузіря/хореографічне-мистецтво",
             "https://www.beregynia.info/школа-мистецтв-сузіря/декоративно-ужиткове-мистецтво"],
        ],
    },
    {
        "key": "ridna-shkola-cz",
        "name": "Українська суботня школа «Рідна школа», Чехія (ridnashkola.cz)",
        "country": "cz", "city": None,  # Прага, Острава, Їглава — модель бере з тексту
        "pages": [[
            "https://www.ridnashkola.cz/",
            "https://www.ridnashkola.cz/kalendar/rozklad-navchannia",
        ]],
    },
    {
        "key": "dzherelo-nl",
        "name": "Українська школа «Джерело», Амстердам (ukrainianschool.nl)",
        "country": "nl", "city": "Амстердам",
        # Одна картка на школу: вік і розклад — у «Інформації для батьків»,
        # ціна й семестр — на окремих сторінках, тож читаємо їх разом.
        "pages": [[
            "https://ukrainianschool.nl/інформація-для-батьків",
            "https://ukrainianschool.nl/вартість-навчання",
            "https://ukrainianschool.nl/календар-на-семестр-1",
            "https://ukrainianschool.nl/приєднатися",
        ]],
        "trim": ["Зареєструватись", "Copyright Dzherelo"],
    },
]

SITES_BY_KEY = {s["key"]: s for s in SITES}


# ── Збирання ────────────────────────────────────────────────────────────────
def _item(site: dict, url: str, title: str, text: str, published=None) -> dict:
    body = text[:MAX_TEXT]
    return {
        "source": site["name"],
        "source_url": url,
        "raw_title": title[:160],
        "raw_text": with_published(body, published) if published else body,
    }


def _stable(site: dict, text: str) -> str:
    """Прибирає те, що міняється щотижня без зміни суті (вільні місця)."""
    pattern = site.get("volatile")
    return re.sub(r"\s{2,}", " ", re.sub(pattern, " ", text)).strip() if pattern else text


# ── Групи одного гуртка (Осередок, 28.09.2026) ──────────────────────────────
# «Креативне малювання, Група 1 (6-7 років)», «…Група 2 (7-9 років)»,
# «Українознавство/Група 2. 7-8 роки», «Ментальна арифметика 1 група (7-10
# років)» — той самий гурток, різні вікові групи. Ключ гуртка — назва без
# номера групи, віку й години заняття; збіг ключа — одна картка.
_GROUP_NO = re.compile(r"[,/.]?\s*(?:\bгруп[аи]\s*№?\s*\d+|\d+\s*-?\s*а?\s*груп[аи])\b\.?",
                       re.IGNORECASE)
_AGE_SPAN = re.compile(r"\(?\s*\d+(?:[.,]\d+)?\s*[-–—]\s*\d+\s*(?:р[а-яії]*|years?)?\.?\s*\)?",
                       re.IGNORECASE)
_CLOCK = re.compile(r"\b\d{1,2}:\d{2}\b")


def group_key(title: str) -> str:
    """Назва гуртка без групи, віку й години: ключ для злиття. Чиста функція."""
    t = _GROUP_NO.sub(" ", title or "")
    t = _CLOCK.sub(" ", t)
    t = _AGE_SPAN.sub(" ", t)
    return re.sub(r"[^0-9a-zа-яіїєґ]+", "", t.lower())


def base_title(title: str) -> str:
    """«Паперове диво, Група 1 (4-6 років)» → «Паперове диво»."""
    t = _GROUP_NO.sub(" ", title or "")
    t = _CLOCK.sub(" ", t)
    t = _AGE_SPAN.sub(" ", t)
    return re.sub(r"\s{2,}", " ", t).strip(" ,./–—-")


def _group_no(title: str) -> int:
    m = re.search(r"груп[аи]\s*№?\s*(\d+)|(\d+)\s*-?\s*а?\s*груп", title or "", re.IGNORECASE)
    return int(m.group(1) or m.group(2)) if m else 0


def merge_age_groups(items: list[dict]) -> list[dict]:
    """Групи одного гуртка — одним сирцем. Чиста функція.

    Адреса й дата — від першої групи; текст — сторінки всіх груп підряд, кожна
    під власною назвою зі сайту, тож вік кожної групи лишається словами
    джерела (цитата на вік знайдеться). Одиночні записи не чіпаємо.
    """
    buckets: dict[str, list[dict]] = {}
    order: list[str] = []
    for it in items:
        key = group_key(it["raw_title"]) or it["source_url"]
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(it)
    out = []
    for key in order:
        group = buckets[key]
        if len(group) == 1:
            out.append(group[0])
            continue
        group = sorted(group, key=lambda it: (_group_no(it["raw_title"]), it["raw_title"]))
        share = MAX_TEXT // len(group)
        parts = [f"{it['raw_title']}\n{it['raw_text'][:share]}" for it in group]
        out.append({**group[0],
                    "raw_title": base_title(group[0]["raw_title"]) or group[0]["raw_title"],
                    "raw_text": "\n\n".join(parts)[:MAX_TEXT]})
    return out


async def _get(client: httpx.AsyncClient, url: str, **params) -> httpx.Response | None:
    await asyncio.sleep(DELAY_SECONDS)
    try:
        r = await client.get(url, params=params or None)
        r.raise_for_status()
        return r
    except Exception as e:  # noqa: BLE001 — сайт не відповів: пропуск, не аварія
        logger.warning("діаспора: %s — %s", url, e)
        return None


def _wp_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def keep_wp_entry(entry: dict, query: dict, site: dict, now: datetime,
                  stats: dict) -> tuple[str, str] | None:
    """Чи брати запис WordPress: (заголовок, текст) або None. Чиста функція.

    Відсів іде ДО читання сторінки й до моделі: старий каталог, звіт про
    минуле, запис без дитячої ознаки, урок усередині суботньої школи.
    """
    text = _clean((entry.get("content") or {}).get("rendered") or "")
    title = clean_title(_clean((entry.get("title") or {}).get("rendered") or ""), text)
    if query.get("catalog"):
        modified = _wp_date(entry.get("modified_gmt") or entry.get("modified"))
        if modified and now - modified > timedelta(days=CATALOG_MAX_AGE_DAYS):
            stats["stale"] = stats.get("stale", 0) + 1
            return None
    if is_report(title) or skipped_title(site, title):
        stats["report"] = stats.get("report", 0) + 1
        return None
    head = None if query.get("catalog") else CHILD_HEAD
    if not query.get("children_only") and not is_for_children(f"{title} {text}", head):
        stats["adult"] = stats.get("adult", 0) + 1
        return None
    skip = site.get("skip_text")
    if skip and re.search(skip, text):
        stats["school_part"] = stats.get("school_part", 0) + 1
        return None
    return title, text


async def _wp_items(client, site: dict, now: datetime, stats: dict) -> list[dict]:
    lookback = site.get("lookback_days", DEFAULT_LOOKBACK_DAYS)
    after = (now - timedelta(days=lookback)).strftime("%Y-%m-%dT%H:%M:%S")
    calendar: dict[str, list[str]] = {}
    if site.get("calendar"):
        r = await _get(client, site["calendar"])
        if r is not None:
            calendar = ucci_calendar(r.text)
    items, seen = [], set()
    for query in site["wp"]:
        params = {"per_page": WP_PER_PAGE, **query.get("params", {})}
        if not query.get("catalog"):
            params["after"] = after
        entries = []
        for page in range(1, WP_MAX_PAGES + 1):
            r = await _get(client, query["api"], **params, page=page)
            if r is None:
                break
            try:
                batch = r.json()
            except ValueError:
                break
            if not isinstance(batch, list) or not batch:
                break
            entries.extend(batch)
            total_pages = int(r.headers.get("X-WP-TotalPages") or 1)
            if page >= total_pages:
                break
        stats["seen"] = stats.get("seen", 0) + len(entries)
        for entry in entries:
            link = entry.get("link") or ""
            if not link or link in seen:
                continue
            seen.add(link)
            kept = keep_wp_entry(entry, query, site, now, stats)
            if not kept:
                continue
            title, text = kept
            if query.get("fetch_page"):
                pr = await _get(client, link)
                if pr is None:
                    stats["page_failed"] = stats.get("page_failed", 0) + 1
                    continue
                if query.get("mec"):
                    last = mec_last_date(pr.text)
                    if last and last < now.date():
                        stats["over"] = stats.get("over", 0) + 1
                        continue
                text = page_text(pr.text, query.get("selector"),
                                 tuple(query.get("drop", ()))) or text
            lines = calendar.get(_slash(link))
            if lines:
                # «Розклад» — заголовок самої сторінки календаря, не наш підпис.
                text = f"{text}\n\nРозклад\n" + "\n".join(lines)
            published = None if query.get("catalog") else _wp_date(entry.get("date"))
            items.append(_item(site, link, title, _stable(site, text), published))
    return items


async def _rss_items(client, site: dict, now: datetime, stats: dict) -> list[dict]:
    since = now - timedelta(days=site.get("lookback_days", DEFAULT_LOOKBACK_DAYS))
    items, seen = [], set()
    for feed in site["rss"]:
        r = await _get(client, feed)
        if r is None:
            continue
        soup = BeautifulSoup(r.text, "xml")
        for entry in soup.find_all(["item", "entry"]):
            stats["seen"] = stats.get("seen", 0) + 1
            link = _link(entry)
            if not link or link in seen:
                continue
            seen.add(link)
            dt = _parse_date(entry)
            if dt is not None:
                dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
                if dt < since:
                    stats["old"] = stats.get("old", 0) + 1
                    continue
            body_el = entry.find("encoded") or entry.find(["description", "summary", "content"])
            text = _clean(body_el.get_text() if body_el else "")
            title_el = entry.find("title")
            title = clean_title(title_el.get_text(strip=True) if title_el else "", text)
            if is_report(title) or skipped_title(site, title):
                stats["report"] = stats.get("report", 0) + 1
                continue
            if not is_for_children(f"{title} {text}", CHILD_HEAD):
                stats["adult"] = stats.get("adult", 0) + 1
                continue
            items.append(_item(site, link, title, text, dt))
    return items


async def _link_items(client, site: dict, now: datetime, stats: dict) -> list[dict]:
    cfg = site["links"]
    follow = re.compile(cfg["follow"], re.IGNORECASE)
    key_re = re.compile(cfg["key"]) if cfg.get("key") else None
    targets: dict[str, str] = {}
    for list_url in cfg["lists"]:
        r = await _get(client, list_url)
        if r is None:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.select("a[href]"):
            href = urljoin(str(r.url), a["href"]).split("#")[0]
            if not follow.search(href):
                continue
            m = key_re.search(href) if key_re else None
            targets.setdefault(m.group(1) if m else href, href)
    stats["seen"] = stats.get("seen", 0) + len(targets)
    items = []
    for href in targets.values():
        r = await _get(client, href)
        if r is None:
            stats["page_failed"] = stats.get("page_failed", 0) + 1
            continue
        start, end = (cfg.get("trim") or [None, None])
        text = trim(page_text(r.text), start, end)
        items.append(_item(site, str(r.url), page_title(r.text), _stable(site, text)))
    return items


async def _page_items(client, site: dict, now: datetime, stats: dict) -> list[dict]:
    """Кожна група сторінок — один сирець: перша сторінка дає адресу й
    заголовок, решта дописує те, чого на ній бракує (ціна, розклад)."""
    items = []
    start, end = (site.get("trim") or [None, None])
    for group in site["pages"]:
        stats["seen"] = stats.get("seen", 0) + 1
        parts, first_url, first_title = [], None, ""
        for url in group:
            r = await _get(client, url)
            if r is None:
                continue
            text = trim(page_text(r.text), start, end)
            if not text:
                continue
            title = page_title(r.text)
            if first_url is None:
                first_url, first_title = str(r.url), title
                parts.append(text)
            else:
                parts.append(f"{title}\n{text}" if title else text)
        if not parts:
            stats["page_failed"] = stats.get("page_failed", 0) + 1
            continue
        items.append(_item(site, first_url, first_title, _stable(site, "\n\n".join(parts))))
    return items


async def fetch_site(site: dict, now: datetime | None = None,
                     stats: dict | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    items: list[dict] = []
    async with httpx.AsyncClient(headers=_HEADERS, timeout=25.0,
                                 follow_redirects=True) as client:
        if site.get("wp"):
            items += await _wp_items(client, site, now, stats)
        if site.get("rss"):
            items += await _rss_items(client, site, now, stats)
        if site.get("links"):
            items += await _link_items(client, site, now, stats)
        if site.get("pages"):
            items += await _page_items(client, site, now, stats)
    if site.get("merge_groups"):
        before = len(items)
        items = merge_age_groups(items)
        if before != len(items):
            stats["merged_groups"] = before - len(items)
    logger.info("діаспора %s: %d у чергу (%s)", site["key"], len(items), stats)
    return items


class _SiteScraper:
    """Те, що main.py запускає як «модуль»: один сайт — одне джерело."""

    def __init__(self, site: dict):
        self.site = site
        self.SOURCE_NAME = site["name"]

    async def fetch_all(self) -> list[dict]:
        return await fetch_site(self.site)


def scrapers() -> list[tuple[str, _SiteScraper, str]]:
    """Рядки для main.SCRAPERS: (назва джерела, скрапер, тег)."""
    return [(s["name"], _SiteScraper(s), "diaspora") for s in SITES]


# ── Сухий прогін ────────────────────────────────────────────────────────────
async def _dry_run(only: str | None) -> None:
    sites = [s for s in SITES if not only or only in s["key"]]
    for site in sites:
        stats: dict = {}
        items = await fetch_site(site, stats=stats)
        print(f"\n=== {site['name']} [{site['country']}"
              f"{', ' + site['city'] if site.get('city') else ''}] — "
              f"{len(items)} у чергу; відсів: {stats}")
        for it in items:
            head = it["raw_text"][:220].replace("\n", " ")
            print(f"  • {it['raw_title'][:90]}\n    {it['source_url'][:110]}\n    {head}…")


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    p = argparse.ArgumentParser(description="Сайти діаспори — що зібрали б")
    p.add_argument("--dry-run", action="store_true", help="лише показати, без бази")
    p.add_argument("--only", help="ключ сайту (ucci, dresden, oseredok…)")
    args = p.parse_args()
    asyncio.run(_dry_run(args.only))
