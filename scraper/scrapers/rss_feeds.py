"""RSS-scraper — keyword-filtered opportunities from Ukrainian education /
civil-society feeds. No credentials.

Reads a curated list of RSS/Atom feeds, keeps recent, keyword-relevant items
(shared keywords.py), and hands them to the AI normalizer for final filtering.
Feeds that 403/404 or return nothing are skipped, never fatal.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import httpx
from bs4 import BeautifulSoup

from keywords import is_relevant

logger = logging.getLogger(__name__)

SOURCE_NAME = "RSS"
LOOKBACK_DAYS = 10
MIN_TEXT_LEN = 80
CONCURRENCY = 4

# Feeds verified live and carrying child/youth opportunities. Prometheus has its
# own dedicated scraper, so it is intentionally not duplicated here.
FEEDS: list[tuple[str, str]] = [
    ("Громадський простір", "https://www.prostir.ua/feed/"),
    ("Освіта.ua", "https://osvita.ua/rss/"),
    ("Освіторія", "https://osvitoria.media/feed/"),
]

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml,application/xml,text/xml,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _clean(html: str) -> str:
    """Strip HTML tags from an RSS description/summary blob."""
    return BeautifulSoup(html or "", "lxml").get_text(" ", strip=True)


def _parse_date(item) -> "datetime | None":
    for tag in ("pubDate", "published", "updated", "dc:date"):
        el = item.find(tag)
        if not el:
            continue
        raw = el.get_text(strip=True)
        if not raw:
            continue
        try:
            return parsedate_to_datetime(raw)
        except (TypeError, ValueError):
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                return None
    return None


def _link(item) -> str:
    link = item.find("link")
    if link:
        href = link.get("href")           # Atom: <link href="...">
        if href:
            return href
        txt = link.get_text(strip=True)   # RSS: <link>...</link>
        if txt:
            return txt
    guid = item.find("guid")
    return guid.get_text(strip=True) if guid else ""


def _parse_feed(xml: str, name: str, since: datetime) -> list[dict]:
    soup = BeautifulSoup(xml, "xml")
    out: list[dict] = []
    for item in soup.find_all(["item", "entry"]):
        title_el = item.find("title")
        title = title_el.get_text(strip=True) if title_el else ""
        desc_el = item.find(["description", "summary", "content"])
        desc = _clean(desc_el.get_text() if desc_el else "")
        text = f"{title}\n\n{desc}".strip()
        if len(text) < MIN_TEXT_LEN or not is_relevant(text):
            continue

        dt = _parse_date(item)
        if dt is not None:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt < since:
                continue

        url = _link(item)
        if not url:
            continue
        out.append({
            "source": name,
            "source_url": url,
            "raw_title": title[:120],
            "raw_text": text[:6000],
        })
    return out


async def fetch_all() -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    seen: set[str] = set()
    results: list[dict] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient(headers=_BROWSER, timeout=25.0, follow_redirects=True) as client:

        async def _fetch(name: str, url: str):
            async with semaphore:
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                except Exception as e:
                    logger.warning("RSS %s: %s", name, e)
                    return
                items = _parse_feed(r.text, name, since)
                for it in items:
                    if it["source_url"] in seen:
                        continue
                    seen.add(it["source_url"])
                    results.append(it)
                logger.info("RSS %s: %d relevant", name, len(items))

        await asyncio.gather(*[_fetch(n, u) for n, u in FEEDS])

    logger.info("RSS: %d relevant items across %d feeds", len(results), len(FEEDS))
    return results
