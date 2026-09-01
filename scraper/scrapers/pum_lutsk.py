"""Скрапер pum-lutsk.org — набір у гуртки Палацу учнівської молоді Луцька.

Луцьк у базі порожній. ПУМ — комунальний заклад із 1945 року, 50+ гуртків
для дітей 4–18 років; сайт живий (новини за серпень 2026). Першоджерело,
trust_tier=2.

Розмітка: WordPress із ?page_id=N. Сторінки гуртків, куди ЗАРАЗ іде набір,
зібрані підпунктами меню «Набір дітей» — саме їх і беремо: це чинний набір,
а не архівні сторінки колективів із розділу «Колективи» (там історія,
перемоги й випускники, а не запрошення).

Запобіжник свіжості — стандартний для палацових скраперів: головна без
згадок поточного чи минулого року → джерело не скрапимо, warning у лог.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Палац учнівської молоді Луцька (pum-lutsk.org)"
BASE = "https://www.pum-lutsk.org"
CITY = "Луцьк"
FACILITY = "КЗ «Палац учнівської молоді Луцької міської ради»"

DELAY_SECONDS = 0.6
MAX_CLUBS = 80

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _is_fresh(home_html: str) -> bool:
    year = datetime.now(timezone.utc).year
    return str(year) in home_html or str(year - 1) in home_html


def _menu_club_links(html: str) -> list[tuple[str, str]]:
    """(url, назва) з підменю пункту «Набір дітей»."""
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a"):
        if "набір дітей" in a.get_text(strip=True).lower():
            li = a.find_parent("li")
            if not li:
                continue
            out, seen = [], set()
            for sub in li.select("ul a[href]"):
                href = (sub.get("href") or "").strip()
                title = sub.get_text(" ", strip=True)
                if not href or href in seen or "page_id" not in href:
                    continue
                # Сам пункт «Набір дітей» теж трапляється в підменю —
                # це сторінка-обкладинка, а не гурток.
                if title.lower() == "набір дітей":
                    continue
                seen.add(href)
                out.append((href, title))
            if out:
                return out
    return []


def _page_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "form", "aside"]):
        tag.decompose()
    root = soup.select_one(".entry-content") or soup.select_one("main") or soup.body or soup
    text = root.get_text("\n", strip=True)
    lines, prev = [], None
    for line in (l.strip() for l in text.split("\n")):
        if line and line != prev:
            lines.append(line)
        prev = line
    return "\n".join(lines)


async def fetch_all() -> list[dict]:
    items: list[dict] = []

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            home = await client.get(BASE)
            home.raise_for_status()
        except Exception as e:
            logger.warning(f"pum-lutsk: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning("pum-lutsk: на головній немає згадок поточного чи "
                           "минулого року — джерело виглядає покинутим")
            return []

        links = _menu_club_links(home.text)[:MAX_CLUBS]
        logger.info(f"pum-lutsk: у меню «Набір дітей» {len(links)} гуртків")

        for url, menu_title in links:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"pum-lutsk: {url} не відповів ({e}) — пропускаю")
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1")
            title = (h1.get_text(" ", strip=True) if h1 else "") or menu_title
            parts = [
                title,
                f"Місто: {CITY}",
                f"Заклад: {FACILITY} — комунальний заклад позашкільної освіти",
                _page_text(r.text)[:2500],
                "Гурток Палацу учнівської молоді, триває набір. Дедлайну немає "
                "— розклад, вік і умови участі уточнюйте на сторінці гуртка "
                "або в закладі.",
            ]
            items.append({
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": title,
                "raw_text": "\n".join(p for p in parts if p)[:4000],
            })
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"pum-lutsk: зібрано {len(items)} гуртків")
    return items
