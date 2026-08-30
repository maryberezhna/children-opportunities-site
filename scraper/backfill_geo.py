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
                                           "true. Гурток у Житомирі — false.",
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

Для КОЖНОГО запису зі списку поверни:
- countries: де дитина фізично перебуватиме під час участі. Онлайн — порожній
  масив. Гурток чи табір в Україні — ["ua"]. Обмін у Греції — ["gr"].
- is_international: чи це міжнародна можливість.

Два поля незалежні. Онлайн-конкурс від японського організатора:
countries = [], is_international = true — їхати нікуди не треба, але
можливість міжнародна.

Не вгадуй. Якщо з тексту місце незрозуміле — countries порожній."""


def _payload(rows: list[dict]) -> str:
    lines = []
    for i, r in enumerate(rows):
        details = (r.get("details") or "")[:DETAILS_LIMIT]
        lines.append(
            f"[{i}] {r.get('title') or ''}\n"
            f"джерело: {r.get('source') or '—'}\n"
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

    q = (db.table("opportunities")
         .select("id, title, summary, details, source, countries, is_international")
         .eq("status", "active")
         .is_("canonical_slug", "null"))
    if args.limit:
        q = q.limit(args.limit)
    rows = q.execute().data or []
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
