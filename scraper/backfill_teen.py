"""backfill_teen.py — поля картки для режиму «Підліткам».

Навіщо. Редизайн головної (вересень 2026) дає підлітку власний режим:
картка показує «Отримаєш / Треба / Дедлайн» замість «Формат / Місто /
Джерело», а фільтр «Що дає» працює по тегах. Цих даних у базі не існує —
вони ховаються у тексті summary/details, звідки їх дістає модель.

Кому розмічаємо. Активні записи з age_to >= 13 без teen_benefit: усе, що
підліток може побачити у своєму режимі. Молодші гуртки не чіпаємо.

Запуск:
    python scraper/backfill_teen.py --dry-run       # показати, нічого не писати
    python scraper/backfill_teen.py --limit 40      # обережний перший прогін
    python scraper/backfill_teen.py                 # усе, що без розмітки
"""
from __future__ import annotations

import argparse
import logging
import os
import time

import anthropic

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill_teen")

MODEL = "claude-haiku-4-5-20251001"

# По 12 записів у виклик: два вільні текстові поля на запис — більша пачка
# починає плутати індекси (урок backfill_geo).
BATCH = 12
DETAILS_LIMIT = 900

VALID_TAGS = {"без досвіду", "гроші", "поїздка", "досвід", "сертифікат"}

TOOL = {
    "name": "set_teen_fields",
    "description": "Поля картки для підлітка по кожному запису зі списку",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "i": {"type": "integer", "description": "Номер запису зі списку"},
                        "benefit": {
                            "type": "string",
                            "description": "Що підліток ОТРИМАЄ, до 60 знаків, "
                                           "українською, без крапки в кінці. "
                                           "Приклади: «Рік навчання у США, все "
                                           "оплачено», «Грант до 50 000 ₴ і "
                                           "ментор», «Сертифікат і публікації».",
                        },
                        "requirement": {
                            "type": "string",
                            "description": "Що ТРЕБА для участі, до 60 знаків, "
                                           "українською, без крапки. Приклади: "
                                           "«Анкета і англійська B1», «Есе до "
                                           "500 слів», «Просто зареєструватися».",
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Що дає можливість, лише зі списку: "
                                           "«без досвіду» (візьмуть без портфоліо "
                                           "і досягнень), «гроші» (стипендія, "
                                           "грант, виплата, призовий фонд), "
                                           "«поїздка» (фізична поїздка, зокрема "
                                           "за кордон), «досвід» (стажування, "
                                           "робота, волонтерство, менторство), "
                                           "«сертифікат» (документ по завершенні).",
                        },
                    },
                    "required": ["i", "benefit", "requirement", "tags"],
                },
            },
        },
        "required": ["items"],
    },
}

SYSTEM = """Ти заповнюєш картку можливості для підлітка 13–18 років.

Для КОЖНОГО запису поверни benefit («Отримаєш»), requirement («Треба») і tags.

Правила:
- Пиши мовою підлітка, коротко і конкретно. Не переписуй назву — додай те,
  чого в назві немає.
- benefit — найсильніша конкретика з тексту: сума, тривалість, країна,
  документ. Немає конкретики — узагальни чесно («Заняття двічі на тиждень»).
- requirement — найпростіша чесна відповідь «що зробити, щоб узяли».
  Якщо достатньо реєстрації — так і пиши: «Просто зареєструватися».
- Не вигадуй. Немає в тексті — не пиши. Краще загальне, ніж хибне."""


def _payload(rows: list[dict]) -> str:
    lines = []
    for i, r in enumerate(rows):
        details = (r.get("details") or "")[:DETAILS_LIMIT]
        lines.append(
            f"[{i}] {r.get('title') or ''}\n"
            f"тип: {r.get('opportunity_type') or '—'} · "
            f"вартість: {r.get('cost_type') or '—'} · "
            f"вік: {r.get('age_from')}–{r.get('age_to')}\n"
            f"опис: {r.get('summary') or ''}\n"
            f"{details}".strip()
        )
    return "\n\n---\n\n".join(lines)


def _ask(client: anthropic.Anthropic, rows: list[dict]) -> dict[int, dict]:
    """Один виклик на пачку; системний промпт кешується між пачками."""
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=3000,
                system=[{"type": "text", "text": SYSTEM,
                         "cache_control": {"type": "ephemeral"}}],
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "set_teen_fields"},
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


def _clean_tags(tags) -> list[str]:
    out = []
    for t in tags or []:
        tag = str(t).strip().lower()
        if tag in VALID_TAGS and tag not in out:
            out.append(tag)
    return out


def _clip(s, limit=80) -> str | None:
    s = (s or "").strip().rstrip(".")
    return s[:limit] if s else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int,
                    default=int(os.environ.get("LIMIT") or 0) or None)
    ap.add_argument("--batch", type=int, default=BATCH)
    ap.add_argument("--dry-run", action="store_true",
                    default=os.environ.get("DRY_RUN", "").lower() == "true")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("Немає ANTHROPIC_API_KEY")
        return 1

    db = get_client()
    ai = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # PostgREST віддає до 1000 рядків — сторінкуємо, як усюди.
    rows, start = [], 0
    while True:
        page = (db.table("opportunities")
                .select("id, title, summary, details, opportunity_type, "
                        "cost_type, age_from, age_to")
                .eq("status", "active")
                .is_("canonical_slug", "null")
                .is_("teen_benefit", "null")
                .gte("age_to", 13)
                .order("id")
                .range(start, start + 999)
                .execute().data or [])
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Записів без розмітки: %d", len(rows))

    written = 0
    for chunk_start in range(0, len(rows), args.batch):
        chunk = rows[chunk_start:chunk_start + args.batch]
        answers = _ask(ai, chunk)

        for i, row in enumerate(chunk):
            ans = answers.get(i)
            if not ans:
                logger.warning("Модель пропустила %s", row["title"][:60])
                continue
            benefit = _clip(ans.get("benefit"))
            requirement = _clip(ans.get("requirement"))
            tags = _clean_tags(ans.get("tags"))
            if not benefit and not requirement:
                continue
            logger.info("%s → [%s] / [%s] %s",
                        row["title"][:48], benefit, requirement, tags)
            if args.dry_run:
                continue
            db.table("opportunities").update({
                "teen_benefit": benefit,
                "teen_requirement": requirement,
                "teen_tags": tags,
            }).eq("id", row["id"]).execute()
            written += 1

    logger.info("Готово: записано %d із %d", written, len(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
