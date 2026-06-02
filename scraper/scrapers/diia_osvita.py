"""Скрапер Дія.Освіта — безкоштовні онлайн-курси для молоді.

https://osvita.diia.gov.ua/courses — до 25 сторінок карток курсів.
Фільтр за ключовими словами; дорослі/держслужбові курси виключаються.
"""
import asyncio
import logging
import re

import httpx

logger = logging.getLogger(__name__)

SOURCE_NAME = "Дія.Освіта"
BASE_URL = "https://osvita.diia.gov.ua"
MAX_PAGES = 25

_YOUTH_KW = [
    "молод", "підліток", "підлітк", "школяр", "учн", "нмт", "зно",
    "youth", "teen", "school", "студент", "абітурієнт",
    "кібербезпека для молоді", "кібергігієна для молоді",
    "політична освіта для молоді", "підготовка до нмт",
]
_ADULT_KW = [
    "dpo", "держслужб", "поліц", "ветеран", "чизмонгер",
    "готельн", "туристичн", "торговельн", "бухгалтер", "нотаріус",
    "прокурор", "суддя", "адвокат", "черліденг: тренерств",
    "тьюторинг у школі", "цифрові навички для вчителів",
    "організація стажування молоді", "молодіжна робота",
    "інклюзивна молодіжна", "як стати ментором", "covid",
]

_CARD_RE = re.compile(r'<a\s+href="(/courses/[a-z0-9-]+)"[^>]*>([\s\S]*?)</a>', re.DOTALL)
_TITLE_RE = re.compile(r'category-card-full__title--md[^>]*>([^<]+)</h5>', re.I)
_DESC_RE = re.compile(r'category-card-full__description[^>]*>([^<]*)</div>', re.I)
_META_DESC_RE = re.compile(r'<meta[^>]+name="description"[^>]+content="([^"]{10,})"', re.I)
_OG_DESC_RE = re.compile(r'<meta[^>]+property="og:description"[^>]+content="([^"]{10,})"', re.I)

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}


def _is_youth(title: str, desc: str = "") -> bool:
    text = (title + " " + desc).lower()
    if any(kw in text for kw in _ADULT_KW):
        return False
    return any(kw in text for kw in _YOUTH_KW)


def _detect_age(text: str) -> tuple[int, int]:
    t = text.lower()
    if re.search(r"дошкільн|садок|малюк", t):
        return 4, 6
    if re.search(r"молодш|початков|1.{0,4}4.{0,5}клас", t):
        return 7, 11
    if re.search(r"нмт|зно|абітурієнт|11.{0,3}клас", t):
        return 15, 17
    return 14, 17


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(headers=_BROWSER, timeout=30.0, follow_redirects=True) as client:
        semaphore = asyncio.Semaphore(4)
        seen: dict[str, dict] = {}

        async def _fetch_listing(page: int):
            async with semaphore:
                url = f"{BASE_URL}/courses" if page == 1 else f"{BASE_URL}/courses?page={page}"
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    for m in _CARD_RE.finditer(r.text):
                        path, inner = m.group(1), m.group(2)
                        t_m = _TITLE_RE.search(inner)
                        if not t_m:
                            continue
                        title = re.sub(r"\s+", " ", t_m.group(1)).strip()
                        d_m = _DESC_RE.search(inner)
                        desc = re.sub(r"\s+", " ", d_m.group(1)).strip() if d_m else ""
                        if title and path not in seen:
                            seen[path] = {"title": title, "desc": desc}
                except Exception as e:
                    logger.warning(f"Дія.Освіта page {page}: {e}")

        await asyncio.gather(*[_fetch_listing(p) for p in range(1, MAX_PAGES + 1)])
        logger.info(f"Дія.Освіта: {len(seen)} courses total, filtering for youth")

        candidates = [(path, info) for path, info in seen.items() if _is_youth(info["title"], info["desc"])]

        async def _enrich(path: str, info: dict) -> dict | None:
            async with semaphore:
                title, desc = info["title"], info["desc"]
                if not desc:
                    try:
                        r = await client.get(f"{BASE_URL}{path}")
                        r.raise_for_status()
                        m = _META_DESC_RE.search(r.text) or _OG_DESC_RE.search(r.text)
                        desc = m.group(1).strip() if m else ""
                    except Exception:
                        pass
                if not _is_youth(title, desc):
                    return None
                age_from, age_to = _detect_age(title + " " + desc)
                return {
                    "source": SOURCE_NAME,
                    "source_url": f"{BASE_URL}{path}",
                    "raw_title": title,
                    "raw_text": (
                        f"Безкоштовний онлайн-курс на платформі Дія.Освіта.\n\n"
                        f"{desc or f'Курс: {title}. Безкоштовно. Онлайн.'}"
                    ),
                }

        results_raw = await asyncio.gather(*[_enrich(p, i) for p, i in candidates])
        results = [r for r in results_raw if r]
        logger.info(f"Дія.Освіта: {len(results)} youth-relevant courses")
        return results
