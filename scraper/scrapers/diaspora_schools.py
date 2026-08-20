"""Скрапер «Освітній Всесвіт» — українські школи діаспори.

Каталог веде МІОК (Міжнародний інститут освіти, культури та зв'язків з
діаспорою, Львівська політехніка) — суботні й недільні школи, освітні центри
та студії, де українські діти за кордоном вчать мову, історію й культуру.

Чому саме він. Це найщільніше зібрання діаспорних шкіл, яке взагалі існує,
і воно українською — на відміну від польських gmina-порталів чи німецьких
Vereine, де довелось би розбирати чужу мову й локальні реєстри.

Технічно. Публічного API і sitemap немає: список у каталозі рендериться
джаваскриптом, тож взяти його як список не вийде. Але СТОРІНКА ОКРЕМОЇ ШКОЛИ
віддається повним HTML — назва, місто, країна, вік груп, розклад, дисципліни,
контакти. Тому перебираємо /schools/{id} і зупиняємось після серії підряд
непорожніх промахів.

Фільтр країни стоїть ДО черги на екстракцію: каталог покриває 40+ країн, а нам
потрібні ті, де осіли українські родини після 2022-го. Відсіювання за текстом
сторінки не коштує жодного токена — на LLM іде лише цільове.
"""
import asyncio
import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Освітній Всесвіт (МІОК)"
BASE_URL = "https://vsesvit.miok.lviv.ua"

# Країни напряму. Назви — як їх пише сам каталог, коди — ISO 3166-1 alpha-2,
# бо саме в такому вигляді вони лягають у opportunities.countries.
TARGET_COUNTRIES = {
    "Польща": "pl",
    "Німеччина": "de",
    "Чехія": "cz",
}

# Перебір id. Каталог росте, тому стеля з запасом; реально цикл зупиняє
# лічильник промахів, а не вона.
FIRST_ID = 1
MAX_ID = 800
# Скільки підряд відсутніх сторінок вважати кінцем каталогу. Дірки в
# нумерації трапляються (видалені заклади), тож одного 404 замало.
MISS_STREAK_STOP = 40
# Пауза між запитами: каталог невеликої установи, не гатимо його.
DELAY_SECONDS = 0.4
CONCURRENCY = 4

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9",
}


def _detect_country(text: str) -> str | None:
    """Код країни за текстом сторінки або None, якщо це не наш напрям.

    Країна стоїть у заголовку в дужках — «… вул. Руська 46а (Польща)», — але
    трапляється і лише в описі, тож дивимось увесь текст.
    """
    for name, code in TARGET_COUNTRIES.items():
        if name in text:
            return code
    return None


def _parse(html: str, url: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "form"]):
        tag.decompose()

    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    if not title:
        return None

    body = soup.select_one(".section-description") or soup
    text = " ".join(body.get_text(" ").split())
    full = f"{title} {text}"

    country = _detect_country(full)
    if not country:
        return None  # інша країна — не наш напрям, у чергу не кладемо

    # Порожні картки (заклад заведено, але нічого не заповнено) не варті
    # виклику LLM: у них лише службові підписи полів без значень.
    if len(text) < 200:
        return None

    return {
        "source": SOURCE_NAME,
        "source_url": url,
        "raw_title": title,
        # Країну дублюємо в текст явно: сторінка може згадати її лише в
        # заголовку, а екстрактор бачить саме raw_text.
        "raw_text": f"Країна: {country.upper()}. {title}. {text}"[:8000],
    }


async def _fetch_one(client: httpx.AsyncClient, school_id: int) -> tuple[int, dict | None]:
    url = f"{BASE_URL}/schools/{school_id}"
    try:
        r = await client.get(url)
    except Exception as e:
        logger.debug("школа %s: мережева помилка %s", school_id, e)
        return school_id, None
    if r.status_code != 200 or not r.text:
        return school_id, None
    return school_id, _parse(r.text, url)


async def fetch_all() -> list[dict]:
    found: list[dict] = []
    miss_streak = 0
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def guarded(client, sid):
        async with semaphore:
            await asyncio.sleep(DELAY_SECONDS)
            return await _fetch_one(client, sid)

    async with httpx.AsyncClient(
        timeout=20, follow_redirects=True, headers=_BROWSER_HEADERS
    ) as client:
        batch_size = CONCURRENCY * 5
        for start in range(FIRST_ID, MAX_ID + 1, batch_size):
            ids = range(start, min(start + batch_size, MAX_ID + 1))
            results = await asyncio.gather(*(guarded(client, i) for i in ids))
            # Промах — це і 404, і чужа країна: обидва означають «тут нема чого
            # брати». Для зупинки важлива саме суцільна смуга порожнечі.
            batch_hits = [item for _, item in results if item]
            found.extend(batch_hits)
            if batch_hits:
                miss_streak = 0
            else:
                miss_streak += len(results)
                if miss_streak >= MISS_STREAK_STOP:
                    logger.info(
                        "Освітній Всесвіт: %s порожніх id підряд — вважаю кінцем каталогу",
                        miss_streak,
                    )
                    break

    logger.info(
        "Освітній Всесвіт: %s шкіл у цільових країнах (%s)",
        len(found), ", ".join(TARGET_COUNTRIES.values()),
    )
    return found
