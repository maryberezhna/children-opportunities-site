"""Telegram public-channel scraper via the web preview (t.me/s/<handle>).

Читає публічну веб-версію каналу (t.me/s/<handle>) — БЕЗ Telegram API, без
жодних креденшелів. Кожен канал віддає ~16–20 останніх дописів у HTML. Ми
парсимо їх, лишаємо свіжі й релевантні (за спільним словником keywords.py),
а AI-нормалізатор робить фінальну фільтрацію (вік, конкретність, відсів
дорослого/агрегаторного контенту).

Якщо канал приватний або вимкнув веб-прев'ю — сторінка не містить дописів,
і ми просто пропускаємо його, не падаючи.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup

from keywords import is_relevant

logger = logging.getLogger(__name__)

SOURCE_NAME = "Telegram"
LOOKBACK_DAYS = 5
MIN_TEXT_LEN = 120
CONCURRENCY = 4

# Курований список ПУБЛІЧНИХ каналів із увімкненим веб-прев'ю (t.me/s/) та
# свіжими дописами про можливості для дітей/молоді 0–18. Кожен хендл перевірено
# емпірично (200 + наявні message-блоки + пости за останні тижні). Канали, що
# редіректять із /s/ (прев'ю вимкнене) або неактивні, тут не тримаємо. Джерела,
# уже покриті окремими скраперами (Prometheus, MAN, easy.gov), не дублюємо.
# (handle без '@', людяна назва джерела).
CHANNELS: list[tuple[str, str]] = [
    ("grants_ukraine", "Гранти Україна"),
    ("grantoteka", "Грантотека"),
    ("youth_ukraine", "Молодь України"),
    ("olymp_ua", "Олімпіади України"),
    ("osvitanova", "Освіта Нова"),
    ("novashkola", "Нова школа"),
    ("naurok", "На Урок"),
    ("houseofeurope", "House of Europe"),
    ("unicef_ukraine", "UNICEF Ukraine"),
    ("mozhlyvosti_ua", "Можливості UA"),
]

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _parse_channel(html: str, handle: str, display: str, since: datetime) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    out: list[dict] = []
    for msg in soup.select("div.tgme_widget_message"):
        text_el = msg.select_one(".tgme_widget_message_text")
        if not text_el:
            continue
        text = text_el.get_text("\n", strip=True)
        if len(text) < MIN_TEXT_LEN or not is_relevant(text):
            continue

        # Recency filter (skip if we can read a date and it's too old).
        time_el = msg.select_one("time[datetime]")
        if time_el and time_el.get("datetime"):
            try:
                dt = datetime.fromisoformat(time_el["datetime"])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < since:
                    continue
            except ValueError:
                pass

        # Message permalink: prefer data-post, fall back to the date anchor.
        post = msg.get("data-post")
        if post:
            url = f"https://t.me/{post}"
        else:
            date_a = msg.select_one("a.tgme_widget_message_date")
            url = date_a["href"] if date_a and date_a.get("href") else f"https://t.me/s/{handle}"

        # First meaningful line (skip emoji-only / pin-only leading lines).
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        title = next((ln for ln in lines if sum(c.isalpha() for c in ln) >= 3),
                     text)[:120]
        out.append({
            "source": display,
            "source_url": url,
            "raw_title": title,
            "raw_text": text[:6000],
        })
    return out


async def fetch_all() -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    seen: set[str] = set()
    results: list[dict] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient(headers=_BROWSER, timeout=25.0, follow_redirects=True) as client:

        async def _fetch(handle: str, display: str):
            async with semaphore:
                try:
                    r = await client.get(f"https://t.me/s/{handle}")
                    r.raise_for_status()
                except Exception as e:
                    logger.warning("t.me/s/%s: %s", handle, e)
                    return
                items = _parse_channel(r.text, handle, display, since)
                for it in items:
                    if it["source_url"] in seen:
                        continue
                    seen.add(it["source_url"])
                    results.append(it)
                logger.info("t.me/s/%s: %d relevant", handle, len(items))

        await asyncio.gather(*[_fetch(h, d) for h, d in CHANNELS])

    logger.info("Telegram (web): %d relevant messages across %d channels",
                len(results), len(CHANNELS))
    return results
