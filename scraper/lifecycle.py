"""lifecycle.py — планова перевірка: єдиний власник життя запису в часі.

Навіщо. Аудит «Дедлайн, подія, сезон» (17.09.2026) знайшов, що записом у часі
керували шість процесів, кожен за своїм розкладом і своїм списком типів:
check-deadlines закривав і стирав дедлайни, ttl_requeue перечитував сторінки
за TTL типу, recheck_dates і backfill_deadlines щотижня перечитували базу,
сезонна перевірка давала одну спробу на рік. Наслідки: 128 періодичних програм
(зокрема Всеукраїнські олімпіади) закрились назавжди; конкурси й гранти з
минулим дедлайном висіли активними як «щорічні»; токени йшли пропорційно
розміру бази, а не тому, що справді треба перевірити.

Принцип Марії: «ціль не скрапити нон-стоп, а мати базу і періодично її
продивлятися або оновлювати». Тому тут три кроки:

  A. Закриття за датою — без моделі й без мережі. Минула подача чи подія →
     запис закривається, а дата наступної перевірки залежить від виду:
     одноразова — жодної; періодична — перед наступним сезоном; постійна —
     скоро (минула дата в постійної — суперечність); невідомий вид — скоро.
     Між сезонами періодична програма зникає зі списків, сторінка живе
     (рішення Марії «Б»).
  B. Планова перевірка — лише записи, чия дата перевірки настала. Читаємо
     сторінку чи допис у Telegram і вирішуємо: сезон відкрито → запис
     активний з новими датами; ще не відкрито → дивимось через два тижні;
     сезон завершився → наступна перевірка перед наступним сезоном; програми
     більше немає → позначка модератору. Минулих дат не пишемо ніколи.
  C. --bootstrap: разово ставить першу дату перевірки тим, у кого її немає,
     рівномірно по днях.

Схвалені людиною записи теж оновлюються — але лише полями часу (статус,
дати, дата перевірки, вид). Текст, який правила людина, не чіпаємо.

Запуск:
    python scraper/lifecycle.py --dry-run               # що зробив би сьогодні
    python scraper/lifecycle.py --bootstrap --dry-run   # розклад перших перевірок
    python scraper/lifecycle.py                         # щоденний прогін
"""
from __future__ import annotations

import argparse
import logging
import os
import time
from collections import Counter
from datetime import date, timedelta

import anthropic

import api_guard
from db import get_client
from recheck_dates import _date_supported_by, _valid_date, _with_trace, fetch_text
from remark import telegram_text, _TG_POST
from timing import (
    LABELS, PERMANENT_RECHECK_DAYS, RETRY_DAYS, UNKNOWN_RECHECK_DAYS,
    clean_kind, clean_months, clean_text, evidence_in_text, is_expired,
    next_season_check, recheck_after_close, spread_date,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("lifecycle")

MODEL = "claude-haiku-4-5-20251001"
DAILY_LIMIT = int(os.environ.get("LIFECYCLE_LIMIT") or "30")
PAGE_CHARS = 9000
DELAY = 0.6

SELECT = ("id, title, source, source_url, status, opportunity_type, timing_kind, "
          "season_months, deadline, event_start_date, event_end_date, recheck_at, "
          "verified_at, admin_comment")

STATES = ("open", "upcoming", "ended", "gone", "unclear")

TOOL = {
    "name": "check_season",
    "description": "Стан можливості на сьогодні за текстом її джерела",
    "input_schema": {
        "type": "object",
        "properties": {
            "state": {
                "type": "string",
                "enum": list(STATES),
                "description": "open — подати заявку чи записатися можна просто зараз; "
                               "upcoming — новий сезон оголошено, але подача ще не "
                               "відкрита; ended — цей сезон чи набір завершено, про "
                               "новий нічого; gone — програми за цією адресою більше "
                               "немає або сторінка не про неї; unclear — не зрозуміло.",
            },
            "deadline": {"type": ["string", "null"],
                         "description": "YYYY-MM-DD — останній день ПОДАЧІ поточного чи "
                                        "наступного сезону, якщо названий."},
            "event_start_date": {"type": ["string", "null"],
                                 "description": "YYYY-MM-DD — перший день проведення."},
            "event_end_date": {"type": ["string", "null"],
                               "description": "YYYY-MM-DD — останній день проведення."},
            "evidence": {"type": "string",
                         "description": "ДОСЛІВНА цитата зі сторінки, на якій ґрунтуються "
                                        "стан і дати. Дата мусить стояти в цитаті."},
            "timing_kind": {"type": "string",
                            "enum": ["one_time", "periodic", "permanent", "unknown"]},
            "season_months": {"type": "array",
                              "items": {"type": "integer", "minimum": 1, "maximum": 12}},
            "kind_evidence": {"type": "string",
                              "description": "ДОСЛІВНА цитата, з якої видно вид. "
                                             "Немає — порожньо."},
        },
        "required": ["state", "evidence", "timing_kind"],
    },
}

SYSTEM = """Сьогодні {today}. Ти перевіряєш, у якому стані зараз можливість для
дітей, за текстом її джерела — сторінки чи допису. Відповідай лише за текстом.

НІЧОГО НЕ ВИГАДУЙ. Кожен висновок — з дослівною цитатою. Дату пиши лише тоді,
коли вона стоїть у цитаті. Рік не вказано — найближчий майбутній; але якщо
текст про минулий сезон, дат не пиши.

Дати — дві різні речі: «до коли подати» → deadline; «коли відбувається» →
event_start_date / event_end_date. День початку події — не дедлайн.

Стан:
- open — подати чи записатися можна зараз: дедлайн попереду, набір триває,
  форма відкрита, запис постійний.
- upcoming — новий сезон оголошено, але подача ще не відкрита.
- ended — цьогорічний сезон завершено, про новий нічого. Сторінка з
  торішніми датами — теж ended, а не open.
- gone — програми за адресою більше немає: сторінка про інше, «проєкт
  завершено назавжди», організація припинила програму.
- unclear — не зрозуміло.

Вид (timing_kind): one_time — разова подія чи набір; periodic — повторюється
циклами («щороку», «традиційний», «VII Всеукраїнський»); permanent —
записатися можна будь-коли; unknown — не видно. season_months — для periodic:
місяці, коли зазвичай відкрита подача чи проходить подія, з тексту."""


# ── A. Закриття за датою ────────────────────────────────────────────────────

def plan_close(row: dict, today: date) -> dict | None:
    """Патч для запису, що минув, або None. Чиста функція — під тести."""
    if row.get("status") != "active" or not is_expired(row, today):
        return None
    kind = row.get("timing_kind")
    dates = [row.get("deadline"), row.get("event_start_date"), row.get("event_end_date")]
    recheck = recheck_after_close(kind, row.get("season_months"), dates, today)
    last = row.get("deadline") or row.get("event_end_date") or row.get("event_start_date")
    label = LABELS.get(kind, "вид невідомий")
    note = (f"lifecycle: закрито {today.isoformat()} — дата {last} минула ({label})"
            + (f", перевірка {recheck.isoformat()}" if recheck else ""))
    return {"status": "closed",
            "recheck_at": recheck.isoformat() if recheck else None,
            "admin_comment": _with_trace(row, note)}


# ── B. Планова перевірка ────────────────────────────────────────────────────

def decide_check(row: dict, out: dict, page: str, today: date) -> dict:
    """Що змінити за результатом перевірки. Чиста функція — під тести."""
    iso_today = today.isoformat()
    state = out.get("state") if out.get("state") in STATES else "unclear"
    evidence = (out.get("evidence") or "").strip()

    # Вид: беремо з перевірки лише тоді, коли запис його ще не має і модель
    # навела справжню цитату (правило розмітки від 17.09.2026).
    kind = row.get("timing_kind")
    patch: dict = {}
    new_kind = clean_kind(out.get("timing_kind"))
    kind_quote = (out.get("kind_evidence") or "").strip()
    if not kind and new_kind and kind_quote and evidence_in_text(kind_quote, page):
        kind = new_kind
        patch["timing_kind"] = kind
        if kind == "periodic":
            months = clean_months(out.get("season_months"))
            if months:
                patch["season_months"] = months
    months = patch.get("season_months") or row.get("season_months")

    # Дати: лише ті, що стоять у цитаті, і лише майбутні.
    fresh = {}
    for key in ("deadline", "event_start_date", "event_end_date"):
        val = _valid_date(out.get(key))
        if val and _date_supported_by(val, evidence) and val >= iso_today:
            fresh[key] = val
    if fresh.get("event_start_date") and fresh.get("event_end_date") \
            and fresh["event_start_date"] > fresh["event_end_date"]:
        fresh.pop("event_start_date")
    if fresh.get("deadline") and fresh.get("event_end_date") \
            and fresh["deadline"] > fresh["event_end_date"]:
        fresh = {}                                    # суперечність — не пишемо

    quote = f"«{evidence[:100]}»" if evidence else "без цитати"

    if state == "gone":
        patch.update({"status": "closed", "recheck_at": None})
        note = f"програми за адресою більше немає — перевір: {quote}"
    elif state == "open" and (fresh or kind == "permanent"):
        patch.update({"status": "active", **fresh})
        # Нові дати сезону замінюють старі цілком — старі належать минулому циклу.
        for key in ("deadline", "event_start_date", "event_end_date"):
            if fresh and key not in fresh:
                patch[key] = None
        patch["recheck_at"] = ((today + timedelta(days=PERMANENT_RECHECK_DAYS)).isoformat()
                               if kind == "permanent" and not fresh else None)
        note = f"відкрито: {quote}"
    elif state == "upcoming":
        patch.update({"status": "closed", **fresh,
                      "recheck_at": (today + timedelta(days=RETRY_DAYS)).isoformat()})
        note = f"новий сезон оголошено, подача ще не відкрита: {quote}"
    elif state == "ended":
        dates = [row.get("deadline"), row.get("event_start_date"), row.get("event_end_date")]
        recheck = recheck_after_close(kind, months, dates, today)
        patch.update({"status": "closed",
                      "recheck_at": recheck.isoformat() if recheck else None})
        note = f"сезон завершено: {quote}"
    else:
        # unclear, або «open» без жодної майбутньої дати в цитаті.
        days = UNKNOWN_RECHECK_DAYS if row.get("status") == "active" else RETRY_DAYS
        patch["recheck_at"] = (today + timedelta(days=days)).isoformat()
        note = f"стан не зрозумілий, ще раз {patch['recheck_at']}: {quote}"

    patch["admin_comment"] = _with_trace(row, f"lifecycle {iso_today}: {note}"[:240])
    return patch


def _source_text(row: dict) -> tuple[str | None, str]:
    url = (row.get("source_url") or "").strip()
    if _TG_POST.match(url):
        text = telegram_text(url)
        if text:
            return text, "telegram"
    if not url.startswith("http"):
        return None, "немає адреси"
    time.sleep(DELAY)
    text, why, kind = fetch_text(url)
    return (text, "сторінка") if kind == "ok" else (None, why)


def _ask(ai, row: dict, page: str, today: date) -> dict:
    for attempt in range(3):
        try:
            resp = ai.messages.create(
                model=MODEL, max_tokens=900,
                system=SYSTEM.format(today=today.isoformat()),
                tools=[TOOL], tool_choice={"type": "tool", "name": "check_season"},
                messages=[{"role": "user", "content":
                           f"Можливість: «{row.get('title')}» (тип: {row.get('opportunity_type')})\n"
                           f"Адреса: {row.get('source_url')}\n\n"
                           f"Текст джерела:\n{clean_text(page)[:PAGE_CHARS]}"}],
            )
            block = next((b for b in resp.content if b.type == "tool_use"), None)
            return block.input if block else {}
        except anthropic.APIStatusError as e:
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


# ── C. Перший розклад ───────────────────────────────────────────────────────

def plan_bootstrap(row: dict, today: date) -> str | None:
    """Перша дата перевірки для запису без неї. Чиста функція — під тести."""
    if row.get("recheck_at"):
        return None
    kind = row.get("timing_kind")
    has_dates = any(row.get(k) for k in ("deadline", "event_start_date", "event_end_date"))
    if row.get("status") == "active":
        if kind == "permanent":
            return spread_date(row["id"], today, PERMANENT_RECHECK_DAYS).isoformat()
        if not has_dates:
            # Без дати запис не закриється сам — подивитись на джерело протягом місяця.
            return spread_date(row["id"], today, UNKNOWN_RECHECK_DAYS).isoformat()
        return None                     # з датою — закриття за датою все зробить
    if row.get("status") == "closed" and kind == "periodic":
        months = row.get("season_months")
        if months:
            return next_season_check(months, [], today).isoformat()
        # Сезон невідомий (так у Всеукраїнських олімпіад) — протягом трьох тижнів.
        return spread_date(row["id"], today, 21).isoformat()
    return None


# ── Прогін ─────────────────────────────────────────────────────────────────

def _load(db, build) -> list[dict]:
    rows, start = [], 0
    while True:
        page = build().order("id").range(start, start + 999).execute().data or []
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    default=os.environ.get("DRY_RUN", "").lower() == "true")
    ap.add_argument("--bootstrap", action="store_true",
                    default=os.environ.get("BOOTSTRAP", "").lower() == "true")
    ap.add_argument("--limit", type=int, default=DAILY_LIMIT)
    args = ap.parse_args()
    today = date.today()
    db = get_client()
    dry = " (СУХИЙ ПРОГІН)" if args.dry_run else ""

    def write(row_id, patch):
        if not args.dry_run:
            db.table("opportunities").update(patch).eq("id", row_id).execute()

    # A ────────────────────────────────────────────────────────────────────
    iso = today.isoformat()
    expired = _load(db, lambda: db.table("opportunities").select(SELECT)
                    .eq("status", "active").is_("canonical_slug", "null")
                    .or_(f"deadline.lt.{iso},event_end_date.lt.{iso},event_start_date.lt.{iso}"))
    closed = Counter()
    logger.info("%s\nA. Закриття за датою%s", "=" * 70, dry)
    for row in expired:
        patch = plan_close(row, today)
        if not patch:
            continue
        closed[row.get("timing_kind") or "—"] += 1
        logger.info("  ✕ %s · %s · перевірка %s", (row["title"] or "")[:60],
                    LABELS.get(row.get("timing_kind"), "вид невідомий"), patch["recheck_at"] or "—")
        write(row["id"], patch)
    logger.info("  закрито: %d %s", sum(closed.values()), dict(closed))

    # C ────────────────────────────────────────────────────────────────────
    if args.bootstrap:
        rows = _load(db, lambda: db.table("opportunities").select(SELECT)
                     .in_("status", ["active", "closed"]).is_("canonical_slug", "null")
                     .is_("recheck_at", "null"))
        plan = Counter()
        by_day = Counter()
        logger.info("\nC. Перший розклад перевірок%s", dry)
        for row in rows:
            when = plan_bootstrap(row, today)
            if not when:
                continue
            plan[(row["status"], row.get("timing_kind") or "—")] += 1
            by_day[when] += 1
            write(row["id"], {"recheck_at": when})
        for (status, kind), n in sorted(plan.items()):
            logger.info("  %-7s %-10s %4d", status, kind, n)
        busiest = by_day.most_common(1)
        logger.info("  разом %d, найбільше за день: %s", sum(plan.values()),
                    busiest[0] if busiest else "—")

    # B ────────────────────────────────────────────────────────────────────
    due = (db.table("opportunities").select(SELECT)
           .in_("status", ["active", "closed"]).is_("canonical_slug", "null")
           .lte("recheck_at", iso).order("recheck_at").limit(args.limit)
           .execute().data or [])
    logger.info("\nB. Планова перевірка: %d записів на сьогодні (ліміт %d)%s",
                len(due), args.limit, dry)
    if due:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            logger.error("Немає ANTHROPIC_API_KEY")
            return 1
        ai = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
        states = Counter()
        for row in due:
            page, whence = _source_text(row)
            if not page:
                retry = (today + timedelta(days=RETRY_DAYS)).isoformat()
                states["без тексту"] += 1
                logger.info("  ? %s — %s, ще раз %s", (row["title"] or "")[:60], whence, retry)
                write(row["id"], {"recheck_at": retry, "admin_comment": _with_trace(
                    row, f"lifecycle {iso}: джерело не прочиталось ({whence}), ще раз {retry}")})
                continue
            out = _ask(ai, row, page, today)
            patch = decide_check(row, out, page, today)
            states[out.get("state") or "unclear"] += 1
            changes = {k: v for k, v in patch.items() if k != "admin_comment"}
            logger.info("  • %s [%s → %s] %s", (row["title"] or "")[:55], row["status"],
                        out.get("state"), changes)
            write(row["id"], patch)
        logger.info("  підсумок: %s", dict(states))

    if args.dry_run:
        logger.info("\nСУХИЙ ПРОГІН — у базу нічого не записано.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
