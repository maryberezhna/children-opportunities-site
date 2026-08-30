"""Скрапер Eurodesk Opportunity Finder — європейські програми для молоді.

Чому окремо від решти. programmes.eurodesk.eu — застосунок, який малюється
на клієнті: у HTML, що приходить по HTTP, немає ні програм, ні посилань.
Дані віддає власний виклик `/search`, і він відповідає 403 на звичайний
запит — але працює зсередини вже відкритої сторінки, бо там є сесія.
Тому тут потрібен справжній браузер. Це НЕ обхід захисту: сайт віддає вміст
будь-якому браузеру без жодних перевірок, він просто малює його скриптом.

Беремо лише секцію `open` — програми з відкритим набором просто зараз
(близько 90 із 533). Секція `upcoming` важить утричі більше й описує те,
що ще не відкрилось: у каталозі воно стало б записами, на які не подаси.

Якщо playwright недоступний або браузер не піднявся — повертаємо порожньо
й пишемо в лог. Одне джерело не сміє зупинити нічний прогін.
"""
import logging
import re

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_NAME = "Eurodesk"
BASE = "https://programmes.eurodesk.eu"
PAGE_TIMEOUT_MS = 45_000

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


async def fetch_all() -> list[dict]:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Eurodesk: playwright не встановлено — пропускаю джерело")
        return []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(args=["--disable-dev-shm-usage"])
            page = await browser.new_page()
            await page.goto(BASE, timeout=PAGE_TIMEOUT_MS, wait_until="networkidle")
            # Виклик робимо ЗСЕРЕДИНИ сторінки: ззовні той самий шлях віддає 403,
            # бо немає сесії, яку застосунок отримує при завантаженні.
            payload = await page.evaluate(
                """() => fetch('/search?', {headers: {Accept: 'application/json'}})
                        .then(r => r.json())
                        .then(j => ({open: String(j.open || ''), count: j.count || 0}))"""
            )
            await browser.close()
    except Exception as e:
        logger.error(f"Eurodesk: браузер не впорався ({type(e).__name__}: {e})")
        return []

    items = parse_open(payload.get("open", ""))
    logger.info(
        "Eurodesk: %d програм з відкритим набором (усього в переліку %s)",
        len(items), payload.get("count"),
    )
    return items
