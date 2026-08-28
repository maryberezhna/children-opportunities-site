"""Скрапер cprs.kiev.ua — Центр позашкільної роботи Святошинського району Києва.

Локальний і вузький, але саме такі центри дають те, чого немає у великих
переліках: безкоштовні гуртки поруч із домом. Той самий тип джерела, що вже
є в хабах — ctdu-kiev.com.ua та oman.lviv.ua.

⚠️ Сайт віддає сторінки у windows-1251, а заголовка про це в HTTP немає.
Без явного декодування httpx вгадує utf-8, і весь український текст
перетворюється на сміття — картки доїхали б до модерації порожніми.
"""
import asyncio
import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "ЦПР Святошинського району (cprs.kiev.ua)"
BASE = "https://cprs.kiev.ua"
LIST_URL = f"{BASE}/hobby-groups/"

MAX_PAGES = 20
DELAY_SECONDS = 0.7
ENCODING = "windows-1251"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _parse_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []

    for art in soup.select("article"):
        link = art.select_one("h2 a[href]")
        if not link:
            continue
        href = (link.get("href") or "").strip()
        title = link.get_text(" ", strip=True)
        # Беремо лише картки гуртків: у стрічці поруч живуть новини й сторінки.
        if not href.startswith("/section/") or "/group-" not in href or not title:
            continue

        descr = ""
        box = art.select_one(".entry-box p")
        if box:
            descr = box.get_text(" ", strip=True)

        parts = [
            title,
            descr,
            "Гурток Центру позашкільної роботи Святошинського району Києва. "
            "Набір постійний, дедлайну немає — розклад і умови уточнюються в центрі.",
        ]
        out.append({
            "source": SOURCE_NAME,
            "source_url": f"{BASE}{href}",
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
            url = LIST_URL if page == 1 else f"{LIST_URL}?PAGEN_1={page}"
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"cprs.kiev.ua: сторінка {page} не відповіла ({e})")
                break

            html = r.content.decode(ENCODING, errors="replace")
            fresh = [it for it in _parse_page(html) if it["source_url"] not in seen]
            if not fresh:
                break
            for it in fresh:
                seen.add(it["source_url"])
            items.extend(fresh)

            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"cprs.kiev.ua: зібрано {len(items)} гуртків")
    return items
