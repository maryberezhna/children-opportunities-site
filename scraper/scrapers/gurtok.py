"""Скрапер gurtok.org — перелік гуртків і студій ЖИТОМИРА.

⚠️ Попри всеукраїнський вигляд сайту, це міський перелік: фільтр «регіон»
у них — це райони Житомира (Центр, Богунія, Крошня, Мальованка, Поділ), і
47 із 50 перевірених координат лежать у межах міста. Тому не варто чекати
звідси покриття інших міст — воно все житомирське.

Чому все одно беремо. У нас найслабша категорія — гуртки: постійний набір,
без дедлайну, найчастіше поруч із домом. Саме цього шукає батько, який щойно
привів дитину до школи, і саме цього в нас майже немає. 696 гуртків від 144
організацій із віковими межами й позначкою «безкоштовні / платні» роблять
Житомир найкраще покритим містом на сайті.

Це агрегатор, не першоджерело, тож trust_tier=3: у злитті дублів його поля
поступаються сайту самої організації.

Розмітка списку чиста і стабільна:
  .one_item → .org_name (назва + лінк на /gurtok/<slug>)
            → .years (вік), .work_days (дні), .short_descr, .price_type
            → .marker[data-lat/data-lng] — координати

Міста в картці немає жодним текстом — тільки координати на прихованому
маркері для мапи. Без них 696 записів приїхали б без міста взагалі, а місто
в нас основний фільтр. Тому переводимо координати в назву міста за
рамками нижче: це детерміновано й перевіряється очима, на відміну від
здогадок LLM за парою чисел.

Пагінація — ?page=N. Сторінки за останньою не віддають 404, а повторюють
останню, тож зупиняємось не за кодом відповіді, а коли сторінка не принесла
жодного нового URL.
"""
import asyncio
import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Гурток (gurtok.org)"
BASE = "https://gurtok.org"
LIST_URL = f"{BASE}/gurtki"

# Стеля на випадок, якщо пагінація колись почне віддавати нові URL нескінченно.
MAX_PAGES = 80
# Пауза між сторінками: 600+ карток по 12 на сторінку — це ~50 запитів,
# і робити їх упритул до чужого сайту неввічливо.
DELAY_SECONDS = 0.7

# Рамки міст: (мін. широта, макс. широта, мін. довгота, макс. довгота).
# Свідомо широкі — краще не визначити місто, ніж приписати сусіднє.
CITY_BOUNDS = (
    ("Житомир", 50.20, 50.34, 28.55, 28.80),
    ("Київ", 50.35, 50.60, 30.25, 30.85),
    ("Львів", 49.75, 49.92, 23.90, 24.15),
    ("Харків", 49.90, 50.12, 36.10, 36.45),
    ("Одеса", 46.35, 46.62, 30.60, 30.88),
    ("Дніпро", 48.35, 48.58, 34.88, 35.18),
    ("Вінниця", 49.16, 49.32, 28.38, 28.56),
    ("Запоріжжя", 47.75, 47.92, 35.02, 35.32),
    ("Полтава", 49.52, 49.66, 34.46, 34.68),
    ("Чернігів", 51.44, 51.56, 31.20, 31.40),
    ("Черкаси", 49.36, 49.50, 31.96, 32.14),
    ("Рівне", 50.56, 50.68, 26.16, 26.32),
    ("Луцьк", 50.68, 50.80, 25.22, 25.42),
    ("Тернопіль", 49.50, 49.62, 25.50, 25.70),
    ("Хмельницький", 49.36, 49.48, 26.92, 27.08),
    ("Суми", 50.84, 50.98, 34.70, 34.88),
    ("Івано-Франківськ", 48.86, 48.98, 24.62, 24.80),
    ("Ужгород", 48.56, 48.66, 22.22, 22.38),
    ("Миколаїв", 46.88, 47.05, 31.88, 32.12),
    ("Кропивницький", 48.45, 48.57, 32.18, 32.34),
    ("Чернівці", 48.22, 48.36, 25.86, 26.04),
)


def _city_from_coords(lat: str, lng: str) -> str:
    """Назва міста або порожній рядок. Точка поза всіма рамками лишається
    без міста свідомо: у частини карток координати явно сміттєві (кілька
    вказують аж на Москву), і приписати їм навмання найближче українське
    місто гірше, ніж не приписати нічого."""
    try:
        a, b = float(lat), float(lng)
    except (TypeError, ValueError):
        return ""
    for name, lat_min, lat_max, lng_min, lng_max in CITY_BOUNDS:
        if lat_min <= a <= lat_max and lng_min <= b <= lng_max:
            return name
    return ""


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def _parse_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []

    for card in soup.select(".one_item"):
        link = card.select_one("a.org_name")
        if not link:
            continue
        href = (link.get("href") or "").strip()
        title = _text(link)
        if not href or not title:
            continue

        marker = card.select_one(".marker")
        city = _city_from_coords(
            marker.get("data-lat") if marker else None,
            marker.get("data-lng") if marker else None,
        )

        years = _text(card.select_one(".years"))
        days = _text(card.select_one(".work_days"))
        descr = _text(card.select_one(".short_descr"))
        price = _text(card.select_one(".price_type"))
        org = _text(card.select_one(".organization_info .org_name"))

        parts = [
            title,
            f"Місто: {city}" if city else "",
            f"Організація: {org}" if org else "",
            f"Вік: {years}" if years else "",
            f"Дні занять: {days}" if days else "",
            f"Вартість: {price}" if price else "",
            descr,
            "Гурток із переліку gurtok.org. Набір постійний, дедлайну немає — "
            "умови й контакти уточнюються в організації.",
        ]
        out.append({
            "source": SOURCE_NAME,
            "source_url": f"{BASE}{href}" if href.startswith("/") else href,
            "raw_title": title,
            "raw_text": "\n".join(p for p in parts if p)[:4000],
        })

    return out


async def fetch_all() -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        for page in range(1, MAX_PAGES + 1):
            try:
                r = await client.get(LIST_URL, params={"page": page})
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"gurtok.org: сторінка {page} не відповіла ({e}) — зупиняємось")
                break

            fresh = [it for it in _parse_page(r.text) if it["source_url"] not in seen]
            if not fresh:
                # Або сторінок більше немає, або сайт повторює останню.
                break
            for it in fresh:
                seen.add(it["source_url"])
            items.extend(fresh)

            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"gurtok.org: зібрано {len(items)} гуртків")
    return items
