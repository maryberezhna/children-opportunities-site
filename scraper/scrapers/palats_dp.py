"""Скрапер palats.dp.ua — гуртки Палацу творчості дітей та юнацтва Дніпра.

Дніпро — мільйонник із одним локальним записом у базі. Сайт палацу дуже
живий (52 згадки 2026 на головній, події аж до грудня). Першоджерело,
trust_tier=2.

Розмітка відрізняється від інших палаців: окремих сторінок гуртків немає —
УСІ колективи описані НА ОДНІЙ сторінці «Наші гуртки», заголовками
(h2–h5) із блоком тексту під кожним: вік, керівник, опис. Заголовки-адреси
(«Колективи Палацу за адресою вул. …») — це філії: не гурток, а контекст
для наступних записів, кладемо його в текст кожного гуртка цієї філії.

Через це source_url у всіх записів однаковий (сторінка переліку) з
різними якорями — та сама модель, що в олімпіад МОН (19 записів на одній
сторінці міністерства).

Запобіжник свіжості — стандартний для палацових скраперів.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Палац творчості дітей та юнацтва Дніпра (palats.dp.ua)"
BASE = "https://palats.dp.ua"
LIST_URL = f"{BASE}/learning-process/our-sections/"
CITY = "Дніпро"
FACILITY = ("КЗПО «Палац творчості дітей та юнацтва» Дніпровської "
            "міської ради")

MAX_CLUBS = 120
# Мінімальна довжина блоку опису: коротші заголовки — розділювачі й
# декоративні підписи, не гуртки.
MIN_BODY_LEN = 30

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}

_BRANCH_RE = re.compile(r"за адресою", re.I)


def _is_fresh(home_html: str) -> bool:
    year = datetime.now(timezone.utc).year
    return str(year) in home_html or str(year - 1) in home_html


def _slugify(title: str, index: int) -> str:
    s = re.sub(r"[^a-zа-яіїєґ0-9]+", "-", title.lower()).strip("-")
    return f"{s[:60]}-{index}" if s else f"club-{index}"


def _clubs_from_list(html: str) -> list[dict]:
    """Ріжемо сторінку «Наші гуртки» по заголовках h2–h5."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "form", "aside"]):
        tag.decompose()
    root = soup.select_one("main") or soup.body or soup

    headings = root.find_all(re.compile(r"^h[2-5]$"))
    out = []
    branch = ""
    for idx, h in enumerate(headings):
        title = h.get_text(" ", strip=True)
        if not title:
            continue
        if _BRANCH_RE.search(title):
            branch = title
            continue
        # Текст блоку — все до наступного заголовка того самого рівня-або-вище.
        body_parts = []
        for sib in h.find_all_next():
            if sib.name and re.match(r"^h[2-5]$", sib.name):
                break
            if sib.name in ("p", "li"):
                body_parts.append(sib.get_text(" ", strip=True))
        body = "\n".join(p for p in body_parts if p)
        if len(body) < MIN_BODY_LEN:
            continue
        out.append({"title": title, "body": body[:2000], "branch": branch,
                    "anchor": _slugify(title, idx)})
        if len(out) >= MAX_CLUBS:
            break
    return out


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            home = await client.get(BASE)
            home.raise_for_status()
        except Exception as e:
            logger.warning(f"palats-dp: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning("palats-dp: на головній немає згадок поточного чи "
                           "минулого року — джерело виглядає покинутим")
            return []

        try:
            listing = await client.get(LIST_URL)
            listing.raise_for_status()
        except Exception as e:
            logger.warning(f"palats-dp: сторінка гуртків не відповіла ({e})")
            return []

    clubs = _clubs_from_list(listing.text)
    items = []
    for c in clubs:
        parts = [
            c["title"],
            f"Місто: {CITY}",
            f"Заклад: {FACILITY} — комунальний заклад позашкільної освіти",
            f"Філія: {c['branch']}" if c["branch"] else "",
            c["body"],
            "Колектив Палацу творчості дітей та юнацтва Дніпра. Набір "
            "постійний, дедлайну немає — розклад і умови участі уточнюйте "
            "в закладі.",
        ]
        items.append({
            "source": SOURCE_NAME,
            "source_url": f"{LIST_URL}#{c['anchor']}",
            "raw_title": c["title"],
            "raw_text": "\n".join(p for p in parts if p)[:4000],
        })

    logger.info(f"palats-dp: зібрано {len(items)} гуртків")
    return items
