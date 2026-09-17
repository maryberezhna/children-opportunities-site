"""classify_timing.py — вид кожної можливості за часом, один раз на всю базу.

Навіщо. Поле timing_kind (одноразова / періодична / постійна) з'явилось
17.09.2026, і всі наявні записи в ньому порожні. Без виду не можна ні
правильно закривати записи, ні повертати періодичні програми в новий сезон,
ні планувати перевірки за календарем замість перечитувати базу щодня.

Як витрачаємо токени. Принцип Марії: «ціль не скрапити нон-стоп, а мати базу
і періодично її продивлятися». Тому:
  1. Спершу правила з scraper/timing.py — без моделі. Гуртки, платформи з
     вільним записом, виплати без строку, записи з прочитаним «щороку».
  2. Решту — модель, пачками по 15, за ТЕКСТОМ, УЖЕ ЗБЕРЕЖЕНИМ У БАЗІ (опис,
     деталі, сирець із raw_items). Жодного походу на сайти джерел.
  3. Порожнє, якщо з тексту не зрозуміло. Нічого не вигадуємо.

Кого розмічаємо: активні й закриті записи, не дублі, з порожнім timing_kind.
Закриті теж — серед них 128 періодичних програм, які треба повернути в сезон.

recheck_at тут НЕ ставиться навмисно: старий сезонний прохід ttl_requeue
стирає його після першої ж спроби. Дата перевірки з'явиться разом із
плановою перевіркою, що прийде йому на заміну.

Запуск:
    python scraper/classify_timing.py --dry-run --limit 60   # подивитись
    python scraper/classify_timing.py --dry-run               # весь звіт
    python scraper/classify_timing.py                          # записати
"""
from __future__ import annotations

import argparse
import logging
import os
import time
from collections import Counter

import anthropic

import api_guard
from db import get_client
from timing import (
    LABELS, accept_model_kind, clean_kind, clean_months, clean_text,
    from_injecting_source, months_from_dates, recurrence_from_text, rule_kind,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("classify_timing")

MODEL = "claude-haiku-4-5-20251001"
BATCH = 15
TEXT_LIMIT = 1500

TOOL = {
    "name": "set_timing",
    "description": "Вид кожної можливості за часом",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "i": {"type": "integer", "description": "Номер запису зі списку"},
                        "kind": {
                            "type": "string",
                            "enum": ["one_time", "periodic", "permanent", "unknown"],
                        },
                        "season_months": {
                            "type": "array",
                            "items": {"type": "integer", "minimum": 1, "maximum": 12},
                            "description": "Лише для periodic: місяці, коли зазвичай "
                                           "відкрита подача або проходить подія. Лише з "
                                           "тексту чи з наведених дат. Не знаєш — [].",
                        },
                        "evidence": {
                            "type": "string",
                            "description": "Коротка цитата з тексту або «дати в записі: …», "
                                           "на якій ґрунтується висновок. До 120 знаків.",
                        },
                    },
                    "required": ["i", "kind", "evidence"],
                },
            },
        },
        "required": ["items"],
    },
}

SYSTEM = """Ти визначаєш, до якого виду за часом належить кожна можливість для
дітей. Видів три, і вони не про тип, а про те, як можливість живе в часі.

one_time — ОДНОРАЗОВА. Одна конкретна подія чи набір, що в такому вигляді не
повториться: вебінар; курс-когорта з датою старту («UF Startup School 2026»);
конкурс конкретного року без ознак, що він щорічний; обмін Erasmus+ на
конкретні дати; зміна табору; разова акція.

periodic — ПЕРІОДИЧНА. Повторюється циклами з перервами між ними: олімпіада;
стипендіальна програма з набором раз на рік; щорічний конкурс; щорічна літня
школа; гурток чи студія з набором на початку навчального року. Ознаки в
тексті: «щороку», «щорічний», «традиційний», порядковий номер («XII
Всеукраїнський»), «новий сезон», «набір на 2026/27 навчальний рік».

permanent — ПОСТІЙНА. Записатися чи звернутися можна будь-коли: онлайн-курс
у власному темпі; державна виплата чи допомога з постійним прийомом;
гурток із вільним записом протягом року; постійна послуга чи консультація.

unknown — текст не дає підстав вирішити. Це нормальна відповідь.

ПРАВИЛА:
- НІЧОГО НЕ ВИГАДУЙ. Вирішуй за текстом і датами запису. Тип можливості —
  лише підказка: «конкурс» буває і одноразовим, і щорічним; «курс» — і
  когортою, і постійною платформою.
- Рік у назві («Конкурс 2026») сам по собі не робить можливість одноразовою
  і не робить періодичною — шукай інші ознаки. Немає їх — unknown.
- season_months — лише для periodic: місяці, коли зазвичай відкрита подача
  або проходить подія. Бери з тексту («реєстрація щороку у жовтні») або з
  наведених дат запису. Нічого з цього немає — порожній масив.
- evidence — ДОСЛІВНА цитата з тексту (скопіюй шматок як є) або
  «дати в записі: …». Міркування на кшталт «олімпіади зазвичай щорічні» — не
  доказ: тоді unknown.
- Регулярний розклад занять («щосуботи», «двічі на тиждень») — не цикл
  сезонів. Якщо записатися можна будь-коли — permanent; якщо це серія зустрічей
  з конкретними датами — one_time.
- Одна програма з датами «з вересня по грудень» без ознак, що вона
  повторюється, — one_time, не periodic.
- periodic лише з ознакою повторення в тексті: «щороку», «щорічний»,
  «традиційний», порядковий номер («VII Всеукраїнський»), «новий сезон».
- Поверни відповідь для КОЖНОГО запису зі списку, за його номером i."""


def _text_for(row: dict, raw_texts: dict[str, str]) -> str:
    return clean_text(row.get("summary"), row.get("details"),
                      raw_texts.get(row.get("source_url") or ""),
                      drop_permanent_claims=from_injecting_source(row))[:TEXT_LIMIT]


def _payload(rows: list[dict], raw_texts: dict[str, str]) -> str:
    parts = []
    for i, r in enumerate(rows):
        dates = []
        for key, label in (("deadline", "заявки до"), ("event_start_date", "початок події"),
                           ("event_end_date", "кінець події")):
            if r.get(key):
                dates.append(f"{label} {r[key]}")
        rec = recurrence_from_text(r)
        if rec:
            dates.append("позначено з тексту: " + ("щороку" if rec == "annual" else "постійно"))
        text = _text_for(r, raw_texts)
        parts.append(
            f"[{i}] {r.get('title') or ''}\n"
            f"тип: {r.get('opportunity_type') or '—'} · джерело: {r.get('source') or '—'}"
            f" · статус: {r.get('status')}\n"
            f"дати в записі: {', '.join(dates) or 'немає'}\n"
            f"текст: {text}"
        )
    return "\n\n---\n\n".join(parts)


def _ask(ai, rows: list[dict], raw_texts: dict[str, str]) -> dict[int, dict]:
    """Один виклик на пачку; системний промпт кешується між пачками."""
    for attempt in range(3):
        try:
            resp = ai.messages.create(
                model=MODEL,
                max_tokens=3000,
                system=[{"type": "text", "text": SYSTEM,
                         "cache_control": {"type": "ephemeral"}}],
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "set_timing"},
                messages=[{"role": "user", "content": _payload(rows, raw_texts)}],
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
            return {it.get("i"): it for it in block.input.get("items", [])}
    return {}


def _load_rows(db) -> list[dict]:
    rows, start = [], 0
    while True:
        page = (db.table("opportunities")
                .select("id, title, summary, details, opportunity_type, source, source_url, "
                        "status, deadline, event_start_date, event_end_date, recurrence, "
                        "admin_comment")
                .in_("status", ["active", "closed"])
                .is_("canonical_slug", "null")
                .is_("timing_kind", "null")
                .order("id")
                .range(start, start + 999)
                .execute().data or [])
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    return rows


def _raw_texts(db, urls: list[str]) -> dict[str, str]:
    """Найсвіжіший сирець для кожної адреси — з бази, без походу на сайт."""
    out = {}
    for url in urls:
        if not url or url in out:
            continue
        try:
            got = (db.table("raw_items").select("raw_text").eq("source_url", url)
                   .order("fetched_at", desc=True).limit(1).execute().data or [])
        except Exception:
            got = []
        if got and got[0].get("raw_text"):
            out[url] = got[0]["raw_text"]
    return out


def _trace(row: dict, kind: str, why: str) -> str:
    note = f"вид: {LABELS[kind]} — {why}"[:220]
    return f"{row.get('admin_comment') or ''} · {note}".strip(" ·")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=int(os.environ.get("LIMIT") or 0) or None)
    ap.add_argument("--dry-run", action="store_true",
                    default=os.environ.get("DRY_RUN", "").lower() == "true")
    args = ap.parse_args()

    db = get_client()
    rows = _load_rows(db)
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Без виду: %d записів%s", len(rows), " (СУХИЙ ПРОГІН)" if args.dry_run else "")

    decided: list[tuple[dict, str, list[int] | None, str, str]] = []  # row, kind, months, why, how
    for_model = []
    for r in rows:
        rule = rule_kind(r)
        if rule:
            kind, months, why = rule
            decided.append((r, kind, months, why, "правило"))
        else:
            for_model.append(r)
    logger.info("За правилами: %d · модели: %d", len(decided), len(for_model))

    unknown = []
    if for_model:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            logger.error("Немає ANTHROPIC_API_KEY")
            return 1
        ai = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
        raw = _raw_texts(db, [r.get("source_url") for r in for_model])
        for start in range(0, len(for_model), BATCH):
            chunk = for_model[start:start + BATCH]
            answers = _ask(ai, chunk, raw)
            for i, r in enumerate(chunk):
                ans = answers.get(i) or {}
                kind = clean_kind(ans.get("kind"))
                evidence = (ans.get("evidence") or "").strip()
                if not kind or not accept_model_kind(r, kind, evidence, _text_for(r, raw)):
                    unknown.append(r)
                    continue
                months = clean_months(ans.get("season_months")) if kind == "periodic" else None
                if kind == "periodic" and not months:
                    months = months_from_dates(r) or None
                decided.append((r, kind, months, f"«{evidence[:120]}»", "модель"))

    # ── Звіт ────────────────────────────────────────────────────────────
    by = Counter((r["status"], kind) for r, kind, *_ in decided)
    how = Counter(h for *_, h in decided)
    logger.info("\n%s\nРЕЗУЛЬТАТ", "=" * 70)
    for status in ("active", "closed"):
        logger.info("  %-7s одноразові %4d · періодичні %4d · постійні %4d · невідомо %4d",
                    status, by[(status, "one_time")], by[(status, "periodic")],
                    by[(status, "permanent")], sum(1 for r in unknown if r["status"] == status))
    logger.info("  вирішено правилами %d, моделлю %d", how["правило"], how["модель"])

    for kind in ("one_time", "periodic", "permanent"):
        sample = [d for d in decided if d[1] == kind and d[4] == "модель"][:15]
        if sample:
            logger.info("\n— %s (модель), приклади:", LABELS[kind])
            for r, _k, months, why, _h in sample:
                logger.info("  [%s] %s%s — %s", r["opportunity_type"], (r["title"] or "")[:60],
                            f" · місяці {months}" if months else "", why[:100])
    closed_periodic = [d for d in decided if d[1] == "periodic" and d[0]["status"] == "closed"]
    logger.info("\n— закриті періодичні (кандидати на повернення в сезон): %d", len(closed_periodic))
    for r, _k, months, why, h in closed_periodic[:40]:
        logger.info("  %s%s [%s]", (r["title"] or "")[:70],
                    f" · місяці {months}" if months else " · місяці невідомі", h)
    if unknown:
        logger.info("\n— невідомо (%d), приклади:", len(unknown))
        for r in unknown[:20]:
            logger.info("  [%s/%s] %s", r["status"], r["opportunity_type"], (r["title"] or "")[:70])

    if args.dry_run:
        logger.info("\nСУХИЙ ПРОГІН — у базу нічого не записано.")
        return 0

    written = 0
    for r, kind, months, why, _h in decided:
        try:
            db.table("opportunities").update({
                "timing_kind": kind,
                "season_months": months,
                "admin_comment": _trace(r, kind, why),
            }).eq("id", r["id"]).execute()
            written += 1
        except Exception as e:
            logger.error("не записалось %s: %s", r["id"], e)
    logger.info("\nЗаписано: %d із %d", written, len(decided))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
