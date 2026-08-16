"""Скрапер «Місце Сили» від Клубу Добродіїв — безкоштовні події для дітей.

space-dobrodiy.club/events — розклад воркшопів, лекцій, арт-занять для дітей
і підлітків у Києві (благодійний простір, участь безкоштовна). Всі картки
лежать на одній сторінці розкладу з чистими класами:
  .e-item → .event-name / .e-date / .event-vik / .event-anons / .event-prostir
  + лінк на детальну сторінку події (унікальний URL — ключ дедуплікації).

Сирі картки йдуть у звичайну LLM-нормалізацію — вік, тип і дату витягає вона.
"""
import logging
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Місце Сили (Клуб Добродіїв)"
LIST_URL = "https://space-dobrodiy.club/events/"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}


async def fetch_all() -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=30.0,
                                 follow_redirects=True) as client:
        r = await client.get(LIST_URL)
        r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    items = []
    seen_urls = set()

    for card in soup.select(".e-item"):
        name_el = card.select_one(".event-name")
        link_el = card.select_one("a[href*='/events/']")
        if not name_el or not link_el:
            continue
        url = link_el.get("href", "").strip()
        title = name_el.get_text(" ", strip=True)
        if not url or not title or url in seen_urls:
            continue
        seen_urls.add(url)

        date = card.select_one(".e-date .value")
        vik = card.select_one(".event-vik")
        anons = card.select_one(".event-anons")
        zone = card.select_one(".event-prostir .value")

        parts = [
            title,
            f"Дата: {date.get_text(' ', strip=True)}" if date else "",
            f"Вік: {vik.get_text(' ', strip=True)}" if vik else "",
            f"Зона: {zone.get_text(' ', strip=True)}" if zone else "",
            anons.get_text(" ", strip=True) if anons else "",
            "Безкоштовний простір «Місце Сили» від Клубу Добродіїв, Київ. "
            "Участь безкоштовна, потрібна реєстрація.",
        ]
        items.append({
            "source": SOURCE_NAME,
            "source_url": url,
            "raw_title": title,
            "raw_text": "\n".join(p for p in parts if p)[:4000],
        })

    logger.info("%s: %d подій зі сторінки розкладу", SOURCE_NAME, len(items))
    return items
