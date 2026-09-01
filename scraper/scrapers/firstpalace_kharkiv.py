"""Скрапер firstpalace.kh.ua — гуртки Харківського обласного Палацу дитячої
та юнацької творчості.

Чому це джерело. Харків — четверте за розміром місто країни і досі порожнє
в базі (2 локальні записи). Палац — комунальний заклад, ПЕРШОДЖЕРЕЛО (не
агрегатор): ~100 гуртків з окремою сторінкою на кожен, від шахів і карате до
кінної академії та підводного фотографування. Сайт живий: новини за
30.08.2026, день відкритих дверей анонсований на вересень.

Запобіжник свіжості. Урок від Марії (01.09.2026): застаріле джерело наливає
в базу мертві гуртки й бʼє по довірі сильніше, ніж порожнє місто. Тому перед
обходом перевіряємо, що на головній є згадка поточного або минулого року —
сайт, який рік не публікував ані новини, ані дати, не скрапимо, а голосно
попереджаємо в лог.

Розмітка. Список /gurtky-palacy/ — просто перелік лінків /gurtok/<slug>;
уся змістовна інформація (вік, розклад, опис) живе на сторінці гуртка, тож
обходимо кожну. Меню сайту величезне і повторюється на кожній сторінці —
викидаємо nav/header/footer перед зняттям тексту, інакше LLM-нормалізатор
читатиме пункти меню замість опису.

Вартості на сторінках здебільшого немає: заклад комунальний, більшість
гуртків на бюджетній основі, але писати «безкоштовно» за них ми не маємо
права — лишаємо визначення вартості нормалізатору за текстом сторінки.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Харківський обласний ПДЮТ (firstpalace.kh.ua)"
BASE = "https://firstpalace.kh.ua"
LIST_URL = f"{BASE}/gurtky-palacy/"
CITY = "Харків"
FACILITY = "КЗ «Харківський обласний Палац дитячої та юнацької творчості»"

# ~100 гуртків по одному запиту на кожен — пауза, щоб не тиснути на чужий
# WordPress; стеля — страховка від зациклення по невідомих лінках.
DELAY_SECONDS = 0.6
MAX_CLUBS = 250

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _is_fresh(home_html: str) -> bool:
    """Головна мусить згадувати поточний або минулий рік. Минулий теж
    рахується: у січні–серпні багато сторінок ще підписані попереднім
    навчальним роком, і це нормально."""
    year = datetime.now(timezone.utc).year
    return str(year) in home_html or str(year - 1) in home_html


def _page_text(html: str) -> str:
    """Текст сторінки без меню, шапки й підвалу — інакше нормалізатор
    отримує 40 пунктів навігації замість опису гуртка."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "form", "aside"]):
        tag.decompose()
    root = soup.select_one("main") or soup.body or soup
    text = root.get_text("\n", strip=True)
    # Схлопуємо повтори порожніх рядків і дублікати сусідніх рядків меню.
    lines, prev = [], None
    for line in (l.strip() for l in text.split("\n")):
        if line and line != prev:
            lines.append(line)
        prev = line
    return "\n".join(lines)


def _club_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.select('a[href*="/gurtok/"]'):
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
        "Гурток обласного палацу дитячої та юнацької творчості. Набір "
        "постійний, дедлайну немає — розклад, вік і умови участі уточнюйте "
        "на сторінці гуртка або в закладі.",
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
            logger.warning(f"firstpalace: головна не відповіла ({e}) — пропускаю запуск")
            return []
        if not _is_fresh(home.text):
            logger.warning(
                "firstpalace: на головній немає згадок поточного чи минулого "
                "року — джерело виглядає покинутим, записи не збираємо")
            return []

        try:
            listing = await client.get(LIST_URL)
            listing.raise_for_status()
        except Exception as e:
            logger.warning(f"firstpalace: список гуртків не відповів ({e})")
            return []

        links = _club_links(listing.text)[:MAX_CLUBS]
        logger.info(f"firstpalace: у списку {len(links)} гуртків")

        for url in links:
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.warning(f"firstpalace: {url} не відповів ({e}) — пропускаю")
                continue
            item = _item(url, r.text)
            if item:
                items.append(item)
            await asyncio.sleep(DELAY_SECONDS)

    logger.info(f"firstpalace: зібрано {len(items)} гуртків")
    return items
