"""Скрапер UWC Ukraine — щорічний конкурс стипендій у міжнародні коледжі.

ukraine.uwc.org — національний комітет United World Colleges: один набір на
рік для підлітків ~14–17, стипендії на 2 роки навчання в коледжах UWC по
світу. Це не стрічка новин, а одна флагманська можливість, тож скрапер
навмисно крихітний: лише сторінка подачі (/apply/).

Запобіжник свіжості (урок 01.09.2026 — застаріле джерело гірше за порожнє
місце): якщо на сторінці подачі немає згадки поточного або наступного року,
набір не відкритий або сторінка покинута — повертаємо порожньо і пишемо в
лог, а не тягнемо в каталог торішній конкурс.

www.uwc.org.ua (старий домен) сидить за Cloudflare і віддає 403 — сюди не
ходимо. ukraine.uwc.org відповідає звичайному клієнту.
"""
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "UWC Ukraine"
BASE = "https://ukraine.uwc.org"
PAGES = [f"{BASE}/apply/"]

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _fresh(text: str) -> bool:
    year = datetime.now(timezone.utc).year
    return any(str(y) in text for y in (year, year + 1))


async def fetch_all() -> list[dict]:
    items: list[dict] = []
    async with httpx.AsyncClient(headers=_BROWSER, timeout=30.0,
                                 follow_redirects=True) as client:
        for url in PAGES:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
            except Exception as e:
                logger.warning(f"UWC page failed {url}: {e}")
                continue

            soup = BeautifulSoup(resp.text, "lxml")
            main = (soup.select_one("main") or soup.select_one("article")
                    or soup.select_one("body"))
            text = main.get_text("\n", strip=True)[:6000] if main else ""
            if not text:
                continue
            if not _fresh(text):
                logger.warning(
                    f"UWC {url}: немає згадки поточного/наступного року — "
                    "схоже, набір не відкритий; сторінку пропущено")
                continue

            title_tag = soup.select_one("h1")
            title = title_tag.get_text(strip=True) if title_tag else "UWC Ukraine"
            items.append({
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": f"UWC Ukraine — {title}",
                "raw_text": (
                    "Стипендії UWC для українських підлітків: дворічне навчання "
                    "в міжнародних коледжах United World Colleges за кордоном, "
                    "національний відбір раз на рік.\n\n" + text
                ),
            })
    return items
