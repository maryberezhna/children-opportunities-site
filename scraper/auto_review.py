"""Три коридори модерації.

Проблема, яку розв'язуємо: черга чернеток росла з 31 травня і дійшла до 75.
Ручний апрув кожного запису не масштабується — але й публікувати все підряд
не можна, бо частина категорій коштує довіри.

Тому не «правила замість людини», а розподіл за трьома коридорами:

  🟢 ЗЕЛЕНИЙ  — публікується само. Механічні правила І суддя сказали «так».
  🟡 ЖОВТИЙ   — лишається в черзі. Усе, де помилка дорога або де суддя
                не впевнений.
  🔴 ЧЕРВОНИЙ — прибирається без людини: дублі, мертві лінки, протерміноване.

Ключове: механіка й суддя мають ПОГОДИТИСЬ на зеленому. Будь-яке «не знаю»
з будь-якого боку опускає запис у жовтий, а не піднімає в зелений.

Запуск:
    python auto_review.py            # дамп: показує, що куди впало
    python auto_review.py --apply    # реально пише в базу
"""
import argparse
import json
import logging
import os
from datetime import date

import anthropic

from db import get_client

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"

# ── Жовтий коридор: де помилка коштує довіри ────────────────────────────────
# Тут ручна перевірка лишається завжди, навіть якщо все інше бездоганне.
# Логіка проста: якщо неправильний запис у цій категорії може нашкодити
# родині або зганьбити проєкт — його дивиться людина.
SENSITIVE_TYPES = {
    "medical_aid",     # медична допомога
    "psychology",      # психологічна підтримка
    "rehabilitation",  # реабілітація
    "humanitarian",    # гуманітарна допомога
    "allowance",       # державні виплати — тут ціна помилки в грошах родини
}

# Статусні групи дітей: помилка тут б'є по найвразливіших.
SENSITIVE_NEEDS = {
    "idp", "disability", "orphan", "veteran_family", "oncology", "low_income",
}

MIN_SUMMARY_LEN = 60
MIN_TITLE_LEN = 15

GREEN = "green"
YELLOW = "yellow"
RED = "red"


def mechanical(row: dict) -> tuple[str, str] | None:
    """Детермінована частина. Повертає (коридор, причина) або None, якщо
    запис пройшов механіку і йде далі, до судді."""
    today = date.today().isoformat()

    # ── Червоний ────────────────────────────────────────────────────────
    if row.get("dup_of") or row.get("canonical_slug"):
        return RED, "дубль — на злиття, не в публікацію"
    if (row.get("link_status") or "ok") != "ok":
        return RED, f"лінк не живий ({row.get('link_status')})"
    for key in ("deadline", "event_end_date"):
        v = row.get(key)
        if v and v < today:
            return RED, f"{key} у минулому ({v})"

    # ── Жовтий: дорогі категорії ────────────────────────────────────────
    if row.get("opportunity_type") in SENSITIVE_TYPES:
        return YELLOW, f"чутлива категорія: {row['opportunity_type']}"
    needs = set(row.get("child_needs") or [])
    hit = needs & SENSITIVE_NEEDS
    if hit:
        return YELLOW, f"статусні діти: {', '.join(sorted(hit))}"

    # ── Жовтий: неповні або сумнівні дані ───────────────────────────────
    comment = (row.get("admin_comment") or "").lower()
    if "невідомий тип" in comment:
        return YELLOW, "LLM не визначив тип можливості"
    if row.get("age_from") is None or row.get("age_to") is None:
        return YELLOW, "не визначено вік"
    if row["age_from"] < 0 or row["age_to"] > 18:
        return YELLOW, f"вік поза 0–18 ({row['age_from']}–{row['age_to']})"
    if not row.get("cost_type"):
        return YELLOW, "не визначено вартість"
    summary = row.get("summary") or ""
    if len(summary) < MIN_SUMMARY_LEN:
        return YELLOW, f"опис коротший за {MIN_SUMMARY_LEN} символів"
    if len(row.get("title") or "") < MIN_TITLE_LEN:
        return YELLOW, "назва підозріло коротка"

    return None  # механіка пропускає — слово за суддею


JUDGE_TOOL = {
    "name": "verdict",
    "description": "Рішення щодо публікації можливості",
    "input_schema": {
        "type": "object",
        "properties": {
            "publish": {
                "type": "boolean",
                "description": "true — можна публікувати без людини; "
                               "false — має подивитись модератор",
            },
            "reason": {
                "type": "string",
                "description": "Одне речення українською: чому саме так",
            },
            "confidence": {"type": "number", "description": "0.0–1.0"},
        },
        "required": ["publish", "reason", "confidence"],
    },
}

JUDGE_PROMPT = """Ти — редактор каталогу можливостей для українських дітей 0–18 років.
Вирішуєш, чи можна опублікувати запис БЕЗ перевірки людиною.

Кажи publish=true, тільки якщо виконано ВСЕ:
- це КОНКРЕТНА можливість для дитини 0–18 (курс, гурток, конкурс, табір,
  стипендія, обмін), а не опис організації і не агрегатор чужих можливостей;
- назва й опис узгоджені між собою і з типом та віком;
- опис пояснює, ЩО дитина отримає, а не лише рекламує організатора;
- джерело схоже на справжнього організатора, а не на перепост невідомо чого;
- немає ознак, що набір уже закритий або подія минула.

Кажи publish=false, якщо:
- це реклама платного сервісу під виглядом можливості;
- опис загальний і з нього не зрозуміло, що робити дитині;
- текст суперечить сам собі (вік у назві не той, що в полі);
- йдеться про здоров'я, психіку, гроші родини або дітей з особливим статусом;
- ти вагаєшся з будь-якої іншої причини.

СУМНІВ = publish=false. Пропустити сумнівний запис дорожче, ніж потримати
хороший зайвий день у черзі."""


def judge(client, row: dict) -> dict:
    """Слово судді. Будь-який збій — трактуємо як «не впевнений»."""
    payload = {
        "Назва": row.get("title"),
        "Опис": row.get("summary"),
        "Тип": row.get("opportunity_type"),
        "Вік": f"{row.get('age_from')}–{row.get('age_to')}",
        "Вартість": row.get("cost_type"),
        "Джерело": row.get("source"),
        "URL": row.get("source_url"),
        "Дедлайн": row.get("deadline"),
    }
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=JUDGE_PROMPT,
            tools=[JUDGE_TOOL],
            tool_choice={"type": "tool", "name": "verdict"},
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        if not block:
            return {"publish": False, "reason": "суддя не повернув рішення", "confidence": 0.0}
        return block.input
    except Exception as e:
        logger.error("суддя впав на %s: %s", row.get("slug"), e)
        return {"publish": False, "reason": f"збій судді: {e}", "confidence": 0.0}


# Нижче цього порогу впевненості зелений коридор закритий, навіть якщо
# суддя сказав «так». Поріг високий свідомо: див. останній абзац промпту.
MIN_CONFIDENCE = 0.8


def classify(row: dict, client) -> tuple[str, str]:
    verdict = mechanical(row)
    if verdict:
        return verdict

    j = judge(row=row, client=client) if client else {
        "publish": False, "reason": "суддя не запускався (немає ключа)", "confidence": 0.0,
    }
    if j.get("publish") and j.get("confidence", 0) >= MIN_CONFIDENCE:
        return GREEN, f"суддя: {j.get('reason', '')}"
    return YELLOW, f"суддя не пропустив: {j.get('reason', '')}"


def apply_decision(sb, row: dict, corridor: str, reason: str) -> None:
    """Зелений публікуємо, червоний закриваємо, жовтий не чіпаємо взагалі."""
    if corridor == GREEN:
        patch = {
            "status": "active",
            # verified_at НЕ ставимо: це позначка ручної перевірки людиною,
            # і брехати нею не можна. Слід лишаємо в admin_comment.
            "admin_comment": f"auto-approved v1 · {reason}"[:500],
        }
    elif corridor == RED:
        patch = {"status": "closed", "admin_comment": f"auto-rejected v1 · {reason}"[:500]}
    else:
        return
    sb.table("opportunities").update(patch).eq("id", row["id"]).execute()


def run(apply: bool = False, limit: int = 500) -> dict:
    sb = get_client()
    key = os.getenv("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=key) if key else None
    if not client:
        print("⚠️  ANTHROPIC_API_KEY немає — суддя не запуститься, "
              "усе, що пройшло механіку, впаде в жовтий\n")

    rows = (sb.table("opportunities").select("*")
            .eq("status", "draft").limit(limit).execute().data or [])
    print(f"Чернеток у черзі: {len(rows)}\n")

    buckets = {GREEN: [], YELLOW: [], RED: []}
    for row in rows:
        corridor, reason = classify(row, client)
        buckets[corridor].append((row, reason))
        if apply:
            apply_decision(sb, row, corridor, reason)

    for name, emoji in ((GREEN, "🟢"), (YELLOW, "🟡"), (RED, "🔴")):
        items = buckets[name]
        print(f"{emoji} {name.upper()}: {len(items)}")
        for row, reason in items[:40]:
            print(f"   · {(row.get('title') or '')[:58]:<58} — {reason}")
        if len(items) > 40:
            print(f"   …і ще {len(items) - 40}")
        print()

    if not apply:
        print("Це дамп. Нічого не записано. Щоб застосувати: --apply")
    return {k: len(v) for k, v in buckets.items()}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser(description="Три коридори модерації")
    p.add_argument("--apply", action="store_true", help="реально писати в базу")
    p.add_argument("--limit", type=int, default=500)
    run(apply=p.parse_args().apply, limit=p.parse_args().limit)
