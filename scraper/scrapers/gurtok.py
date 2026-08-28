"""Скрапер gurtok.org — всеукраїнський перелік гуртків і студій.

Чому саме він. У нас найслабша категорія — гуртки: постійний набір, без
дедлайну, найчастіше поруч із домом. Саме цього шукає батько, який щойно
привів дитину до школи, і саме цього в нас майже немає. gurtok.org тримає
понад 600 гуртків від ~130 організацій із віковими межами й позначкою
«безкоштовні / платні» — тобто рівно ті поля, які нам потрібні.

Це агрегатор, не першоджерело, тож trust_tier=3: у злитті дублів його поля
поступаються сайту самої організації.

Розмітка списку чиста і стабільна:
  .one_item → .org_name (назва + лінк на /gurtok/<slug>)
            → .years (вік), .work_days (дні), .short_descr, .price_type

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

        years = _text(card.select_one(".years"))
        days = _text(card.select_one(".work_days"))
        descr = _text(card.select_one(".short_descr"))
        price = _text(card.select_one(".price_type"))
        org = _text(card.select_one(".organization_info .org_name"))

        parts = [
            title,
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
