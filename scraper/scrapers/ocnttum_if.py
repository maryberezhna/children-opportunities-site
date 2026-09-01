"""Скрапер ocnttum.if.ua — гуртки Івано-Франківського обласного центру
науково-технічної творчості учнівської молоді (ОДЦНТТУМ).

Західна Україна в базі майже порожня, а це найживіше знайдене джерело
Івано-Франківська: 32 згадки 2026 року на головній, гуртки від
авіамоделювання й операторів БПЛА до робототехніки на Arduino — і все
безкоштовно (державний заклад позашкільної освіти, на сайті це прямо
написано). Першоджерело, trust_tier=2.

Розмітка нетипова: окремої сторінки-переліку немає, гуртки живуть
ПУНКТАМИ МЕНЮ під розділом «Гуртки» (WordPress-меню з кириличними URL).
Тому беремо посилання з підменю цього пункту, відкидаємо службові
(«Розклад занять») і обходимо кожну сторінку гуртка.

Запобіжник свіжості — той самий, що в firstpalace_kharkiv: головна без
згадок поточного чи минулого року означає покинутий сайт, тоді не
скрапимо і попереджаємо в лог.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Івано-Франківський ОДЦНТТУМ (ocnttum.if.ua)"
BASE = "https://ocnttum.if.ua"
CITY = "Івано-Франківськ"
FACILITY = ("Івано-Франківський обласний державний центр науково-технічної "
            "творчості учнівської молоді (ОДЦНТТУМ)")

DELAY_SECONDS = 0.6
MAX_CLUBS = 60
# Пункти підменю «Гуртки», які гуртками не є.
SKIP_TITLES = {"розклад занять"}

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
    """(url, назва) з підменю пункту «Гуртки» головного меню."""
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a"):
        if a.get_text(strip=True).lower() == "гуртки":
            li = a.find_parent("li")
            if not li:
                continue
            out, seen = [], set()
            for sub in li.select("ul a[href]"):
                href = (sub.get("href") or "").strip()
                title = sub.get_text(" ", strip=True)
                if not href or href in seen or not href.startswith("http"):
                    continue
                if title.lower() in SKIP_TITLES:
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
            logger.warning(f"ocnttum: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning("ocnttum: на головній немає згадок поточного чи "
                           "минулого року — джерело виглядає покинутим")
            return []

        links = _menu_club_links(home.text)[:MAX_CLUBS]
        logger.info(f"ocnttum: у меню {len(links)} гуртків")

        for url, menu_title in links:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"ocnttum: {url} не відповів ({e}) — пропускаю")
                continue
            # H1 на сторінках гуртків — назва ЗАКЛАДУ, а не гуртка, тому
            # назву беремо з пункту меню; h1 — лише запасний варіант.
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1")
            title = menu_title or (h1.get_text(" ", strip=True) if h1 else "")
            parts = [
                title,
                f"Місто: {CITY}",
                f"Заклад: {FACILITY} — державний заклад позашкільної освіти, "
                "гуртки безкоштовні",
                _page_text(r.text)[:2500],
                "Гурток обласного центру науково-технічної творчості. Набір "
                "постійний, дедлайну немає — розклад і умови участі уточнюйте "
                "в закладі.",
            ]
            items.append({
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": title,
                "raw_text": "\n".join(p for p in parts if p)[:4000],
            })
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"ocnttum: зібрано {len(items)} гуртків")
    return items
