"""ukrainize.py — записи, що лежать англійською, перекласти українською.

Навіщо. 22.09.2026 у Telegram-канал вийшла «Нова можливість» про WWOOF з
назвою «Volunteer in organic farms» і англійським описом (Марія: «ніколи не
пиши в телеграм канал англійською — тільки переклад або чисто укр»). Запис
прийшов з Eurodesk англійською, а промпт нормалізатора не казав, якою мовою
писати. Промпт виправлено; цей скрипт — для того, що вже лежить у базі: на
22.09 таких 118 (110 активних, 8 чернеток), з них 16 активних — Eurodesk.

Що перекладаємо: назву, короткий опис і повний опис — лише те, що не
українською. Власна назва програми лишається в оригіналі з українським
поясненням через тире: «WWOOF — волонтерство на органічних фермах». Англійську
версію сайту не чіпаємо: translate_en.py сам перекладе змінений запис з
нового українського тексту.

Записи, які схвалила людина (verified_at), за замовчуванням НЕ чіпаємо, а
показуємо списком: там назву могли лишити англійською свідомо, а поле, яке
правила людина, машина не переписує (рішення Марії 21.09.2026).

Критерій «не українською» — дзеркало post-labels.isUkrainianPost
(scripts/post-labels.mjs): у назві немає жодного українського слова або опис
здебільшого не кирилицею. Змінювати обидва разом.

    python ukrainize.py                                   # сухий прогін → ukrainize-proposals.json
    python ukrainize.py --apply --from-file ukrainize-proposals.json   # записати рівно це
    python ukrainize.py --include-verified                # і схвалені людиною

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
"""
from __future__ import annotations

import argparse
import html
import json
import logging
import os
import re
from datetime import date

import api_guard
from recheck_dates import _with_trace

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("ukrainize")

# Sonnet, а не Haiku: сухий прогін 22.09.2026 на Haiku дав «молодіжна обмін»,
# «трансграничний», «проект» і, гірше, змістові помилки — «fewer
# opportunities» (DiscoverEU Inclusion) став «з обмеженими можливостями», тобто
# інвалідністю. Разовий переклад ~110 записів коштує близько долара.
MODEL = "claude-sonnet-5"
DETAILS_LIMIT = 6000
SUMMARY_MAX = 400

_UK_WORD = re.compile(r"[Ѐ-ӿ]{3,}")


def cyrillic_share(text: str | None) -> float:
    letters = [c for c in (text or "") if c.isalpha()]
    if not letters:
        return 1.0
    return sum(1 for c in letters if "Ѐ" <= c <= "ӿ") / len(letters)


def is_ukrainian(text: str | None) -> bool:
    return cyrillic_share(text) >= 0.5


def needs_ukrainian(row: dict) -> bool:
    """Дзеркало !isUkrainianPost: назва без українського слова або опис не українською."""
    return not _UK_WORD.search(row.get("title") or "") or not is_ukrainian(row.get("summary"))


TOOL = {
    "name": "translate",
    "description": "Запис платформи можливостей для дітей — українською.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Назва українською."},
            "summary": {"type": "string", "description": "Короткий опис українською, до 400 знаків."},
            "details": {"type": "string",
                        "description": "Повний опис українською. Порожній рядок, якщо оригіналу немає."},
        },
        "required": ["title", "summary"],
        "additionalProperties": False,
    },
}

SYSTEM = """Ти перекладаєш записи платформи можливостей для українських дітей
українською мовою. Читатимуть батьки в Україні й за кордоном.

Правила:
1. Нічого не додавай і нічого не викидай. Жодних фактів, яких немає в
   оригіналі: ні дат, ні цін, ні віку, ні обіцянок.
2. Назва — українською. Власну назву програми чи організації (WWOOF,
   Erasmus+, Yale Young Global Scholars, FIRST LEGO League) лишай в оригіналі
   й додавай через тире коротке українське пояснення, ЩО це, узяте з опису:
   «WWOOF — волонтерство на органічних фермах». Якщо назва — звичайні слова
   («Volunteer in organic farms»), просто перекладай.
3. Якщо назва вже має українське пояснення чи вже українською — поверни як є.
4. Опис — природною українською, без канцеляриту, до 400 знаків. Якщо опис
   уже українською — поверни як є.
5. Повний опис — перекладай зі збереженням абзаців і переліків. Якщо його
   немає або він уже українською — поверни порожній рядок.
6. Міста, країни й університети — українською (Madrid → Мадрид, Cork →
   Корк, Yale University → Єльський університет). Гроші — у валюті оригіналу
   («€345» → «345 €»).
7. Пояснення в назві каже батькам, ЩО це: конкурс, олімпіада, табір,
   стипендія, обмін, волонтерство, курс, клуб. Не дослівний переклад назви
   («Young Champions of the Earth — молоді борці за Землю» — погано; «— премія
   ООН для молодих екологічних інноваторів» — добре, якщо це є в описі).

Мова — жива літературна українська:
- правопис 2019 року: «проєкт», «проєктний»;
- без русизмів і кальок: «транскордонний» (не «трансграничний»), «сталий
  розвиток» (не «стійкий» для sustainability), «брати участь» (не «приймати
  участь»), «довгострокове волонтерство» (не «на довгострок»);
- рід і відмінки узгоджені: «молодіжний обмін», «глобальний хакатон»;
- «безкоштовно», як на всьому сайті, а не «безплатно»;
- після тире й двокрапки — мала літера, якщо далі не власна назва;
- обережно з термінами, що змінюють зміст: «young people with fewer
  opportunities» — «молодь із меншими можливостями» (соціальні чи
  економічні перешкоди), а НЕ «з обмеженими можливостями» — це про
  інвалідність."""


def plan(row: dict, out: dict, today: date) -> dict:
    """Що змінити. Чиста функція — під тести.

    Беремо лише те, що модель справді повернула українською, і лише замість
    того, що було не українською: українське поле перекладом не затираємо."""
    patch: dict = {}
    # Модель інколи повертає HTML-сутності: «Scholastic Art &amp; Writing
    # Awards» (сухий прогін 22.09.2026). У базі має бути звичайний «&».
    out = {k: html.unescape(v) if isinstance(v, str) else v for k, v in out.items()}
    title = (out.get("title") or "").strip()
    if title and _UK_WORD.search(title) and not _UK_WORD.search(row.get("title") or ""):
        patch["title"] = title
    summary = (out.get("summary") or "").strip()
    if summary and is_ukrainian(summary) and not is_ukrainian(row.get("summary")):
        patch["summary"] = summary[:SUMMARY_MAX]
    details = (out.get("details") or "").strip()
    if row.get("details") and details and is_ukrainian(details) and not is_ukrainian(row["details"]):
        patch["details"] = details
    if patch:
        patch["admin_comment"] = _with_trace(
            row, f"ukrainize {today.isoformat()}: переклад українською (було «{(row.get('title') or '')[:60]}»)")
    return patch


def translate(llm, row: dict) -> dict | None:
    body = f"Назва: {row.get('title') or ''}\n\n"
    if row.get("summary"):
        body += f"Короткий опис: {row['summary']}\n\n"
    if row.get("details") and not is_ukrainian(row["details"]):
        body += f"Повний опис:\n{row['details'][:DETAILS_LIMIT]}"
    try:
        # Примусовий виклик інструмента несумісний із «роздумами»: на Sonnet 5
        # вони за замовчуванням увімкнені, тож вимикаємо явно.
        resp = llm.messages.create(
            model=MODEL, max_tokens=4000, system=SYSTEM, tools=[TOOL],
            tool_choice={"type": "tool", "name": "translate"},
            messages=[{"role": "user", "content": body}],
            extra_body={"thinking": {"type": "disabled"}},
        )
    except Exception as e:
        logger.error("LLM не відповів для «%s»: %s", (row.get("title") or "")[:60], e)
        return None
    tu = next((b for b in resp.content if b.type == "tool_use"), None)
    return tu.input if tu else None


def load_rows(db) -> list[dict]:
    rows = []
    for start in range(0, 5000, 1000):
        chunk = (db.table("opportunities")
                 .select("id, slug, status, title, summary, details, verified_at, admin_comment")
                 .in_("status", ["active", "draft"]).is_("canonical_slug", "null")
                 .order("id").range(start, start + 999).execute().data or [])
        rows += chunk
        if len(chunk) < 1000:
            break
    return rows


def still_same(row: dict, proposal: dict) -> bool:
    """Запис не змінився з сухого прогону — інакше переклад застарів."""
    return (row.get("title") or "") == proposal["old_title"] \
        and (row.get("summary") or "") == proposal["old_summary"]


def apply_file(db, path: str, skip: list[str], today: date) -> int:
    """Записати рівно те, що показав сухий прогін, — без нового виклику моделі.

    Sonnet 5 не дає зафіксувати температуру: повторний виклик повернув би
    ІНШИЙ переклад, ніж той, який людина прочитала в сухому прогоні."""
    proposals = json.load(open(path, encoding="utf-8"))
    by_id = {r["id"]: r for r in load_rows(db)}
    written = stale = skipped = 0
    for p in proposals:
        if any(s in p["old_title"].lower() for s in skip):
            skipped += 1
            logger.info("  ⏭ пропущено: %s", p["old_title"][:70])
            continue
        row = by_id.get(p["id"])
        if not row or not still_same(row, p):
            stale += 1
            logger.info("  ≠ змінився після сухого прогону, не чіпаю: %s", p["old_title"][:70])
            continue
        patch = {k: v for k, v in p["patch"].items() if k != "admin_comment"}
        patch["admin_comment"] = _with_trace(
            row, f"ukrainize {today.isoformat()}: переклад українською (було «{p['old_title'][:60]}»)")
        db.table("opportunities").update(patch).eq("id", p["id"]).execute()
        written += 1
        logger.info("  ✓ %s → %s", p["old_title"][:50], patch.get("title", "(назва та сама)")[:70])
    logger.info("\nЗаписано: %d, пропущено: %d, змінились після сухого прогону: %d",
                written, skipped, stale)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="лише разом із --from-file")
    ap.add_argument("--from-file", help="пропозиції сухого прогону (--out), які записати")
    ap.add_argument("--out", default="ukrainize-proposals.json",
                    help="куди сухий прогін кладе пропозиції")
    ap.add_argument("--include-verified", action="store_true")
    # Записи, переклад яких сухий прогін показав хибним, — пропустити:
    # частини оригінальних назв через «|».
    ap.add_argument("--skip", default=os.environ.get("UKRAINIZE_SKIP", ""))
    args = ap.parse_args()
    skip = [s.strip().lower() for s in args.skip.split("|") if s.strip()]
    today = date.today()

    from db import get_client
    db = get_client()
    if args.apply:
        if not args.from_file:
            logger.error("--apply пише лише перевірені пропозиції: потрібен --from-file")
            return 2
        return apply_file(db, args.from_file, skip, today)

    rows = load_rows(db)
    found = [r for r in rows if needs_ukrainian(r)]
    verified = [r for r in found if r.get("verified_at")]
    todo = found if args.include_verified else [r for r in found if not r.get("verified_at")]
    logger.info("Не українською: %d, з них схвалених людиною %d%s. СУХИЙ ПРОГІН\n",
                len(found), len(verified), "" if args.include_verified else " (їх не чіпаю)")

    llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
    proposals, failed = [], 0
    for row in todo:
        out = translate(llm, row)
        if not out:
            failed += 1
            continue
        patch = plan(row, out, today)
        if not patch:
            logger.info("  = %s — без змін", (row.get("title") or "")[:70])
            continue
        proposals.append({"id": row["id"], "slug": row["slug"], "status": row["status"],
                          "old_title": row.get("title") or "", "old_summary": row.get("summary") or "",
                          "patch": patch})
        logger.info("  • [%s] %s\n      → %s", row["status"], (row.get("title") or "")[:70],
                    patch.get("title", "(назва та сама)"))
        if "summary" in patch:
            logger.info("      опис: %s", patch["summary"][:160])

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(proposals, f, ensure_ascii=False, indent=1)
    if verified and not args.include_verified:
        logger.info("\nСхвалені людиною, не змінено (--include-verified, щоб перекласти):")
        for r in verified:
            logger.info("  • %s — https://dityam.com.ua/o/%s", (r.get("title") or "")[:70], r["slug"])
    logger.info("\nПропозицій: %d, не вдалось: %d. Збережено в %s — прочитати й записати "
                "через --apply --from-file.", len(proposals), failed, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
