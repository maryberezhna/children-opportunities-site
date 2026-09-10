"""backfill_geo.py — дозаповнення countries та is_international.

Навіщо. Промпт нормалізатора наказував ставити ["ua"], коли джерело
українське, — і 677 записів із 690 отримали Україну, включно з «FLEX Program —
стипендія США» й «UWC Changshu China». Ознаки закордону в структурованому
вигляді просто не існувало, хоч у самих назвах країна написана словами.

Чому не регулярка. Пробували: пошук країн по тексту дає ~10-15% хибних.
«англі» ловить «англійську мову» — 33 записи курсів, жодного закордону;
«британ» ловить «British International School Ukraine», яка в Києві. Для
виміру, на якому стоїть головний акцент продукту, це забагато.

Чому не перескрап. У базі вже лежать title, summary й details — моделі цього
досить, щоб назвати країну. Ходити по 690 зовнішніх сторінках заради даних,
які в нас є, немає сенсу.

Запуск:
    python scraper/backfill_geo.py --dry-run          # показати, нічого не писати
    python scraper/backfill_geo.py --limit 40         # обережний перший прогін
    python scraper/backfill_geo.py                    # усе активне
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time

import anthropic

from db import get_client
from normalizer import VALID_COUNTRIES

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill_geo")

MODEL = "claude-haiku-4-5-20251001"

# По 15 записів у виклик. Менше — зайві round-trip'и на 690 записів; більше —
# модель починає плутати індекси між собою і повертає зсунуті відповіді.
BATCH = 15

# Обрізаємо details: країна називається на початку тексту, а повний опис
# інколи має кілька тисяч символів і роздуває виклик без користі.
DETAILS_LIMIT = 700

TOOL = {
    "name": "set_geo",
    "description": "Повертає географію для кожного запису зі списку",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "i": {"type": "integer", "description": "Номер запису зі списку"},
                        "countries": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Країни, де дитина ФІЗИЧНО перебуватиме "
                                           "під час участі, коди ISO 3166-1 alpha-2 "
                                           "у нижньому регістрі. Участь повністю "
                                           "дистанційна → порожній масив. Україну "
                                           "НЕ додавай за замовчуванням.",
                        },
                        "is_international": {
                            "type": "boolean",
                            "description": "Міжнародного рівня: закордонний "
                                           "організатор, учасники з різних країн "
                                           "або поїздка за кордон. Онлайн-конкурс "
                                           "від закордонного організатора — теж "
                                           "true. Гурток у Житомирі — false, "
                                           "навіть якщо його вихованці їздили "
                                           "на міжнародні фестивалі.",
                        },
                    },
                    "required": ["i", "countries", "is_international"],
                },
            },
        },
        "required": ["items"],
    },
}

SYSTEM = """Ти визначаєш географію можливостей для дітей.

Для КОЖНОГО запису зі списку поверни countries та is_international.

── countries: де дитина ФІЗИЧНО перебуватиме під час участі ──
- Указано українське місто → ["ua"].
- Указано закордонне місто чи країну → код цієї країни: ["gr"], ["pl"].
- Формат «онлайн» або місто «Онлайн» → порожній масив: дитина нікуди не
  їде, тож фізичної країни в події немає.
- Місце незрозуміле → порожній масив. Не вгадуй.

── is_international: чи це можливість МІЖНАРОДНОГО РІВНЯ ──
true, якщо виконано хоч одне:
- програму проводить закордонна організація (Erasmus+, UWC, Держдеп США,
  BBC, ЮНЕСКО, іноземний університет чи фонд);
- учасники з різних країн змагаються чи вчаться разом;
- дитина їде за кордон;
- у назві прямо «Міжнародна» / «International» і це справді світовий
  конкурс чи олімпіада (IPO, IMO, ISEF).

false, навіть якщо тема звучить «глобально»:
- у назві «Всеукраїнська», «Український», «національний етап» — це
  внутрішній рівень, хай навіть переможець потім поїде на світовий фінал;
- організатор український (МОН, МАН, Prometheus, Дія.Освіта, SoftServe,
  обласний палац, міська школа) — навіть якщо курс англійською або тема
  міжнародна;
- гурток, студія, секція чи школа в українському місті — навіть якщо її
  вихованці їздять на міжнародні фестивалі, дають концерти за кордоном або
  мають звання «зразковий». Міжнародна — сама можливість, а не біографія
  колективу.

── Два поля незалежні ──
Онлайн-конкурс від японського організатора: countries = [],
is_international = true. Їхати нікуди не треба, але можливість міжнародна.
Обмін у Польщі: countries = ["pl"], is_international = true.
Гурток у Чернігові: countries = ["ua"], is_international = false.
Курс Prometheus онлайн: countries = [], is_international = false."""


def _payload(rows: list[dict]) -> str:
    """Місто й формат ідуть у промпт нарівні з описом.

    Без них перший пробний прогін 10.09.2026 гадав: чернігівську секцію
    єдиноборств і київський хор позначив міжнародними, бо в описі згадані
    виїзди, а де сам колектив — у тексті не сказано. Місто це знімає одразу:
    поля cities і format уже заповнені й перевірені, і суперечити їм модель
    не має підстав.
    """
    lines = []
    for i, r in enumerate(rows):
        details = (r.get("details") or "")[:DETAILS_LIMIT]
        cities = ", ".join(r.get("cities") or []) or "—"
        lines.append(
            f"[{i}] {r.get('title') or ''}\n"
            f"джерело: {r.get('source') or '—'}\n"
            f"місто в базі: {cities}\n"
            f"формат: {r.get('format') or '—'}\n"
            f"опис: {r.get('summary') or ''}\n"
            f"{details}".strip()
        )
    return "\n\n---\n\n".join(lines)


def _ask(client: anthropic.Anthropic, rows: list[dict]) -> dict[int, dict]:
    """Один виклик на пачку. Помилки не ковтаємо: краще впасти з першою
    пачкою, ніж мовчки записати 690 порожніх географій."""
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=2000,
                system=SYSTEM,
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "set_geo"},
                messages=[{"role": "user", "content": _payload(rows)}],
            )
            break
        except anthropic.APIStatusError as e:
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))

    for block in resp.content:
        if block.type == "tool_use":
            return {it["i"]: it for it in block.input.get("items", [])}
    return {}


def _clean(codes) -> list[str]:
    """Той самий білий список, що й у нормалізаторі: краще втратити рідкісну
    країну, ніж отримати вокабуляр із чотирьох мов."""
    out = []
    for c in codes or []:
        code = str(c).strip().lower()
        if code in VALID_COUNTRIES and code not in out:
            out.append(code)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch", type=int, default=BATCH)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("Немає ANTHROPIC_API_KEY")
        return 1

    db = get_client()
    ai = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # PostgREST віддає до 1000 рядків, а активних уже більше — гортаємо
    # сторінками, як у backfill_teen.py, інакше хвіст мовчки лишиться без
    # розмітки.
    rows, start = [], 0
    while True:
        page = (db.table("opportunities")
                .select("id, title, summary, details, source, cities, format, "
                        "countries, is_international")
                .eq("status", "active")
                .is_("canonical_slug", "null")
                .order("id")
                .range(start, start + 999)
                .execute().data or [])
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Записів до перегляду: %d", len(rows))

    changed = abroad = intl = 0
    for start in range(0, len(rows), args.batch):
        chunk = rows[start:start + args.batch]
        answers = _ask(ai, chunk)

        for i, row in enumerate(chunk):
            ans = answers.get(i)
            if not ans:
                logger.warning("Модель не повернула запис %d (%s)", i, row["title"][:60])
                continue

            countries = _clean(ans.get("countries"))
            is_intl = bool(ans.get("is_international"))

            if countries and countries != ["ua"]:
                abroad += 1
            if is_intl:
                intl += 1

            was_c = row.get("countries") or []
            was_i = bool(row.get("is_international"))
            if countries == was_c and is_intl == was_i:
                continue

            changed += 1
            logger.info("%s | %s → %s | міжнар. %s → %s",
                        (row["title"] or "")[:58], was_c or "—", countries or "—",
                        was_i, is_intl)
            if not args.dry_run:
                (db.table("opportunities")
                   .update({"countries": countries or None, "is_international": is_intl})
                   .eq("id", row["id"])
                   .execute())

        logger.info("… %d/%d", min(start + args.batch, len(rows)), len(rows))

    logger.info("Змінено: %d | з фізичним закордоном: %d | міжнародних: %d%s",
                changed, abroad, intl, "  (dry-run, нічого не записано)" if args.dry_run else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
