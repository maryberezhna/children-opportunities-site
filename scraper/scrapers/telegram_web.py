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

from raw_store import with_published

import httpx
from bs4 import BeautifulSoup

import first_source
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
# Прибрано 14.09.2026 за звітом source_report.py (30 днів, сирих → на сайті):
# @grantovyphishky 201 → 4, @houseofeurope 28 → 0, @grants_ukraine 15 → 0,
# @unicompass 12 → 0, @osvitanova 10 → 0. Здебільшого гранти для дорослих і ГО.
# Кожна сира знахідка — окремий виклик моделі, а 14.09 вичерпано ліміт API.
# House of Europe лишається власним скрапером сайту.
# Прибрано 21.09.2026 (Марія: «новини освіти» — вимкнути): @novashkola за
# 14 днів 38 відхилених і 9 у карантин, прийнятих 0; @naurok — 7 і 0. Обидва
# пишуть для вчителів і про реформи, а не про можливості для дітей.
CHANNELS: list[tuple[str, str]] = [
    ("grantoteka", "Грантотека"),
    ("youth_ukraine", "Молодь України"),
    ("olymp_ua", "Олімпіади України"),
    ("unicef_ukraine", "UNICEF Ukraine"),
    ("mozhlyvosti_ua", "Можливості UA"),
    ("Mozhlyvosti", "Можливості"),
    # Додано 18.08.2026 з добірки @husenytsiaa (Notion-таска «Telegram-канали
    # як джерела»): перевірені на живість і релевантність 0–18. Перекіс у
    # студентське відсіює нормалізатор.
    ("tviyspace", "Твій космос можливостей"),
    ("news_from_united_youth", "United Youth"),
    # Додано 18.08.2026: знайдений хендл із тієї ж добірки @husenytsiaa.
    # Студентський перекіс (як unicompass) — нормалізатор відсіює 18+.
    ("alwaysinomniaparatus", "In Omnia Paratus"),
    # Додано 03.09.2026 (пріоритет «дитина їде за кордон»): попит на обміни й
    # закордонні програми — вся топ-15 переглядів сайту, а системних джерел
    # під нього не було. Обидва хендли перевірені емпірично: /s/ відкритий,
    # пости свіжі (FLEX Alumni — 25.08, EducationUSA — 03.09). Мертві
    # кандидати (unistudy, erasmus_ua, afs_ukraine…) не додаємо — перевірено
    # тоді ж: закриті або покинуті з 2022.
    ("flexalumniukraine", "FLEX Alumni Ukraine"),
    ("educationusaukraine", "EducationUSA Ukraine"),
    # Goethe-Institut Ukraine: сайт (і навіть RSS-шляхи) за 403/Vue-рендером,
    # тож офіційний TG — єдине читабельне джерело. Пише нечасто (~раз на
    # місяць), але там курси для дітей і PASCH-події. Перевірено 04.09.2026.
    ("goetheukraine", "Goethe-Institut Ukraine"),
    # Додано 20.09.2026 зі списку джерел Марії: сайт УВС RSS не віддає (404),
    # зате канал живий — останній пост 18.09.2026. «Шкільний урок
    # волонтерства», «10:11» і менторські набори для 10–11 класів.
    # Канали @biggggidea (останній пост 15.01.2025) і @goglobal_ua
    # (22.12.2025) перевірені тоді ж і НЕ додані: мертві.
    ("volunteercountry", "Українська волонтерська служба"),
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
        published = None
        if time_el and time_el.get("datetime"):
            try:
                dt = datetime.fromisoformat(time_el["datetime"])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < since:
                    continue
                published = dt
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
            "raw_text": with_published(text[:6000], published),
            # Куди допис посилається: якщо там сторінка можливості, джерелом
            # стане вона, а не допис (див. first_source).
            "_links": [a.get("href") for a in text_el.select("a[href]")],
        })
    return out


def channels_from_registry(rows) -> list[tuple[str, str]] | None:
    """Канали з реєстру джерел: [(handle, назва)] або None, якщо реєстру нема.

    Чиста функція — під тести. Рядок без handle у config пропускаємо: канал,
    якого нема куди піти читати, це помилка даних, а не привід упасти.
    """
    if not rows:
        return None
    out = []
    for name, row in sorted(rows.items()):
        if not row.get("enabled", True):
            continue
        handle = ((row.get("config") or {}).get("handle") or "").strip().lstrip("@")
        if handle:
            out.append((handle, name))
    return out


def channels() -> list[tuple[str, str]]:
    """Які канали обходити цього разу.

    Кожен канал — окремий рядок `sources` (pipeline='telegram', handle у
    config), щоб вимкнути ОДИН канал можна було рядком у базі, без деплою.
    До 24.09.2026 вимикач був один на всі: @unicef_ukraine за 10 днів дав 6
    сторінок у LLM і жодного запису, @volunteercountry — 7 і 0, а прибрати
    їх можна було лише разом із «Твоїм космосом» (33% прийнятих) — тобто
    тільки через деплой, руками в цьому файлі.

    Реєстр недоступний чи порожній — працюємо за вбудованим переліком:
    реєстр не сміє зупинити скрапінг власною недоступністю (як у main.py).
    """
    try:
        from db import get_client, get_source_registry
        from_registry = channels_from_registry(get_source_registry(get_client(), "telegram"))
    except Exception as e:                                   # noqa: BLE001
        logger.warning("реєстр каналів недоступний (%s) — вбудований перелік", e)
        return CHANNELS
    if from_registry is None:
        logger.info("у реєстрі каналів немає — вбудований перелік (%d)", len(CHANNELS))
        return CHANNELS
    return from_registry


async def fetch_all() -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    seen: set[str] = set()
    results: list[dict] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)
    active = channels()

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

        await asyncio.gather(*[_fetch(h, d) for h, d in active])
        results = await _follow_sources(client, results, semaphore)

    logger.info("Telegram (web): %d relevant messages across %d channels",
                len(results), len(active))
    return results


async def _follow_sources(client, items: list[dict], semaphore) -> list[dict]:
    """Джерелом стає сторінка, на яку допис посилається, а не сам допис.

    Допис @novashkola про відеокурс Чілдрен Кінофесту має два речення й
    жодної дати; сторінка за посиланням — вік «від 6 до 14 років», дедлайн
    20 жовтня, показ 20 листопада. Тобто перехід дає і чесну адресу
    «відкрити джерело», і цитати на обовʼязкові поля (Марія, 24.09.2026).

    Сторінка не відкрилась — лишаємо допис як був: краще запис із адресою
    каналу, ніж жодного.
    """
    async def _one(item: dict):
        target = first_source.pick(item.pop("_links", None))
        if not target:
            return
        async with semaphore:
            try:
                r = await client.get(target)
                r.raise_for_status()
            except Exception as e:                           # noqa: BLE001
                logger.info("не пішли за посиланням %s: %s", target, e)
                return
        if not first_source.usable_destination(str(r.url)):
            logger.info("редирект привів не туди (%s) — лишаю допис", r.url)
            return
        soup = BeautifulSoup(r.text, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "svg"]):
            tag.decompose()
        page = " ".join(soup.get_text(" ").split())[:8000]
        if not first_source.looks_like_page(page):
            logger.info("сторінка %s порожня (%d знаків) — лишаю допис", target, len(page))
            return
        item["raw_text"] = first_source.merge_text(item["raw_text"], page, target)
        item["source_url"] = first_source.strip_tracking(str(r.url))
        item["followed_from"] = target

    await asyncio.gather(*[_one(it) for it in items])
    for it in items:
        it.pop("_links", None)
    followed = sum(1 for it in items if it.get("followed_from"))
    if followed:
        logger.info("Telegram: %d із %d дописів замінено сторінкою джерела",
                    followed, len(items))
    return items
