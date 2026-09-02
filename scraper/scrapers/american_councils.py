"""Скрапер americancouncils.org.ua — програми обмінів American Councils.

Навіщо. Обміни — одна з найдефіцитніших категорій бази (19 записів), при
тому що це найцінніший тип «треба встигнути»: FLEX (рік у США з повною
стипендією) і High School in America — для школярів 8–11 класів, набори
щорічні й відкриваються восени. American Councils — операторська
організація цих програм в Україні, тобто першоджерело.

Розмітка: /programs/ — перелік із лінками /programs/<slug>/ (~10 програм,
частина для викладачів/випускників — відсіювання за релевантністю робить
нормалізатор і модерація, не скрапер).

Запобіжник свіжості тут дивиться на /news/, а не на головну: головна в
них — статичний лендинг без дат, і за нею живість сайту не видно.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "American Councils Ukraine (americancouncils.org.ua)"
BASE = "https://americancouncils.org.ua"
LIST_URL = f"{BASE}/programs/"
NEWS_URL = f"{BASE}/news/"

DELAY_SECONDS = 0.6
MAX_PROGRAMS = 25

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _is_fresh(html: str) -> bool:
    year = datetime.now(timezone.utc).year
    return str(year) in html or str(year - 1) in html


def _page_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "form", "aside"]):
        tag.decompose()
    root = soup.select_one("main, article, .entry-content") or soup.body or soup
    text = root.get_text("\n", strip=True)
    lines, prev = [], None
    for line in (l.strip() for l in text.split("\n")):
        if line and line != prev:
            lines.append(line)
        prev = line
    return "\n".join(lines)


def _program_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.select('a[href*="/programs/"]'):
        href = (a.get("href") or "").strip()
        if href.startswith("/"):
            href = f"{BASE}{href}"
        if not href.startswith(f"{BASE}/programs/"):
            continue
        href = href.split("#")[0].split("?")[0]
        if href.rstrip("/") == f"{BASE}/programs" or href in seen:
            continue
        seen.add(href)
        out.append(href)
    return out


async def fetch_all() -> list[dict]:
    items: list[dict] = []

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            news = await client.get(NEWS_URL)
            news.raise_for_status()
        except Exception as e:
            logger.warning(f"american-councils: /news/ не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(news.text):
            logger.warning("american-councils: у новинах немає згадок поточного "
                           "чи минулого року — джерело виглядає покинутим")
            return []

        try:
            listing = await client.get(LIST_URL)
            listing.raise_for_status()
        except Exception as e:
            logger.warning(f"american-councils: перелік програм не відповів ({e})")
            return []

        links = _program_links(listing.text)[:MAX_PROGRAMS]
        logger.info(f"american-councils: у переліку {len(links)} програм")

        for url in links:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"american-councils: {url} не відповів ({e}) — пропускаю")
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1")
            title = h1.get_text(" ", strip=True) if h1 else ""
            if not title:
                continue
            parts = [
                title,
                "Організатор: American Councils for International Education "
                "(представництво в Україні) — оператор програм обмінів, зокрема "
                "FLEX і High School in America",
                _page_text(r.text)[:2800],
            ]
            items.append({
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": title,
                "raw_text": "\n".join(p for p in parts if p)[:4000],
            })
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"american-councils: зібрано {len(items)} програм")
    return items
