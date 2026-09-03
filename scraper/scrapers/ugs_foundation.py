"""Скрапер Ukraine Global Scholars — стипендії у закордонні школи-пансіони.

ugs.foundation — безкоштовна програма, яка щороку готує ~45 українських
підлітків (9–10 клас) до вступу в найкращі закордонні школи-пансіони та
університети з повними стипендіями; заявки відкриваються 1 січня і
закриваються 28 лютого. Це одна флагманська щорічна можливість, а не
стрічка, тож скрапер крихітний — тільки сторінка Admissions.

Сайт на Nuxt, але рендериться на сервері: текст сторінки є в сирому HTML,
браузер не потрібен. Запобіжник свіжості: сторінка мусить згадувати
щорічний цикл подачі або поточний/наступний рік — інакше програма,
ймовірно, призупинена, і тягнути її в каталог не можна.
"""
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Ukraine Global Scholars"
URL = "https://ugs.foundation/admissions"

_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


def _fresh(text: str) -> bool:
    year = datetime.now(timezone.utc).year
    if any(str(y) in text for y in (year, year + 1)):
        return True
    # Вікно подачі в них описане без року: «opens every year on January 1st».
    return "every year" in text.lower()


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(headers=_BROWSER, timeout=30.0,
                                 follow_redirects=True) as client:
        try:
            resp = await client.get(URL)
            resp.raise_for_status()
        except Exception as e:
            logger.warning(f"UGS page failed: {e}")
            return []

    soup = BeautifulSoup(resp.text, "lxml")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)[:6000]
    if len(text) < 500:
        logger.warning("UGS: сторінка майже порожня — можливо, зламався рендер")
        return []
    if not _fresh(text):
        logger.warning("UGS: немає ознак живого щорічного набору — пропускаю")
        return []

    return [{
        "source": SOURCE_NAME,
        "source_url": URL,
        "raw_title": "Ukraine Global Scholars — підготовка до вступу в "
                     "закордонні школи та університети зі стипендіями",
        "raw_text": (
            "Безкоштовна програма для українських підлітків (9–10 клас): "
            "підготовка до вступу в найкращі закордонні школи-пансіони та "
            "університети з повними стипендіями. Заявки щороку з 1 січня "
            "до 28 лютого.\n\n" + text
        ),
    }]
