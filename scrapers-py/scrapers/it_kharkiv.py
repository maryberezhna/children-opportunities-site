"""Скрапер IT Kharkiv Cluster — події для школярів та дітей.

Сайт: https://it-kharkiv.com/events
Логіка: обходимо сторінки /events?page=N, знаходимо картки подій,
фільтруємо за ключовими словами, далі нормалізуємо через AI.
"""
import asyncio
import logging
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "IT Kharkiv Cluster"
BASE_URL = "https://it-kharkiv.com"
LIST_URL = "https://it-kharkiv.com/events"

# Ключові слова для фільтрації — шукаємо в назві або описі події
CHILDREN_KEYWORDS = [
    "школяр", "школьник", "учень", "учні",
    "діти", "дитин", "дитяч",
    "підліт", "підлітк",
    "7 клас", "8 клас", "9 клас", "10 клас", "11 клас",
    "junior", "youth",
    "для молоді",
    "для дітей",
    "старшокласник",
    "конкурс для",
    "олімпіад",
    "techtalent", "hackathon дітей",
]


def is_children_event(title: str, description: str = "") -> bool:
    text = (title + " " + description).lower()
    return any(kw in text for kw in CHILDREN_KEYWORDS)


async def fetch_event_links(client: httpx.AsyncClient) -> list[str]:
    """Збирає посилання на всі події з усіх сторінок."""
    links = []
    page = 1
    while True:
        url = LIST_URL if page == 1 else f"{LIST_URL}?page={page}"
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except Exception as e:
            logger.warning(f"IT Kharkiv: failed to fetch page {page}: {e}")
            break

        soup = BeautifulSoup(resp.text, "lxml")
        cards = soup.select("a[href*='/events/ua/']")
        if not cards:
            break

        page_links = list({
            (c["href"] if c["href"].startswith("http") else BASE_URL + c["href"])
            for c in cards
            if c.get("href")
        })
        links.extend(page_links)

        # Перевіряємо чи є наступна сторінка
        next_btn = soup.select_one("a[href*='?page='], a[rel='next']")
        has_next = next_btn and f"page={page + 1}" in (next_btn.get("href") or "")
        if not has_next:
            break
        page += 1

    return list(set(links))


async def fetch_event_detail(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title_tag = soup.select_one("h1")
        title = title_tag.get_text(strip=True) if title_tag else ""

        # Основний текст події
        content = (
            soup.select_one("article")
            or soup.select_one("main")
            or soup.select_one(".event-content")
            or soup.select_one("body")
        )
        text = content.get_text(separator="\n", strip=True)[:6000] if content else ""

        if not is_children_event(title, text[:500]):
            return None

        return {
            "source": SOURCE_NAME,
            "source_url": url,
            "raw_title": title,
            "raw_text": f"Подія від {SOURCE_NAME}.\n\n{text}",
        }
    except Exception as e:
        logger.warning(f"IT Kharkiv: failed to fetch {url}: {e}")
        return None


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 ChildrenOppBot/1.0 (+https://dityam.com.ua)"},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        links = await fetch_event_links(client)
        logger.info(f"IT Kharkiv: знайдено {len(links)} посилань")

        semaphore = asyncio.Semaphore(3)

        async def guarded(url):
            async with semaphore:
                return await fetch_event_detail(client, url)

        results = await asyncio.gather(*[guarded(url) for url in links])
        found = [r for r in results if r]
        logger.info(f"IT Kharkiv: {len(found)} подій для дітей")
        return found
