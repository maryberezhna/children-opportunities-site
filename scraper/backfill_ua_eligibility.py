"""backfill_ua_eligibility.py — «Хто може подати» для закордонних можливостей.

Навіщо. Марія, 22.10.2026: «для всіх закордонних можливостей має бути точно
вказано, чи може дитина з України подати заявку, якщо ні — чи з діаспори».
Того ж дня пост про RSI стояв у плані з «дедлайном тижня», а програма
приймає лише громадян чи резидентів США. Нові записи отримують відповідь у
нормалізаторі (apply_ua_eligibility); цей скрипт дозаповнює наявні.

Відповідь — лише з дослівною фразою сторінки. Фрази немає → «unknown», і
сайт пише «Не вказано — уточнюйте в організатора». Вгадане «можна» шкодить
більше за чесне «не знаємо».

Кому. Активні й закриті записи з is_international або країною поза Україною,
у яких ua_eligibility ще порожнє. Один запис на виклик: текст сторінки довгий,
і пачкою модель плутає, чия це фраза.

Запуск:
    python scraper/backfill_ua_eligibility.py --dry-run
    python scraper/backfill_ua_eligibility.py --limit 20
    python scraper/backfill_ua_eligibility.py --ids a,b   # наново, навіть якщо заповнено
"""
from __future__ import annotations

import argparse
import logging
import os
import time

import anthropic

import api_guard  # відмова через ліміт/оплату робить запуск червоним
from db import get_client
from normalizer import apply_ua_eligibility
from recheck_dates import fetch_text
from remark import source_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill_ua_eligibility")

MODEL = "claude-haiku-4-5-20251001"
PAGE_CHARS = 12000

TOOL = {
    "name": "set_ua_eligibility",
    "description": "Хто може подати заявку на цю можливість — за текстом сторінки",
    "input_schema": {
        "type": "object",
        "properties": {
            "ua_eligibility": {
                "type": "string",
                "enum": ["from_ukraine", "abroad_only", "none", "unknown"],
            },
            "ua_eligibility_quote": {
                "type": ["string", "null"],
                "description": "Дослівна фраза зі сторінки (мовою сторінки), з якої "
                               "видно, хто може подати. Без фрази — null.",
            },
            "ua_eligibility_note": {
                "type": ["string", "null"],
                "description": "Коротко українською, для кого саме: «громадяни або "
                               "резиденти США», «діти, які живуть у Польщі», «учні "
                               "з будь-якої країни». До 100 знаків. Інакше null.",
            },
        },
        "required": ["ua_eligibility", "ua_eligibility_quote", "ua_eligibility_note"],
    },
}

SYSTEM = """Ти читаєш сторінку закордонної або міжнародної можливості для дітей і
відповідаєш на одне питання: чи може подати заявку дитина, яка живе в Україні,
а якщо ні — чи можуть діти, які живуть за кордоном (діаспора).

ua_eligibility:
- from_ukraine — дитина з України може подати: Україна серед країн-учасниць,
  «open to students worldwide», «from any country», «international applicants
  welcome», конкурс приймає роботи з усього світу.
- abroad_only — лише діти, які живуть у певній країні чи країнах, без вимоги
  громадянства: школа чи табір діаспори в Польщі, програма для резидентів
  Німеччини, «для українських дітей, які перебувають у Чехії».
- none — лише громадяни або постійні резиденти певної країни (країн), і
  України серед них немає: «U.S. citizens or permanent residents only»,
  «open to EU citizens».
- unknown — сторінка про це не каже.

Правила:
- Лише зі слів сторінки. Не вгадуй із назви чи з того, що організатор
  закордонний: «міжнародний» у назві ще не означає «можна з України».
- ua_eligibility_quote — дослівна фраза зі сторінки, з якої це видно, мовою
  сторінки, без перекладу й без змін. Немає такої фрази — unknown і null.
- Не плутай вимогу до віку чи мови з вимогою до країни."""


def _ask(client, row: dict, text: str) -> dict | None:
    content = (f"Назва: {row.get('title') or ''}\n"
               f"Країни: {', '.join(row.get('countries') or []) or '—'}\n\n"
               f"Текст сторінки:\n{text[:PAGE_CHARS]}")
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=600,
                system=[{"type": "text", "text": SYSTEM,
                         "cache_control": {"type": "ephemeral"}}],
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "set_ua_eligibility"},
                messages=[{"role": "user", "content": content}],
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
            return dict(block.input)
    return None


def is_foreign(row: dict) -> bool:
    return bool(row.get("is_international")) or any(
        c and c != "ua" for c in (row.get("countries") or []))


def page_text(db, row: dict) -> tuple[str | None, str]:
    """Текст джерела, а якщо є окрема сторінка подачі — і вона: умови участі
    («Eligibility») часто стоять саме там, а не на сторінці програми."""
    text, where = source_text(db, row)
    apply_url = (row.get("apply_url") or "").strip()
    if apply_url.startswith("http") and apply_url != (row.get("source_url") or "").strip():
        extra, _why, kind = fetch_text(apply_url)
        if kind == "ok" and extra:
            text = f"{text or ''}\n\n{extra}"
            where = f"{where} + сторінка подачі"
    return text, where


def plan(row: dict, ans: dict, text: str) -> dict:
    """Що записати. Чиста функція — під тести: перевірку цитати робить той
    самий apply_ua_eligibility, що й нормалізатор."""
    data = {"is_international": True, **ans}
    apply_ua_eligibility(data, text)
    patch = {"ua_eligibility": data["ua_eligibility"],
             "ua_eligibility_note": data["ua_eligibility_note"]}
    quote = (data.get("evidence") or {}).get("ua")
    if quote:
        ev = row.get("evidence") if isinstance(row.get("evidence"), dict) else {}
        patch["evidence"] = {**ev, "ua": quote}
    return patch


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int,
                    default=int(os.environ.get("LIMIT") or 0) or None)
    ap.add_argument("--dry-run", action="store_true",
                    default=os.environ.get("DRY_RUN", "").lower() == "true")
    ap.add_argument("--ids", default=os.environ.get("IDS") or "")
    args = ap.parse_args()
    ids = [x.strip() for x in args.ids.split(",") if x.strip()]

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("Немає ANTHROPIC_API_KEY")
        return 1

    db = get_client()
    ai = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])

    cols = ("id, title, source_url, apply_url, countries, is_international, "
            "evidence, ua_eligibility")
    rows, start = [], 0
    if ids:
        rows = db.table("opportunities").select(cols).in_("id", ids).execute().data or []
    while not ids:
        page = (db.table("opportunities").select(cols)
                .in_("status", ["active", "closed"])
                .is_("ua_eligibility", "null")
                .order("id")
                .range(start, start + 999)
                .execute().data or [])
        rows.extend(r for r in page if is_foreign(r))
        if len(page) < 1000:
            break
        start += 1000
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Записів до перевірки: %d", len(rows))

    counts: dict[str, int] = {}
    for row in rows:
        text, where = page_text(db, row)
        if not text:
            # Без тексту не пишемо навіть «unknown»: наступний прогін спробує ще.
            logger.warning("Без тексту (%s): %s", where, row["title"][:60])
            counts["без тексту"] = counts.get("без тексту", 0) + 1
            continue
        ans = _ask(ai, row, text)
        if not ans:
            logger.warning("Модель не відповіла: %s", row["title"][:60])
            continue
        patch = plan(row, ans, text)
        v = patch["ua_eligibility"]
        counts[v] = counts.get(v, 0) + 1
        logger.info("%-12s %s | %s | %s", v, row["title"][:56],
                    patch.get("ua_eligibility_note") or "",
                    ((patch.get("evidence") or {}).get("ua") or "")[:90])
        if args.dry_run:
            continue
        db.table("opportunities").update(patch).eq("id", row["id"]).execute()

    logger.info("Готово%s: %s", " (dry-run, нічого не записано)" if args.dry_run else "",
                ", ".join(f"{k} {n}" for k, n in sorted(counts.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
