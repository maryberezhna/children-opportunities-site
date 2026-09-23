"""triage_quarantine.py — пакетний розбір карантину за правилами Марії.

Навіщо (23.09.2026). Карантин (raw_items зі status='review') — це те, де
класифікатор вагався: впевненість 0,25–0,55. Розбирати його можна було лише
руками, по одному, у вкладці «Знахідки», і черга росла швидше, ніж
розбиралась: 13 записів 21.09 → 97 записів 23.09. Черга, яку не встигають
розібрати, нічим не краща за мовчазне відхилення: дедлайн згорає в ній так
само, тільки повільніше.

Що робить скрипт. Бере ту саму купу, дає моделі СИРИЙ текст (не розмітку) і
правила Марії, і повертає один із трьох вердиктів:

  accept — це можливість для дитини 0–18. Запис іде назад у чергу розбору
           (status='pending', attempts=0, review_verdict='accept'), і нічний
           прогін нормалізує його без порога впевненості (див. main.py,
           human_accepted) — рівно так, як після кнопки «Завести можливість».
  reject — це не наше. status='rejected', review_verdict='reject'.
  human  — НЕ чіпаємо нічого: запис лишається в карантині людині.

Чому саме так, а не «модель вирішує все». Помилковий accept недорогий: запис
пройде ті самі ворота, що й решта, і в найгіршому разі ляже чернеткою в
модерацію. Помилковий reject — тиха втрата справжньої можливості, якої вже
ніхто не побачить. Тому пороги асиметричні (MIN_ACCEPT < MIN_REJECT), а
будь-який сумнів, збій моделі чи цитата, якої немає в тексті, опускають
запис у 'human', а не піднімають у вердикт.

Правила Марії (ті самі, що в промпті scraper/normalizer.py) — у RULES нижче.

    python triage_quarantine.py                 # сухий прогін: нічого не пише
    python triage_quarantine.py --apply         # записати вердикти
    python triage_quarantine.py --limit 30

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
from datetime import date, datetime, timezone

import api_guard  # відмова через ліміт/оплату робить запуск червоним
from db import get_client
# Цитата — доказ, а не переказ: той самий звіряч, що й у світлофорі.
from proof import MAX_QUOTE, quote_in_text
# Слово про дитину в тексті — той самий маркер, яким main.py не пускає в
# чергу людини те, де розбирати нічого.
from raw_store import CHILD_MARKER

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("triage")

# Sonnet, а не Haiku. У карантині лежить саме те, на чому Haiku вже завагався
# під час екстракції: питати ту саму модель те саме питання — отримати ту саму
# невпевненість. Разовий розбір сотні записів коштує копійки.
MODEL = os.environ.get("TRIAGE_MODEL") or "claude-sonnet-5"

TEXT_LIMIT = 5000

# Пороги. Асиметричні свідомо: тиха втрата справжньої можливості дорожча за
# зайвий запис на столі в людини.
MIN_ACCEPT = 0.75
MIN_REJECT = 0.85

# Куди пишемо причину й цитату. Колонка додається міграцією
# 20260923_raw_items_triage_note.sql; поки її немає, скрипт не падає, а пише
# вердикт без сліду (див. _write).
NOTE_FIELD = "triage_note"

ACCEPT, REJECT, HUMAN = "accept", "reject", "human"


# ── Запобіжники, незалежні від моделі ───────────────────────────────────────

_RANGE = re.compile(r"(\d{1,2})\s*(?:[–—−-]|до\s|to\s)\s*(\d{1,2})")
_PLUS = re.compile(r"(\d{1,2})\s*\+")
_FROM = re.compile(r"(?:від|з|from|starting\s+at|ages?\s+)\s*(\d{1,2})", re.IGNORECASE)
_AGE_WORD = re.compile(r"рок|річ|вік|year|age|клас|grade", re.IGNORECASE)


def _near_age_word(text: str, start: int, end: int) -> bool:
    """Чи поруч із числом стоїть слово про вік. Без цього «16–30» у тексті —
    це з однаковим успіхом і вік, і дати вересня, і години роботи."""
    return bool(_AGE_WORD.search(text[max(0, start - 30):end + 30]))


def touches_eighteen(text: str) -> bool:
    """Чи текст говорить про вік, який дотягується до 18 років.

    Пряма вимога Марії (21.09.2026, після того як вона власноруч помилково
    видалила ESC 18–30): «З 18 років», «16–30», «18–30» — НАШЕ, ніколи не
    відхиляти. Тож на такому тексті машині відхиляти заборонено взагалі:
    вердикт reject опускається до 'human'. Хибне спрацювання коштує рівно
    одного запису на столі в людини — саме тієї ціни, яку ми готові платити.
    """
    text = text or ""
    for m in _RANGE.finditer(text):
        lo, hi = int(m.group(1)), int(m.group(2))
        if lo <= 18 < hi and _near_age_word(text, m.start(), m.end()):
            return True
    for pattern in (_PLUS, _FROM):
        for m in pattern.finditer(text):
            if int(m.group(1)) == 18 and _near_age_word(text, m.start(), m.end()):
                return True
    return False


# ── Правила Марії ───────────────────────────────────────────────────────────

RULES = """Ти розбираєш карантин платформи Dityam.com.ua — можливості для
українських дітей 0–18 років, в Україні та за кордоном.

Сюди потрапляє те, де класифікатор завагався. Твоє завдання — сказати одне з
трьох: це можливість для дитини (accept), це не наше (reject) або тут
потрібна людина (human).

ГОЛОВНЕ ПРАВИЛО, ВАЖЛИВІШЕ ЗА ВСІ ІНШІ: НІЧОГО НЕ ВИГАДУЙ. Рішення береш
лише з того, що ПРЯМО написано в тексті. Не добудовуй програму з назви
організації, не додумуй вік, дати й умови «як зазвичай буває». Якщо з тексту
не видно — це не привід домислити, це привід сказати human.

АУДИТОРІЯ
- Наша аудиторія — 0–18 років ВКЛЮЧНО.
- «З 18 років», «16–30», «18–30», «18+» — ЦЕ НАШЕ. Ніколи не відхиляй через
  те, що програма для вісімнадцятирічних: European Solidarity Corps,
  DiscoverEU, волонтерські табори «від 18» — приймай.
- НЕ наше, коли учасник дорослий і користь для нього самого: навчання,
  робота, бізнес чи грант для батьків, учителів, вихователів, персоналу,
  освітян; програма, де потрібен статус студента університету, магістратура,
  PhD чи диплом; нижня межа віку вища за 18 (21–30, 25+).
- Можливість «для батьків» ЛИШАЄТЬСЯ, якщо вона ПРО ДИТИНУ: застосунок із
  порадами про розвиток дитини, психологічна група для батьків дітей з ООП,
  виплата чи оздоровлення на дитину. Бізнес-грант для самих батьків — ні.

КОНКРЕТНІСТЬ
- Запис має бути однією програмою зі своїми умовами.
- Загальна норма («Державна цільова підтримка для здобуття вищої освіти»),
  збірна сторінка організації з багатьма програмами, рубрика чи добірка
  («#освіта», «Можливості тижня»), анонс самої організації, агрегатор,
  дайджест — не підходять.

АКТУАЛЬНІСТЬ
- Подача або проведення мають бути в майбутньому відносно дати «Сьогодні».
- Дат немає взагалі — підходить лише постійний набір або щорічна програма,
  і лише якщо це прямо видно з тексту.
- У тексті написано, що набір закрито, сезон завершено або подія минула —
  це reject.

ЯК ОБИРАТИ ВЕРДИКТ
- accept — з тексту ВИДНО, що це конкретна можливість для дитини 0–18, і
  вона актуальна.
- reject — з тексту ВИДНО, що це не наше: дорослий учасник заради себе,
  рубрика чи добірка, агрегатор, опис організації, закрите чи минуле,
  сміття (подяка за квіз, вітання, реклама).
- human — усе інше: бракує тексту, суперечність, рідкісний випадок,
  «схоже на можливість, але не написано для кого», будь-який сумнів.

Краще лишити людині зайве, ніж мовчки відхилити справжню можливість.

ЦИТАТА обовʼязкова: дослівний шматок тексту, на якому стоїть твоє рішення.
Не переказуй своїми словами — копіюй. Немає в тексті чого зачепитись —
вердикт human.

ПРИЧИНА — одне речення українською, по суті: «грант для вчителів, дитина не
учасник», а не «не відповідає критеріям».

confidence — наскільки ти впевнений саме в цьому вердикті, 0.0–1.0."""

TOOL = {
    "name": "triage",
    "description": "Вердикт щодо сирої знахідки в карантині",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {"type": "string", "enum": [ACCEPT, REJECT, HUMAN]},
            "reason": {"type": "string",
                       "description": "Одне речення українською: чому саме так"},
            "quote": {"type": "string",
                      "description": "Дослівна цитата з тексту, на якій стоїть рішення"},
            "confidence": {"type": "number", "description": "0.0–1.0"},
        },
        "required": ["verdict", "reason", "quote", "confidence"],
        "additionalProperties": False,
    },
}


def decide(answer, text: str) -> tuple[str, str, str]:
    """Вердикт після запобіжників: (verdict, reason, quote). Чиста функція.

    Запобіжники вміють лише ОПУСКАТИ рішення до 'human' — жоден із них не
    може сам перетворити сумнів на accept чи reject.
    """
    if not isinstance(answer, dict):
        return HUMAN, "модель не повернула рішення", ""
    verdict = answer.get("verdict")
    reason = (answer.get("reason") or "").strip()
    quote = re.sub(r"\s+", " ", str(answer.get("quote") or "")).strip()[:MAX_QUOTE]
    try:
        conf = float(answer.get("confidence"))
    except (TypeError, ValueError):
        conf = 0.0

    if verdict not in (ACCEPT, REJECT):
        return HUMAN, reason or "модель не впевнена", quote

    # Цитати, якої немає в тексті, не існує: це вже не доказ, а переказ.
    if not quote_in_text(quote, text):
        return HUMAN, f"цитати немає в тексті джерела ({reason})", quote

    if verdict == ACCEPT:
        if conf < MIN_ACCEPT:
            return HUMAN, f"впевненість {conf:.2f} нижча за {MIN_ACCEPT} ({reason})", quote
        # Текст, у якому немає жодного слова про дитину, вік чи школу, машина
        # не заводить у каталог сама — хай би яка впевнена була модель.
        if not CHILD_MARKER.search(text or ""):
            return HUMAN, f"у тексті нічого про дітей чи вік ({reason})", quote
        return ACCEPT, reason, quote

    if conf < MIN_REJECT:
        return HUMAN, f"впевненість {conf:.2f} нижча за {MIN_REJECT} ({reason})", quote
    if touches_eighteen(text):
        return HUMAN, f"вік дотягується до 18 — відхиляти машині заборонено ({reason})", quote
    return REJECT, reason, quote


def verdict_patch(verdict: str, reason: str, quote: str, now=None) -> dict | None:
    """Патч до raw_items. Дзеркало lib/quarantine.js verdictPatch (кнопки в
    адмінці), плюс слід рішення. 'human' не чіпає нічого — повертає None."""
    at = (now or datetime.now(timezone.utc)).isoformat()
    note = f"авто-розбір {date.today().isoformat()}: {reason}"
    if quote:
        note += f" · цитата: «{quote}»"
    if verdict == ACCEPT:
        # Назад у чергу: нічний розбір створить можливість тією ж моделлю, але
        # без порога впевненості (main.py, human_accepted).
        return {"status": "pending", "attempts": 0, "review_verdict": ACCEPT,
                "reviewed_at": at, "last_error": None, NOTE_FIELD: note[:500]}
    if verdict == REJECT:
        # reject_reason і confidence не чіпаємо: це сліди класифікатора, за
        # якими міряють, де він вагається. Наш вердикт живе своїм полем.
        return {"status": "rejected", "review_verdict": REJECT,
                "reviewed_at": at, NOTE_FIELD: note[:500]}
    return None


# ── База ────────────────────────────────────────────────────────────────────

def fetch_quarantine(sb, limit: int) -> list[dict]:
    """Карантин, якого ще не торкалась людина. Найстаріші перші: у них
    дедлайн ближче до згорання."""
    return (sb.table("raw_items")
            .select("id, source_name, source_url, raw_title, raw_text, "
                    "confidence, fetched_at")
            .eq("status", "review").is_("review_verdict", "null")
            .order("fetched_at").limit(limit).execute().data or [])


def _missing_note_column(error) -> bool:
    """Чи це «колонки ще немає» (міграцію не застосували), а не справжній збій."""
    text = str(error).lower()
    return NOTE_FIELD in text and ("pgrst204" in text or "column" in text
                                  or "schema cache" in text)


_note_warned = False


def write_verdict(sb, raw_id: str, patch: dict) -> bool:
    """Записує вердикт. Умова status='review' — щоб паралельний розбір
    людиною не був затертий машиною."""
    global _note_warned
    try:
        sb.table("raw_items").update(patch).eq("id", raw_id).eq("status", "review").execute()
        return True
    except Exception as e:
        if NOTE_FIELD in patch and _missing_note_column(e):
            if not _note_warned:
                logger.warning("⚠️  Колонки %s ще немає (міграція "
                               "20260923_raw_items_triage_note.sql не застосована) — "
                               "пишу вердикти без сліду.", NOTE_FIELD)
                _note_warned = True
            slim = {k: v for k, v in patch.items() if k != NOTE_FIELD}
            try:
                sb.table("raw_items").update(slim).eq("id", raw_id).eq("status", "review").execute()
                return True
            except Exception as e2:
                logger.error("не записалось (%s): %s", raw_id, e2)
                return False
        logger.error("не записалось (%s): %s", raw_id, e)
        return False


def ask(client, item: dict) -> dict | None:
    """Питаємо модель. Будь-який збій — None, тобто 'human': мовчазне
    відхилення через збій API було б найгіршим із можливих."""
    payload = {
        "Сьогодні": date.today().isoformat(),
        "Джерело": item.get("source_name"),
        "URL": item.get("source_url"),
        "Заголовок": item.get("raw_title") or "(немає)",
        "ТЕКСТ": (item.get("raw_text") or "")[:TEXT_LIMIT],
    }
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=600,
            system=RULES,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "triage"},
            messages=[{"role": "user",
                       "content": json.dumps(payload, ensure_ascii=False)}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        return block.input if block else None
    except Exception as e:
        logger.error("модель впала на %s: %s", item.get("id"), e)
        return None


REPORT = "triage-report.json"


def run(apply: bool = False, limit: int = 100) -> dict:
    sb = get_client()
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        logger.error("🔴 Немає ANTHROPIC_API_KEY — розбирати нічим.")
        return {"queued": 0}
    client = api_guard.client(api_key=key)

    rows = fetch_quarantine(sb, limit)
    logger.info("Беру з карантину: %d (ліміт %d, найстаріші перші)\n", len(rows), limit)

    counts = {ACCEPT: 0, REJECT: 0, HUMAN: 0}
    written = 0
    report = []
    for item in rows:
        text = f"{item.get('raw_title') or ''}\n{item.get('raw_text') or ''}"
        verdict, reason, quote = decide(ask(client, item), text)
        counts[verdict] += 1
        report.append({
            "id": item["id"], "verdict": verdict, "reason": reason, "quote": quote,
            "title": (item.get("raw_title") or "")[:120],
            "url": item.get("source_url"), "source": item.get("source_name"),
            "classifier_confidence": item.get("confidence"),
        })
        icon = {ACCEPT: "✅", REJECT: "🗑", HUMAN: "🙋"}[verdict]
        logger.info("%s %-58s — %s", icon,
                    (item.get("raw_title") or item.get("source_url") or "")[:58], reason[:90])
        if apply:
            patch = verdict_patch(verdict, reason, quote)
            if patch and write_verdict(sb, item["id"], patch):
                written += 1

    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    total = len(rows) or 1
    logger.info("\n%s\nРозібрано: %d", "=" * 70, len(rows))
    for name, icon in ((ACCEPT, "✅ у чергу розбору"), (REJECT, "🗑 відхилено"),
                       (HUMAN, "🙋 лишилось людині")):
        logger.info("  %s: %d (%d%%)", icon, counts[name], counts[name] * 100 // total)
    logger.info("Звіт: %s", REPORT)
    if apply:
        logger.info("Записано в базу: %d", written)
    else:
        logger.info("Це сухий прогін. У базі нічого не змінено. "
                    "Щоб застосувати: --apply")
    return {"queued": len(rows), "written": written, **counts}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Пакетний розбір карантину raw_items")
    p.add_argument("--apply", action="store_true", help="реально писати в базу")
    p.add_argument("--limit", type=int, default=100)
    args = p.parse_args()
    run(apply=args.apply, limit=args.limit)
