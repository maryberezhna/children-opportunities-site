"""Реєстр МОН «Осередки за кордоном» (АІКОМ) — суботні й недільні школи.

Що це. Міністерство освіти веде в АІКОМ перелік українських шкіл і центрів за
кордоном, які подались на визнання українознавчого компонента
(aikom.iea.gov.ua/cell/cell/cell-list): на 28.09.2026 — 122 осередки, з них
47 у Польщі, Німеччині, Іспанії, Чехії, Ірландії, Італії й Нідерландах.
Держреєстр каже те, чого немає в каталозі МІОК: чи навчання платне
(«Навчання є: Платне / Безоплатне»), — саме тому він корисний: вартість із
першого рядка, а не з «уточнюйте».

Що беремо (рішення Марії 28.09.2026). Одну постійну картку на школу, лише
суботні/недільні школи й освітньо-культурні центри в країнах напряму.
«Школи за кордоном, що реалізують стандарт у повному обсязі», школи
нацменшин і патріотичні організації — ні: це заклади на роки чи не
можливість для дитини, і модель їх однаково відхилила б (кожен виклик —
гроші).

Сирець — поля сторінки осередку «Підпис: значення», тими самими словами, що
на сторінці (як «Місто: Львів» у gurtok.org): це слова джерела, лише в
іншому порядку, тож цитата «Навчання є: Платне» — доказ вартості. Нічого
свого (країну кодом, «суботня школа», вік) у текст не дописуємо.

Дублі. Ту саму школу приносить і МІОК, і її власний сайт. Реєстр — теж
посередник, тож у db.AGGREGATOR_SOURCES: картка з сайту школи бʼє чернетку
реєстру, а картка МІОК лишається, коли реєстр приносить ту саму школу
(Марія 28.09.2026 лишила поведінку з МІОК як є) — див. db.same_school.

Запуск без бази й без моделі:
    python scrapers/mon_cells.py
"""
from __future__ import annotations

import asyncio
import logging
import re
import sys
import time

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Реєстр осередків за кордоном (МОН, aikom.iea.gov.ua)"
BASE_URL = "https://aikom.iea.gov.ua"
LIST_URL = f"{BASE_URL}/cell/cell/cell-list"
VIEW_URL = f"{BASE_URL}/cell/cell/view?cellId={{}}"
# authorityId=6688 — корінь дерева «Осередки за кордоном»: усі 122 разом.
LIST_PARAMS = {"authorityId": "6688", "per-page": "10"}
MAX_LIST_PAGES = 40

# Країни напряму — як їх пише реєстр → код для opportunities.countries.
TARGET_COUNTRIES = {
    "Польща": "pl",
    "Німеччина": "de",
    "Іспанія": "es",
    "Чехія": "cz",
    "Ірландія": "ie",
    "Італія": "it",
    "Нідерланди": "nl",
}

# Категорії реєстру, що є можливістю вихідного дня для дитини.
WEEKEND_CATEGORIES = (
    "Суботня / недільна школа",
    "Освітньо-культурний центр",
)

# Поля сторінки осередку в тому порядку, в якому йдуть у сирець.
FIELDS = (
    "Повна назва(українською мовою)",
    "Повна назва(іноземною мовою)",
    "Країна",
    "Категорія",
    "Навчання є",
    "Програма освітнього процесу",
    "Рік заснування",
    "Сайт(и)",
    "Посилання на сторінку у соцмережі",
    "Рішення комісії",
)
# Підписи, після яких значення немає (порожнє поле): наступний рядок — уже
# інший підпис, а не значення.
_ALL_LABELS = set(FIELDS) | {
    "Юридичний статус", "Офіційний статус", "Партнер Міжнародної української школи",
    "Прізвище, ім’я, по батькові керівника", "E-mail", "Контакти:",
}

CONCURRENCY = 2
DELAY_SECONDS = 0.5
TIME_BUDGET_SEC = 240

_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept-Language": "uk-UA,uk;q=0.9",
}


def parse_list(html: str) -> list[int]:
    """id осередків зі сторінки переліку."""
    return sorted({int(x) for x in re.findall(r"cellId=(\d+)", html or "")})


def parse_cell(html: str) -> dict:
    """Сторінка осередку → {підпис: значення}. Чиста функція."""
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "form"]):
        tag.decompose()
    lines = [ln.strip() for ln in soup.get_text("\n").split("\n") if ln.strip()]
    out: dict[str, str] = {}
    for i, line in enumerate(lines):
        if line in FIELDS and line not in out and i + 1 < len(lines):
            value = lines[i + 1]
            if value not in _ALL_LABELS:
                out[line] = value
    return out


def wanted(fields: dict) -> str | None:
    """Код країни, якщо осередок наш (країна напряму й категорія вихідного
    дня), інакше None."""
    code = TARGET_COUNTRIES.get(fields.get("Країна", ""))
    category = fields.get("Категорія", "")
    if not code or not any(category.startswith(c) for c in WEEKEND_CATEGORIES):
        return None
    return code


def to_item(cell_id: int, fields: dict) -> dict | None:
    """Поля осередку → сирець для черги екстракції, або None."""
    title = fields.get("Повна назва(українською мовою)", "").strip()
    if not title:
        return None
    text = "\n".join(f"{k}: {fields[k]}" for k in FIELDS if fields.get(k))
    return {
        "source": SOURCE_NAME,
        "source_url": VIEW_URL.format(cell_id),
        "raw_title": title,
        "raw_text": text[:6000],
    }


async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> str | None:
    await asyncio.sleep(DELAY_SECONDS)
    try:
        r = await client.get(url, params=params)
    except Exception as e:  # noqa: BLE001 — сайт не відповів: пропуск, не аварія
        logger.warning("АІКОМ %s: %s", url, e)
        return None
    if r.status_code != 200 or not r.text:
        logger.warning("АІКОМ %s: HTTP %s", url, r.status_code)
        return None
    return r.text


async def fetch_all() -> list[dict]:
    started = time.monotonic()
    semaphore = asyncio.Semaphore(CONCURRENCY)
    stats: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=25, follow_redirects=True, headers=_HEADERS) as client:
        ids: list[int] = []
        for page in range(1, MAX_LIST_PAGES + 1):
            html = await _get(client, LIST_URL, {**LIST_PARAMS, "page": str(page)})
            got = [i for i in parse_list(html) if i not in ids] if html else []
            if not got:
                break
            ids.extend(got)
        if not ids:
            logger.warning("АІКОМ: перелік осередків порожній — змінилась адреса чи верстка?")
            return []

        async def one(cell_id: int):
            async with semaphore:
                if time.monotonic() - started > TIME_BUDGET_SEC:
                    return None
                html = await _get(client, VIEW_URL.format(cell_id))
                return parse_cell(html) if html else None

        cells = await asyncio.gather(*(one(i) for i in ids))

    items = []
    for cell_id, fields in zip(ids, cells):
        if not fields:
            stats["failed"] = stats.get("failed", 0) + 1
            continue
        code = wanted(fields)
        if not code:
            stats["other"] = stats.get("other", 0) + 1
            continue
        item = to_item(cell_id, fields)
        if item:
            items.append(item)
            stats[code] = stats.get(code, 0) + 1
    logger.info("АІКОМ: %d осередків, у чергу %d (%s)", len(ids), len(items), stats)
    return items


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    found = asyncio.run(fetch_all())
    for it in found:
        cost = re.search(r"Навчання є: (\S+)", it["raw_text"])
        print(f"  • {it['raw_title'][:70]} — {cost.group(1) if cost else '?'} — {it['source_url']}")
    print(f"\nУсього: {len(found)}")
    sys.exit(0)
