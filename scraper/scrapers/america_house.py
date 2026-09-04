"""Скрапер America House Kyiv — події для підлітків (клуби, табори, програми).

americahousekyiv.org — американський культурний центр у Києві: безкоштовні
події, частина з яких — для підлітків (teen clubs, TechCamp, літні
програми). Сайт на Squarespace, і його вбудований JSON-ендпоінт
(/events?format=json) віддає майбутні події структуровано — без парсингу
HTML і без браузера.

Більшість подій там дорослі (бізнес-серії, йога, книжковий клуб), тому
перед екстракцією стоїть спільний словник релевантності (keywords.py,
він містить і англійські «for teens», «youth», «for kids»): доросле не
женемо через LLM. Тижнями фільтр може давати нуль — це нормальна робота,
а не поломка: підліткові події зʼявляться і будуть підхоплені за день.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

from keywords import is_relevant

logger = logging.getLogger(__name__)

SOURCE_NAME = "America House Kyiv"
BASE = "https://americahousekyiv.org"
LIST_URL = f"{BASE}/events?format=json"

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _strip_html(html: str) -> str:
    return BeautifulSoup(html or "", "lxml").get_text("\n", strip=True)


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(headers=_BROWSER, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            resp = await client.get(LIST_URL)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"America House list failed: {e}")
            return []

        # Squarespace тут примхливий: без www ключ items, з www — upcoming.
        items = data.get("upcoming") or data.get("items") or []
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
        out: list[dict] = []
        sem = asyncio.Semaphore(3)

        async def fetch_one(it: dict):
            title = (it.get("title") or "").strip()
            start = it.get("startDate") or 0
            # Минулі події нікому не потрібні в каталозі (добова толерантність
            # на часовий пояс).
            if not title or start < now_ms - 86_400_000:
                return None
            url = BASE + (it.get("fullUrl") or "")

            text = _strip_html(it.get("excerpt") or "")
            # Повний опис — з JSON детальної сторінки; якщо він недоступний,
            # анонса досить для екстракції.
            async with sem:
                try:
                    r = await client.get(f"{url}?format=json")
                    r.raise_for_status()
                    body = (r.json().get("item") or {}).get("body") or ""
                    full = _strip_html(body)
                    if len(full) > len(text):
                        text = full
                except Exception:
                    pass

            if not is_relevant(f"{title}\n{text}"):
                return None

            when = datetime.fromtimestamp(start / 1000, tz=timezone.utc)
            return {
                "source": SOURCE_NAME,
                "source_url": url,
                "raw_title": title,
                "raw_text": (
                    f"Подія в America House Kyiv (безкоштовний американський "
                    f"культурний центр, Київ). Дата події: "
                    f"{when:%Y-%m-%d}.\n\n{text[:5000]}"
                ),
            }

        results = await asyncio.gather(*(fetch_one(it) for it in items))
        out = [r for r in results if r]
        logger.info(f"America House: {len(items)} подій, "
                    f"{len(out)} релевантних для 0–18")
        return out
