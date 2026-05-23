"""Скрапер за ключовими словами — шукає нові можливості для дітей на відомих сайтах.

Стратегія: для кожного сайту є URL пошуку або каталогу + фільтр за ключовими словами.
Підтримувані джерела:
  - osvita.ua (новини освіти)
  - din.gov.ua (Міністерство — розділ новини/конкурси)
  - mon.gov.ua/ua/news (МОН)
  - Дія — розділ «Пільги та виплати»
  - МЦФЕР — конкурси для школярів
"""
import asyncio
import logging
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

# Ключові слова для фільтрації знайдених сторінок
KEYWORDS = [
    "школяр", "школяри", "учень", "учні", "учнів",
    "діти", "дитин", "для дітей",
    "підліт", "підлітки",
    "старшокласник", "школах",
    "для дітей", "для юних",
    "конкурс для", "олімпіад",
]

# Пошукові точки входу: (назва, list_url, css-селектор для посилань на статті/події)
SOURCES = [
    {
        "name": "Освіта.UA — новини",
        "url": "https://osvita.ua/news/",
        "link_selector": "a.news-item__link, a.article__link, h2 a, h3 a",
        "base": "https://osvita.ua",
    },
    {
        "name": "МОН — новини",
        "url": "https://mon.gov.ua/ua/news",
        "link_selector": "a.news-list__link, .news-item a, h2 a, h3 a",
        "base": "https://mon.gov.ua",
    },
    {
        "name": "МОН — заходи",
        "url": "https://mon.gov.ua/ua/events",
        "link_selector": "a.events-list__link, .event-item a, h2 a, h3 a",
        "base": "https://mon.gov.ua",
    },
    {
        "name": "МЦФЕР — конкурси",
        "url": "https://mcfr.com.ua/competitions",
        "link_selector": "a[href*='competition'], a[href*='contest'], h2 a, h3 a",
        "base": "https://mcfr.com.ua",
    },
]

# Пошукові запити для DuckDuckGo HTML (без JS)
SEARCH_QUERIES = [
    "site:osvita.ua школярі конкурс 2026",
    "site:mon.gov.ua конкурс для школярів 2026",
    "site:mcfr.com.ua конкурс учні",
    "site:ukrinform.ua конкурс діти школярі 2026",
]
DDG_URL = "https://html.duckduckgo.com/html/"


def contains_keyword(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in KEYWORDS)


async def fetch_page_links(
    client: httpx.AsyncClient, source: dict
) -> list[dict]:
    """Завантажує список сторінок і повертає посилання, які стосуються дітей."""
    try:
        resp = await client.get(source["url"])
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"{source['name']}: list fetch failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    results = []
    for a in soup.select(source["link_selector"]):
        href = a.get("href", "")
        if not href or href.startswith("#"):
            continue
        full = href if href.startswith("http") else urljoin(source["base"], href)
        title = a.get_text(strip=True)
        if title and contains_keyword(title):
            results.append({"url": full, "title": title, "source": source["name"]})

    logger.info(f"{source['name']}: знайдено {len(results)} релевантних посилань")
    return results


async def search_ddg(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Шукає через DuckDuckGo HTML-версію."""
    try:
        resp = await client.post(
            DDG_URL,
            data={"q": query, "b": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"DDG search '{query}': failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    results = []
    for result in soup.select(".result__a"):
        href = result.get("href", "")
        title = result.get_text(strip=True)
        if href.startswith("http") and contains_keyword(title):
            results.append({"url": href, "title": title, "source": "DuckDuckGo"})
    return results[:10]


async def fetch_detail(
    client: httpx.AsyncClient, item: dict
) -> Optional[dict]:
    """Завантажує повний текст сторінки для нормалізації."""
    try:
        resp = await client.get(item["url"])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title_tag = soup.select_one("h1")
        title = title_tag.get_text(strip=True) if title_tag else item["title"]

        content = (
            soup.select_one("article")
            or soup.select_one("main")
            or soup.select_one(".content")
            or soup.select_one("body")
        )
        text = content.get_text(separator="\n", strip=True)[:6000] if content else ""

        if not contains_keyword(title + " " + text[:1000]):
            return None

        return {
            "source": item["source"],
            "source_url": item["url"],
            "raw_title": title,
            "raw_text": text,
        }
    except Exception as e:
        logger.warning(f"Detail fetch failed {item['url']}: {e}")
        return None


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 ChildrenOppBot/1.0 (+https://dityam.com.ua)"},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        # 1. Сканування списків з відомих джерел
        list_tasks = [fetch_page_links(client, s) for s in SOURCES]
        list_results = await asyncio.gather(*list_tasks)
        candidates = [item for batch in list_results for item in batch]

        # 2. DuckDuckGo пошук
        ddg_tasks = [search_ddg(client, q) for q in SEARCH_QUERIES]
        ddg_results = await asyncio.gather(*ddg_tasks)
        candidates += [item for batch in ddg_results for item in batch]

        # Унікальність по URL
        seen = set()
        unique = []
        for item in candidates:
            if item["url"] not in seen:
                seen.add(item["url"])
                unique.append(item)

        logger.info(f"Keyword search: {len(unique)} унікальних кандидатів")

        # 3. Завантаження деталей
        semaphore = asyncio.Semaphore(3)

        async def guarded(item):
            async with semaphore:
                await asyncio.sleep(0.5)
                return await fetch_detail(client, item)

        details = await asyncio.gather(*[guarded(i) for i in unique])
        found = [d for d in details if d]
        logger.info(f"Keyword search: {len(found)} результатів після фільтрації")
        return found
