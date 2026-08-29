"""Скрапер shkolyar.org.ua — путівник по гуртках, студіях і школах.

3 206 карток гуртків, усі перелічені в sitemap.xml, місто зашите в URL:
/club/<місто>/<slug>.html. Це найбільший із доступних переліків, але й
найважчий: детальна сторінка важить ~150 КБ, і обійти всі за одну ніч —
це пів гігабайта чужого трафіку й черга модерації, яку неможливо розгребти.

Тому за прогін беремо BATCH карток, а зсув рахуємо від дня року: за ~27
ночей каталог обходиться повністю й починає новий круг. Стану ніде не
тримаємо — зсув відтворюється з дати. Хеш-гейт у raw_items відсіє те, що
не змінилось, тож повторний круг майже нічого не коштує.

⚠️ Модель сайту — платні розміщення. Ми не переносимо їхню добірку як свою:
кожна картка йде у звичайну модерацію, а джерело позначене trust_tier=3 —
при злитті дублів його поля поступаються сайту самої організації.
"""
import asyncio
import datetime
import logging
import re

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Школяр (shkolyar.org.ua)"
BASE = "https://shkolyar.org.ua"
SITEMAP_URL = f"{BASE}/sitemap.xml"

BATCH = 120
DELAY_SECONDS = 0.8

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}

_CITY_RE = re.compile(r"/club/([a-z-]+)/")


async def _club_urls(client: httpx.AsyncClient) -> list[str]:
    r = await client.get(SITEMAP_URL)
    r.raise_for_status()
    locs = re.findall(r"<loc>([^<]+)</loc>", r.text)
    # Сортуємо, щоб порядок не залежав від того, як сайт віддав sitemap:
    # інакше «зсув за днем року» щоночі вказував би на інші картки.
    return sorted(u for u in locs if "/club/" in u and u.endswith(".html"))


def _parse_item(html: str, url: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    if not title:
        return None

    # У «довгих абзацах» сидить і власний опис сайту («Shkolyar.org.ua —
    # путівник по приватним школам…»). Він однаковий на всіх 3 206 сторінках,
    # тож без відсіву кожна друга картка приїхала б із чужою самопрезентацією
    # замість опису гуртка.
    paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    body = " ".join(
        p for p in paras
        if len(p) > 60 and "shkolyar" not in p.lower() and "путівник по" not in p.lower()
    )[:2500]

    city = ""
    m = _CITY_RE.search(url)
    if m:
        city = m.group(1).replace("-", " ")

    parts = [
        title,
        f"Місто: {city}" if city else "",
        body,
        "Картка з путівника shkolyar.org.ua. Набір постійний, дедлайну немає — "
        "вартість і розклад уточнюються в організації.",
    ]
    return {
        "source": SOURCE_NAME,
        "source_url": url,
        "raw_title": title,
        "raw_text": "\n".join(p for p in parts if p)[:4000],
    }


async def fetch_all() -> list[dict]:
    items: list[dict] = []

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            urls = await _club_urls(client)
        except Exception as e:
            logger.error(f"shkolyar.org.ua: sitemap не прочитався ({e})")
            return []

        if not urls:
            return []

        day = datetime.date.today().timetuple().tm_yday
        start = (day * BATCH) % len(urls)
        window = (urls + urls)[start:start + BATCH]
        logger.info(
            f"shkolyar.org.ua: {len(urls)} карток у sitemap, "
            f"беремо {len(window)} починаючи з {start}"
        )

        for url in window:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"shkolyar.org.ua: {url} — {e}")
                continue

            item = _parse_item(r.text, url)
            if item:
                items.append(item)

            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"shkolyar.org.ua: зібрано {len(items)} карток")
    return items
