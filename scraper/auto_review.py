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


import api_guard  # відмова через ліміт/оплату робить запуск червоним
from db import get_client
# Перелік обовʼязкових полів один на весь конвеєр: нормалізатор ставить
# чернетку, коридори не пускають далі, адмінка показує те саме формулювання.
from normalizer import missing_required, summary_says_over
from proof import missing_proof, PROOF_LABELS
from timing import is_expired

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


def mechanical(row: dict, trust_tier: int = 2) -> tuple[str, str] | None:
    """Детермінована частина. Повертає (коридор, причина) або None, якщо
    запис пройшов механіку і йде далі, до судді.

    trust_tier — надійність джерела з реєстру `sources`: 1 держ/офіційні,
    2 звичайні організації, 3 соцмережі й агреговані стрічки. Джерела, якого
    в реєстрі немає, вважаємо третім рівнем: так поводиться discover-агент,
    що приносить сайт, якого ми ще ніколи не бачили.
    """
    today = date.today().isoformat()

    # ── Червоний ────────────────────────────────────────────────────────
    if row.get("dup_of") or row.get("canonical_slug"):
        return RED, "дубль — на злиття, не в публікацію"
    if (row.get("link_status") or "ok") != "ok":
        return RED, f"лінк не живий ({row.get('link_status')})"
    # Та сама ознака «минуло», що в плановій перевірці (scraper/timing.py):
    # зокрема запис лише з датою початку, який раніше сюди не потрапляв.
    if is_expired(row, date.fromisoformat(today)):
        last = row.get("deadline") or row.get("event_end_date") or row.get("event_start_date")
        return RED, f"дата в минулому ({last})"

    # ── Жовтий: джерело, якому не можна вірити наосліп ──────────────────
    # Ворота автодопуску мали спиратись на жорсткі сигнали, і надійність
    # джерела — один із них. До 20.09.2026 поле trust_tier у реєстрі стояло,
    # але жоден рядок коду його не читав: агрегатор із соцмережі проходив тими
    # самими воротами, що й сайт міністерства.
    if trust_tier >= 3:
        return YELLOW, "джерело третього рівня довіри (соцмережі, агрегатори, новий сайт)"

    # ── Жовтий: дорогі категорії ────────────────────────────────────────
    if row.get("opportunity_type") in SENSITIVE_TYPES:
        return YELLOW, f"чутлива категорія: {row['opportunity_type']}"
    needs = set(row.get("child_needs") or [])
    hit = needs & SENSITIVE_NEEDS
    if hit:
        return YELLOW, f"статусні діти: {', '.join(sorted(hit))}"

    # ── Жовтий: без обовʼязкового мінімуму ──────────────────────────────
    # Дата, тип, вік, вартість і місце-або-формат (вимога Марії 11.09.2026).
    # Без будь-чого з цього запис не публікується сам ніколи, хай би який
    # гарний був опис: батько не зможе вирішити, чи це для його дитини, а
    # платформа не зможе вчасно прибрати запис із сайту.
    missing = missing_required(row)
    if missing:
        return YELLOW, "бракує: " + ", ".join(missing)
    # ── Жовтий: поле є, а цитати на нього немає ──────────────────────────
    # Світлофор (22.09.2026): зелений лише з дослівною цитатою зі сторінки на
    # кожне обовʼязкове поле. Здогад чи дефолт цитати не має.
    no_proof = missing_proof(row)
    if no_proof:
        return YELLOW, "без цитати: " + ", ".join(PROOF_LABELS[k] for k in no_proof)
    if row["age_from"] < 0 or row["age_to"] > 18:
        return YELLOW, f"вік поза 0–18 ({row['age_from']}–{row['age_to']})"
    summary = row.get("summary") or ""
    if summary_says_over(summary):
        return YELLOW, "в описі сказано, що набір чи сезон уже завершено"
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

# Можливості за кордоном — частина платформи (рішення Марії про дітей за
# кордоном і країни-сусіди). До 14.09.2026 суддя відхиляв словацький табір
# для українських дітей як «не в Україні», і такі записи марно йшли людині.
JUDGE_PROMPT = """Ти — редактор платформи Dityam.com.ua, яка збирає можливості для
українських дітей 0–18 років — і в Україні, і за кордоном.
Вирішуєш, чи можна опублікувати запис БЕЗ перевірки людиною.

ЗА КОРДОНОМ — ЦЕ НОРМАЛЬНО. Табір у Словаччині, стипендія в Польщі, мовний
курс у Чехії чи гурток у Німеччині підходять, якщо українська дитина, яка там
живе або може приїхати, реально може взяти участь. Не відхиляй запис лише
через те, що він не в Україні, організатор іноземний або опис не українською.
Відхиляй, тільки якщо з опису видно, що участь закрита для дітей з України
(наприклад, лише для громадян країни) — або цього не видно й ти вагаєшся.

Кажи publish=true, тільки якщо виконано ВСЕ:
- це КОНКРЕТНА можливість для дитини 0–18 (курс, гурток, конкурс, табір,
  стипендія, обмін), а не опис організації і не агрегатор чужих можливостей;
- назва й опис узгоджені між собою і з типом та віком;
- опис пояснює, ЩО дитина отримає, а не лише рекламує організатора;
- джерело схоже на справжнього організатора, а не на перепост невідомо чого;
- немає ознак, що набір уже закритий або подія минула. Дата «Сьогодні» є в
  даних; «Заявки до» — останній день подачі, «Початок/Кінець події» — коли
  вона відбувається. Це різні дати.

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
        # До 17.09.2026 суддя бачив лише дедлайн — без дат події, виду й
        # сьогоднішньої дати, хоча мав перевіряти, «чи подія не минула».
        "Сьогодні": date.today().isoformat(),
        "Заявки до": row.get("deadline"),
        "Початок події": row.get("event_start_date"),
        "Кінець події": row.get("event_end_date"),
        "Вид за часом": row.get("timing_kind"),
        "Цитати зі сторінки": row.get("evidence") or {},
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


def classify(row: dict, client, trust: dict | None = None) -> tuple[str, str]:
    # Джерела немає в реєстрі — це не «нормальне», а «невідоме»: третій рівень.
    tier = (trust or {}).get(row.get("source"), 3)
    verdict = mechanical(row, tier)
    if verdict:
        return verdict

    j = judge(row=row, client=client) if client else {
        "publish": False, "reason": "суддя не запускався (немає ключа)", "confidence": 0.0,
    }
    if j.get("publish") and j.get("confidence", 0) >= MIN_CONFIDENCE:
        return GREEN, f"суддя: {j.get('reason', '')}"
    return YELLOW, f"суддя не пропустив: {j.get('reason', '')}"


def _with_trace(row: dict, note: str) -> str:
    """Дописує рішення до наявного коментаря, а не затирає його.

    У коментарі вже може лежати слід пошукового агента («🔎 Агент: гончарство»)
    — єдине місце, де видно, звідки взявся кандидат. Затерши його, модератор
    втрачає контекст саме тоді, коли він потрібен: на розборі спірного запису.
    """
    prev = (row.get("admin_comment") or "").strip()
    return (f"{prev} · {note}" if prev else note)[:500]


def apply_decision(sb, row: dict, corridor: str, reason: str) -> None:
    """Зелений публікуємо, червоний закриваємо, жовтий не чіпаємо взагалі."""
    if corridor == GREEN:
        patch = {
            "status": "active",
            # verified_at НЕ ставимо: це позначка ручної перевірки людиною,
            # і брехати нею не можна. Слід лишаємо в admin_comment.
            "admin_comment": _with_trace(row, f"auto-approved v1 · {reason}"),
        }
    elif corridor == RED:
        patch = {"status": "closed",
                 "admin_comment": _with_trace(row, f"auto-rejected v1 · {reason}")}
    else:
        return
    sb.table("opportunities").update(patch).eq("id", row["id"]).execute()


def run(apply: bool = False, limit: int = 500) -> dict:
    sb = get_client()
    key = os.getenv("ANTHROPIC_API_KEY")
    client = api_guard.client(api_key=key) if key else None
    if not client:
        print("⚠️  ANTHROPIC_API_KEY немає — суддя не запуститься, "
              "усе, що пройшло механіку, впаде в жовтий\n")

    rows = (sb.table("opportunities").select("*")
            .eq("status", "draft").limit(limit).execute().data or [])
    print(f"Чернеток у черзі: {len(rows)}\n")

    trust = {r["name"]: r.get("trust_tier") or 3
             for r in (sb.table("sources").select("name, trust_tier").execute().data or [])}

    buckets = {GREEN: [], YELLOW: [], RED: []}
    for row in rows:
        corridor, reason = classify(row, client, trust)
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
