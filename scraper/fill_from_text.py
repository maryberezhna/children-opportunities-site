"""fill_from_text.py — дозаповнити чернетки в черзі тим, що прямо є в тексті.

Нові записи дозаповнює сам нормалізатор (_sanitize → _fill_from_text). Цей
скрипт — для тих, що вже лежать у черзі модерації з «бракує: …», хоча відповідь
стоїть у назві чи описі. Правила ті самі (scraper/text_fill.py), тож скрипт і
нормалізатор не розійдуться.

Технічні заглушки теж вважаються порожніми: вік 0–18 і тип «Курс», якщо
нормалізатор залишив про них позначку «бракує …».

Статус не змінюється: чернетка лишається чернеткою, публікує людина. Зникає
лише «бракує», і модератор публікує одним кліком.

    python scraper/fill_from_text.py            # показати, нічого не писати
    python scraper/fill_from_text.py --apply    # записати
"""
from __future__ import annotations

import argparse
import logging

from db import get_client
from normalizer import VALID_COUNTRIES, VALID_OPP_TYPES, _fill_from_text

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("fill_from_text")

FIELDS = ("id, slug, title, summary, status, opportunity_type, cost_type, format, cities, "
          "countries, age_from, age_to, deadline, event_start_date, event_end_date, "
          "results_date, recurrence, admin_comment")
WATCHED = ("opportunity_type", "cost_type", "cities", "countries", "age_from", "age_to",
           "recurrence")
AGE_STUB = "вік 0–18 поставлено технічно"


def plan(row: dict) -> dict:
    """Що змінити в записі. Чиста функція — під тести."""
    comment = row.get("admin_comment") or ""
    data = dict(row)
    data["admin_comment"] = ""                       # нові позначки окремо від старих
    age_missing = AGE_STUB in comment
    # Заглушка типу: «бракує … тип» від нормалізатора.
    if "бракує" in comment and "тип" in comment.split("бракує", 1)[1][:80]:
        data["opportunity_type"] = None
    if data.get("countries") and not all(c in VALID_COUNTRIES for c in data["countries"]):
        data["countries"] = [c for c in data["countries"] if c in VALID_COUNTRIES] or None
    _fill_from_text(data, age_missing)

    patch = {}
    for key in WATCHED:
        new, old = data.get(key), row.get(key)
        if key == "opportunity_type" and new not in VALID_OPP_TYPES:
            continue
        if new != old and new not in (None, [], ""):
            patch[key] = new
    if patch:
        patch["admin_comment"] = (comment + " · 21.09 з тексту: " + data["admin_comment"]
                                  .replace("auto: ", "")).strip(" ·")[:1000]
    return patch


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    db = get_client()
    rows = (db.table("opportunities").select(FIELDS)
            .eq("status", "draft").is_("canonical_slug", "null")
            .execute().data or [])
    logger.info("Чернеток у черзі: %d%s\n", len(rows), "" if args.apply else " (СУХИЙ ПРОГІН)")
    changed = 0
    for row in rows:
        patch = plan(row)
        if not patch:
            continue
        changed += 1
        shown = {k: v for k, v in patch.items() if k != "admin_comment"}
        logger.info("  • %s\n      %s", (row.get("title") or "")[:70], shown)
        if args.apply:
            db.table("opportunities").update(patch).eq("id", row["id"]).execute()
    logger.info("\nДозаповнено з тексту: %d із %d%s", changed, len(rows),
                "" if args.apply else " — нічого не записано, для запису --apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
