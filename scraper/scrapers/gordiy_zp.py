"""Скрапер gordiy.zp.ua — гуртки Запорізького міського Палацу дитячої та
юнацької творчості.

Запоріжжя в базі порожнє (0 локальних записів), а міський палац — живе
першоджерело: WordPress із окремою сторінкою на кожен гурток (/club/<slug>),
понад два десятки напрямів від тайського боксу до лего-конструювання й
циркової студії; головна оновлювалась у липні 2026-го. Понад 2 000 дітей
на 8 напрямах — за даними міськради.

Та сама дисципліна, що й у firstpalace_kharkiv: запобіжник свіжості перед
обходом (сайт без згадок поточного чи минулого року — не скрапимо), текст
без меню, вартість лишаємо нормалізатору — заклад комунальний, але писати
«безкоштовно» без підтвердження на сторінці не можна.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Запорізький міський ПДЮТ (gordiy.zp.ua)"
BASE = "http://gordiy.zp.ua"
LIST_URL = f"{BASE}/gurtki/"
CITY = "Запоріжжя"
FACILITY = "Міський палац дитячої та юнацької творчості Запорізької міської ради"

DELAY_SECONDS = 0.6
MAX_CLUBS = 100

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


def _club_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.select('a[href*="/club/"]'):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        if href.startswith("/"):
            href = f"{BASE}{href}"
        if not href.startswith(BASE):
            continue
        if href not in seen:
            seen.add(href)
            out.append(href)
    return out


def _item(url: str, html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    if not title:
        return None
    parts = [
        title,
        f"Місто: {CITY}",
        f"Заклад: {FACILITY} — комунальний заклад позашкільної освіти",
        _page_text(html)[:2500],
        "Гурток міського палацу дитячої та юнацької творчості. Набір "
        "постійний, дедлайну немає — розклад, вік і умови участі уточнюйте "
        "на сторінці гуртка або в закладі (запис також через сторінку "
        "«Запис до гуртка» на сайті палацу).",
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
            home = await client.get(BASE)
            home.raise_for_status()
        except Exception as e:
            logger.warning(f"gordiy: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning(
                "gordiy: на головній немає згадок поточного чи минулого року "
                "— джерело виглядає покинутим, записи не збираємо")
            return []

        try:
            listing = await client.get(LIST_URL)
            listing.raise_for_status()
        except Exception as e:
            logger.warning(f"gordiy: список гуртків не відповів ({e})")
            return []

        links = _club_links(listing.text)[:MAX_CLUBS]
        logger.info(f"gordiy: у списку {len(links)} гуртків")

        for url in links:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"gordiy: {url} не відповів ({e}) — пропускаю")
                continue
            item = _item(url, r.text)
            if item:
                items.append(item)
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"gordiy: зібрано {len(items)} гуртків")
    return items
