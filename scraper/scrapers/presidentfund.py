"""Скрапер presidentfund.gov.ua — програми Фонду Президента України з
підтримки освіти, науки та спорту.

Навіщо. Після вимкнення гурткових джерел фокус наповнення — дефіцитні
категорії: стипендії, гранти, обміни (~5% бази). Фонд — державне
ПЕРШОДЖЕРЕЛО саме цього: стипендії Президента школярам (10 000 грн/міс за
НМТ 185+, до 25 000 грн/міс призерам міжнародних олімпіад), премії,
програми на кшталт Youth Connect. Сайт живий: новини за серпень 2026.

Розмітка: /programs/filter/actual/ і /programs/filter/scholarships/ —
переліки карток із лінками /programs/<slug>/; вся суть на сторінці
програми. Частина програм — для викладачів чи університетів, не для
дітей: їх свідомо ВІДДАЄМО далі як є — відсіювання нерелевантного за
віком і суттю робить нормалізатор та модерація, а не скрапер.

Запобіжник свіжості — стандартний для наших скраперів-першоджерел.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Фонд Президента України (presidentfund.gov.ua)"
BASE = "https://presidentfund.gov.ua"
LIST_URLS = [
    f"{BASE}/programs/filter/actual/",
    f"{BASE}/programs/filter/scholarships/",
]

DELAY_SECONDS = 0.6
MAX_PROGRAMS = 40

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
    root = soup.select_one("main") or soup.body or soup
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
        # /programs/filter/... — сторінки-переліки, не програми.
        if not href.startswith(f"{BASE}/programs/") or "/filter/" in href:
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
            home = await client.get(BASE)
            home.raise_for_status()
        except Exception as e:
            logger.warning(f"presidentfund: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning("presidentfund: на головній немає згадок поточного чи "
                           "минулого року — джерело виглядає покинутим")
            return []

        links: list[str] = []
        for list_url in LIST_URLS:
            try:
                r = await client.get(list_url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"presidentfund: перелік {list_url} не відповів ({e})")
                continue
            for href in _program_links(r.text):
                if href not in links:
                    links.append(href)
            await asyncio.sleep(DELAY_SECONDS)

        logger.info(f"presidentfund: у переліках {len(links)} програм")

        for url in links[:MAX_PROGRAMS]:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"presidentfund: {url} не відповів ({e}) — пропускаю")
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            # На сторінках програм фонду немає ЖОДНОГО h1–h6 — назва живе
            # лише в <title> вигляду «Назва - Програми - Фонд Президента…».
            h1 = soup.find("h1")
            title = h1.get_text(" ", strip=True) if h1 else ""
            if not title and soup.title:
                title = soup.title.get_text(" ", strip=True).split(" - ")[0].strip()
            if not title:
                continue
            parts = [
                title,
                "Місто: Вся Україна",
                "Організатор: Фонд Президента України з підтримки освіти, "
                "науки та спорту — державна установа",
                _page_text(r.text)[:2800],
            ]
            items.append({
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": title,
                "raw_text": "\n".join(p for p in parts if p)[:4000],
            })
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"presidentfund: зібрано {len(items)} програм")
    return items
