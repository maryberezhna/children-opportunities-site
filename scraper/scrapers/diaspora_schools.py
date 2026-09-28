"""Скрапер «Освітній Всесвіт» — українські школи діаспори.

Каталог веде МІОК (Міжнародний інститут освіти, культури та зв'язків з
діаспорою, Львівська політехніка) — суботні й недільні школи, освітні центри
та студії, де українські діти за кордоном вчать мову, історію й культуру.

Чому саме він. Це найщільніше зібрання діаспорних шкіл, яке взагалі існує,
і воно українською — на відміну від польських gmina-порталів чи німецьких
Vereine, де довелось би розбирати чужу мову й локальні реєстри.

Технічно (переписано 28.09.2026). Публічного API і sitemap немає, карта
малюється джаваскриптом. Але СТОРІНКА КРАЇНИ (/country/pl) віддає в HTML
випадні списки закладів за розділами — `<select name="schools-select-school">`
з `<option value="{id}">назва</option>`. Тож беремо перелік id саме звідти, а
потім читаємо лише сторінки цих закладів.

Раніше скрапер перебирав /schools/1…800 наосліп і зупинявся після 40 «промахів»
підряд, де промахом був і 404, і школа чужої країни. Це давало три біди:
  • ~800 запитів на прогін до сайту невеликої установи — після такої серії
    сервер перестає відповідати тій самій адресі (28.09.2026 перевірено: після
    кількох сотень запитів — таймаути на всіх піддоменах miok.lviv.ua);
  • перевірка посилання під час екстракції йде з тієї самої машини — і 25.08
    усі 7 знайдених шкіл відхилено як «dead link: ConnectTimeout»;
  • смуга з 40 шкіл у США чи Канаді зупинила б обхід раніше за наші країни,
    а країну вгадували за текстом: польська школа, що згадала Німеччину,
    могла стати німецькою.
Тепер країна відома зі сторінки країни, а запитів — кілька десятків.

Розділи каталогу. «Школи» й «культурно-освітні центри» — наше: там суботні
школи, садочки, дитячі студії. «Вищі студії» (кафедри україністики) й
«наукові установи» — ні: це не можливість для дитини, і на модель їх не
відправляємо зовсім (кожен виклик — гроші).

Картка. Одна постійна можливість на школу (рішення Марії 28.09.2026) —
правило для моделі живе в normalizer.SYSTEM_PROMPT («ДІАСПОРА»). Скрапер
нічого не домальовує: ні вартості, ні віку, яких на сторінці МІОК здебільшого
немає. Такий запис лишається чернеткою, доки людина не допише поле зі сторінки
самої школи, — див. звіт PR.

Запуск без бази й без моделі (лише подивитись, що знайдеться):
    python scrapers/diaspora_schools.py es,nl,it
"""
import asyncio
import logging
import re
import sys
import time

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Освітній Всесвіт (МІОК)"
BASE_URL = "https://vsesvit.miok.lviv.ua"

# Країни напряму: код ISO 3166-1 alpha-2 (так вони лягають у
# opportunities.countries і так само стоять в адресі /country/{код}) → назва,
# як її пише сам каталог у заголовку сторінки країни. Назву звіряємо: якщо
# МІОК змінить адреси, скрапер скаже про це, а не прочитає чужу країну.
#
# 28.09.2026 додано Іспанію, Нідерланди й Італію (рішення Марії): там за
# каталогом 10, 15 і 30 шкіл — більше, ніж у Польщі й Чехії разом.
TARGET_COUNTRIES = {
    "pl": "Польща",
    "de": "Німеччина",
    "cz": "Чехія",
    "es": "Іспанія",
    "nl": "Нідерланди",
    "it": "Італія",
}

# Розділи каталогу, які не про дітей: кафедри україністики в університетах і
# наукові товариства. Решту (школи, культурно-освітні центри і все, що МІОК
# колись додасть) читаємо — новий розділ краще показати моделі, ніж загубити.
ADULT_KINDS = {"high_studio", "science_office"}
KIND_LABELS = {
    "school": "Школи",
    "culture_center": "Культурно-освітні центри",
}

# Бережно до сайту невеликої установи: дві сторінки одночасно, секунда паузи.
CONCURRENCY = 2
DELAY_SECONDS = 1.0
# Власна стеля часу, нижча за SCRAPER_TIMEOUT у main.py (300 с): якщо сайт
# повільний, краще віддати вже прочитане, ніж бути скасованим і втратити все.
TIME_BUDGET_SEC = 240

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9",
}


def parse_country(html: str, code: str) -> list[tuple[int, str, str]]:
    """Заклади зі сторінки країни: [(id, розділ, назва)], без «дорослих» розділів.

    Порожній список і попередження в лог, якщо сторінка не та: заголовок не
    називає очікувану країну (МІОК змінив адреси) або списків немає зовсім
    (змінилась верстка). Мовчки віддати нуль — означало б місяць не знати,
    що джерело зламалось.
    """
    soup = BeautifulSoup(html, "html.parser")
    heading = " ".join(t.get_text(" ", strip=True) for t in soup.find_all(["h1", "title"]))
    expected = TARGET_COUNTRIES.get(code, "")
    if expected and expected not in heading:
        logger.warning("МІОК /country/%s: у заголовку немає «%s» — адреси змінились?",
                       code, expected)
        return []
    selects = soup.select("select.country-school-select")
    if not selects:
        logger.warning("МІОК /country/%s: списків закладів немає — змінилась верстка?", code)
        return []
    out, seen = [], set()
    for sel in selects:
        kind = (sel.get("name") or "").replace("schools-select-", "")
        if kind in ADULT_KINDS:
            continue
        for opt in sel.find_all("option"):
            value = (opt.get("value") or "").strip()
            if not value.isdigit() or int(value) in seen:
                continue
            seen.add(int(value))
            out.append((int(value), kind, opt.get_text(" ", strip=True)))
    return out


def parse_school(html: str, url: str, code: str, kind: str = "school") -> dict | None:
    """Сторінка закладу → сирець для черги екстракції, або None, якщо порожня."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "form"]):
        tag.decompose()

    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    if not title:
        return None

    body = soup.select_one(".section-description") or soup
    text = " ".join(body.get_text(" ").split())

    # Порожні картки (заклад заведено, але нічого не заповнено) не варті
    # виклику LLM: у них лише службові підписи полів без значень.
    if len(text) < 200:
        return None

    country = TARGET_COUNTRIES.get(code, code.upper())
    section = KIND_LABELS.get(kind, kind)
    return {
        "source": SOURCE_NAME,
        "source_url": url,
        "raw_title": title,
        # Країна й розділ — зі сторінки країни в каталозі, лише в іншому
        # порядку. Дублюємо їх у текст явно: сама сторінка школи може назвати
        # країну лише в дужках заголовка, а екстрактор бачить саме raw_text.
        "raw_text": (f"Країна: {country} ({code}). Розділ каталогу: {section}. "
                     f"{title}. {text}")[:8000],
    }


async def _get(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        r = await client.get(url)
    except Exception as e:
        logger.debug("МІОК %s: мережева помилка %s", url, e)
        return None
    if r.status_code != 200 or not r.text:
        logger.debug("МІОК %s: HTTP %s", url, r.status_code)
        return None
    return r.text


async def fetch_all(countries: list[str] | None = None) -> list[dict]:
    codes = [c for c in (countries or TARGET_COUNTRIES) if c in TARGET_COUNTRIES]
    started = time.monotonic()
    found: list[dict] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)
    per_country: dict[str, int] = {}

    async def school(client, sid, code, kind):
        async with semaphore:
            if time.monotonic() - started > TIME_BUDGET_SEC:
                return None
            await asyncio.sleep(DELAY_SECONDS)
            url = f"{BASE_URL}/schools/{sid}"
            html = await _get(client, url)
            return parse_school(html, url, code, kind) if html else None

    async with httpx.AsyncClient(
        timeout=20, follow_redirects=True, headers=_BROWSER_HEADERS
    ) as client:
        listing: list[tuple[int, str, str]] = []
        seen: set[int] = set()
        for code in codes:
            html = await _get(client, f"{BASE_URL}/country/{code}")
            await asyncio.sleep(DELAY_SECONDS)
            rows = parse_country(html, code) if html else []
            if not html:
                logger.warning("МІОК /country/%s не відкрилась — країну пропущено", code)
            for sid, kind, _name in rows:
                if sid not in seen:
                    seen.add(sid)
                    listing.append((sid, code, kind))

        results = await asyncio.gather(*(school(client, sid, code, kind)
                                         for sid, code, kind in listing))
        for (sid, code, _kind), item in zip(listing, results):
            if item:
                found.append(item)
                per_country[code] = per_country.get(code, 0) + 1

    if time.monotonic() - started > TIME_BUDGET_SEC:
        logger.warning("Освітній Всесвіт: вичерпано %s с — решта шкіл дочекається "
                       "наступного обходу", TIME_BUDGET_SEC)
    logger.info("Освітній Всесвіт: %s із %s закладів у цільових країнах (%s)",
                len(found), len(listing),
                ", ".join(f"{c}={per_country.get(c, 0)}" for c in codes))
    return found


if __name__ == "__main__":
    # Сухий прогін: лише сайт МІОК, ні бази, ні моделі.
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    wanted = sys.argv[1].split(",") if len(sys.argv) > 1 else None
    items = asyncio.run(fetch_all(wanted))
    counts: dict[str, int] = {}
    for it in items:
        code = re.search(r"\((\w\w)\)\. Розділ", it["raw_text"]).group(1)
        counts[code] = counts.get(code, 0) + 1
    print(f"\nЗнайдено {len(items)}: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    for it in items:
        print(f"  • {it['raw_title'][:90]} — {it['source_url']}")
