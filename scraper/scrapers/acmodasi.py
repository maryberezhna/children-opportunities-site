"""ACMODASI — кастинги й набори до театральних/кіно-проєктів для дітей.

Повернуто 19.08.2026 після знахідки користувачки: набір WonderStage до
англомовних театральних груп (National Theatre Connections) — саме той тип
можливості, якого нема більше ніде.

Чому Python, а не старий node-адаптер: більшість кастингів на сайті — для
дорослих, і без LLM-нормалізатора вони б лилися в каталог. Тут сирі картки
йдуть у звичайну чергу raw_items, де вік і релевантність вирішує нормалізатор.

Розмітка: видимі картки списку малює JS, але сервер віддає JSON-LD:
  сторінка категорії → ItemList з url кожного оголошення
  сторінка оголошення → JobPosting з title / description / validThrough
Це стабільніше за CSS-селектори (саме на них старий адаптер і зламався).
"""
import asyncio
import json
import logging
import re

import httpx

from keywords import is_relevant

logger = logging.getLogger(__name__)

SOURCE_NAME = "ACMODASI"
BASE = "https://www.acmodasi.com.ua"

# Категорії, де реально трапляються дитячі набори. Реклама й серіали дають
# переважно дорослі кастинги, але дитячі ролі там теж бувають — відсіє LLM.
CATEGORIES = ["in_theatre", "in_movie", "in_commercial", "in_tv_series"]

ADS_PER_CATEGORY = 12   # свіжі оголошення згори списку
CONCURRENCY = 4
MIN_TEXT_LEN = 120

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}

# Сигнал «це про дитину»: вік у роках, згадка дітей/підлітків/школи.
# Без нього в чергу летіли б сотні дорослих кастингів і палили б токени.
_CHILD_RE = re.compile(
    r"(дит|дітей|дітям|підліт|школяр|учн|юнак|юних|хлопчик|дівчинк|"
    r"\b([3-9]|1[0-7])\s*[–\-—]\s*(1[0-8]|[4-9])\s*рок|"
    r"\bвід\s*([3-9]|1[0-7])\s*рок)",
    re.IGNORECASE,
)


def _json_ld(html: str) -> list[dict]:
    """Усі JSON-LD обʼєкти зі сторінки (биті блоки просто пропускаємо)."""
    out = []
    for raw in re.findall(
        r'<script type="application/ld\+json">([\s\S]*?)</script>', html
    ):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        out.extend(data if isinstance(data, list) else [data])
    return out


def _ad_urls(html: str) -> list[str]:
    """URL оголошень зі списку категорії (JSON-LD ItemList)."""
    urls = []
    for obj in _json_ld(html):
        if obj.get("@type") != "ItemList":
            continue
        for item in obj.get("itemListElement", []):
            url = item.get("url")
            if url and "/c_" in url:
                urls.append(url)
    return urls


def _clean(html_text: str) -> str:
    """Опис у JobPosting приходить із HTML — знімаємо теги."""
    text = re.sub(r"<br\s*/?>", "\n", str(html_text or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def _parse_ad(html: str, url: str) -> dict | None:
    for obj in _json_ld(html):
        if obj.get("@type") != "JobPosting":
            continue
        title = str(obj.get("title") or "").strip()
        desc = _clean(obj.get("description"))
        if len(desc) < MIN_TEXT_LEN:
            return None

        blob = f"{title}\n{desc}"
        if not _CHILD_RE.search(blob) or not is_relevant(blob):
            return None

        # validThrough — справжній дедлайн подачі; кладемо в текст, щоб
        # нормалізатор його побачив і не вигадував свій.
        valid = str(obj.get("validThrough") or "")[:10]
        if valid:
            desc = f"{desc}\n\nЗаявки приймають до: {valid}"

        return {
            "source": SOURCE_NAME,
            "source_url": url,
            "raw_title": title[:300] or None,
            "raw_text": desc[:6000],
        }
    return None


async def fetch_all() -> list[dict]:
    results: list[dict] = []
    seen: set[str] = set()
    sem = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=25.0, follow_redirects=True
    ) as client:

        async def _get(url: str) -> str | None:
            async with sem:
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    return r.text
                except Exception as e:
                    logger.warning("ACMODASI %s: %s", url, e)
                    return None

        # 1. Списки категорій → URL оголошень
        pages = await asyncio.gather(*[_get(f"{BASE}/castings/{c}/") for c in CATEGORIES])
        ad_urls: list[str] = []
        for cat, html in zip(CATEGORIES, pages):
            if not html:
                continue
            urls = _ad_urls(html)[:ADS_PER_CATEGORY]
            logger.info("ACMODASI %s: %d оголошень у списку", cat, len(urls))
            for u in urls:
                if u not in seen:
                    seen.add(u)
                    ad_urls.append(u)

        if not ad_urls:
            # Нуль URL = зламався JSON-LD або сайт ліг. Порожній результат
            # реєстр джерел зафіксує як збій — і ми про це дізнаємось.
            logger.warning("ACMODASI: жодного оголошення в списках")
            return []

        # 2. Оголошення → сирі картки для нормалізатора
        details = await asyncio.gather(*[_get(u) for u in ad_urls])
        for url, html in zip(ad_urls, details):
            if not html:
                continue
            item = _parse_ad(html, url)
            if item:
                results.append(item)

    logger.info("ACMODASI: %d дитячих кастингів із %d оголошень",
                len(results), len(ad_urls))
    return results
