"""Скрапер Eurodesk Opportunity Finder — європейські програми для молоді.

Чому окремо від решти. programmes.eurodesk.eu малюється на клієнті: у HTML,
що приходить по HTTP, програм немає — самі кістяки-плейсхолдери. Дані віддає
власний виклик `/search`, і без сесії він відповідає 403.

До 20.09.2026 сесію давав справжній браузер (playwright). Він перестав
працювати: у логах прогону 15.09 — «Page.evaluate: SyntaxError: Unexpected
token '<'», тобто виклик зсередини сторінки почав повертати сторінку 403, а
не JSON. Джерело мовчки віддавало нуль, і це не було видно: воно ходить раз
на 30 днів.

Тепер браузер не потрібен. Сесію дає звичайний httpx: перший GET на головну
кладе в банку куки, далі той самий `/search` віддає 200 і JSON. Запит іде з
`all=1` — так робить сам застосунок у режимі вбудовування, і замість 20
карток сторінкою приходять усі відкриті набори за один раз.

Формат теж змінився: `open` був рядком, став обʼєктом `{html, starts}`.
Підтримуємо обидва — сайт може відкотитись.

Беремо лише секцію `open` — програми з відкритим набором просто зараз
(близько 82 із 534). Секція `upcoming` описує те, що ще не відкрилось: у
каталозі воно стало б записами, на які не подаси.

Помилка мережі чи формату — повертаємо порожньо й пишемо в лог. Одне джерело
не сміє зупинити нічний прогін.
"""
import logging
import re

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Eurodesk"
BASE = "https://programmes.eurodesk.eu"
TIMEOUT_S = 60

# Ті самі заголовки, що шле браузер на цій сторінці. Без X-Requested-With і
# Referer запит лишається 403 навіть із куками.
_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
}
_XHR = {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE}/",
}

_ID_RE = re.compile(r"^(\d+)-")

# Колір картки в них — це категорія. Зелена означає стажування: усі 23 зелені
# картки на момент перевірки були traineeship, internship або au pair, а вони
# без винятку вимагають вищої освіти чи 18+. Не женемо їх через екстракцію:
# це чверть усього обсягу й гарантовано нуль на виході.
#
# Червоні НЕ ріжемо, хоч там теж багато дорослого: поруч із «Mobility Staff
# Adult Education» лежать «Erasmus+ Youth Exchanges» і «Youth4Ocean Forum»,
# які нам якраз потрібні. Там вік вирішує екстракція.
SKIP_COLORS = {"green"}


def _text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def parse_open(html: str) -> list[dict]:
    """Розбирає фрагмент `open` у сирі записи. Винесено окремо від мережі,
    щоб парсер можна було перевірити на збереженому фрагменті."""
    soup = BeautifulSoup(html, "html.parser")
    items, seen = [], set()

    skipped = 0
    for card in soup.select('[data-role="card"]'):
        if (card.get("data-color") or "") in SKIP_COLORS:
            skipped += 1
            continue
        title = _text(card.select_one('[data-role="title"]'))
        if not title:
            continue

        # Ідентифікатор ховається у списку мов: <option value="21214-eu">.
        # Прямого посилання в картці немає — вона відкривається скриптом.
        opt = next((o.get("value") for o in card.select("option[value]")
                    if o.get("value") and _ID_RE.match(o["value"])), None)
        if not opt:
            continue
        url = f"{BASE}/{opt}"
        if url in seen:
            continue
        seen.add(url)

        deadline = _text(card.select_one('[data-role="header"] span'))
        descr = ""
        body = card.select_one('[data-role="body"]')
        if body:
            blocks = [_text(d) for d in body.find_all("div", recursive=False)]
            descr = next((b for b in blocks if b and b != title), "")

        parts = [
            title,
            f"Дедлайн подачі: {deadline}" if deadline else "",
            descr,
            "Європейська програма з переліку Eurodesk Opportunity Finder. "
            "Набір відкритий на момент збору.",
        ]
        items.append({
            "source": SOURCE_NAME,
            "source_url": url,
            "raw_title": title,
            "raw_text": "\n".join(p for p in parts if p)[:4000],
        })

    if skipped:
        logger.info("Eurodesk: пропущено %d карток-стажувань (18+)", skipped)
    return items


def section_html(section) -> str:
    """`open` приходить обʼєктом {html, starts}, а раніше був рядком."""
    if isinstance(section, dict):
        return section.get("html") or ""
    return str(section or "")


async def fetch_all() -> list[dict]:
    try:
        async with httpx.AsyncClient(headers=_BROWSER, timeout=TIMEOUT_S,
                                     follow_redirects=True) as client:
            # Перший запит потрібен лише заради куків сесії.
            await client.get(f"{BASE}/")
            r = await client.get(f"{BASE}/search?all=1", headers=_XHR)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.error("Eurodesk: не вдалось отримати перелік (%s: %s)", type(e).__name__, e)
        return []

    items = parse_open(section_html(data.get("open")))
    logger.info(
        "Eurodesk: %d програм з відкритим набором (усього в переліку %s)",
        len(items), data.get("count"),
    )
    return items
