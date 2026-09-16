"""remark.py — перерозмітка вже збережених записів за їхнім джерелом.

Навіщо. Екстрактор питав модель про 12 полів, а в джерелі їх удвічі більше,
і найгірше — два різні факти («до коли подати» і «коли відбувається») клались
в одну колонку `deadline`: старий промпт прямо наказував брати перший день
діапазону проведення як дедлайн. Наслідки на 16.09.2026, серед 1117 активних:

  •  6 записів — тип-подія з deadline без дати кінця: у канал пішло
     «📅 Коли: <дедлайн подачі>». Усі шість уже опубліковані, усі закордонні.
  • 26 записів — обидві дати: показували діапазон «дедлайн — кінець події».
     Найдовший, UWC: «Коли: 7 жовтня 2026 — 31 серпня 2027».
  • 43 з 1117 (3.8%) взагалі знали бодай щось про дати проведення.
  • details порожній у 1098 із 1117 (98.3%) — екстрактор ніколи його не
    заповнював, бо такого поля не було в схемі виклику.
  • apply_url не існувало як колонка: пряме посилання на форму подачі
    втрачалось, а source_url у 64 записів веде на пост у Telegram.

Показовий випадок — «Malmö 2026, сесія ЄМП Швеції». У пості джерела прямо
написано: дати проведення 6–8 листопада, дедлайн реєстрації 17 вересня, вік
14–20, внесок €100 з проживанням і харчуванням, робоча мова англійська, тема
«Present tense», посилання на Google-форму. У базі з цього лишилось три поля.

Звідки беремо текст. Спершу з `raw_items` — там лежить сирець, з якого запис
і був зроблений (2522 рядки; на вибірці з 300 активних записів текст знайшовся
для 67.7%). Тільки якщо сирцю немає, йдемо на сторінку джерела. Це економить
дві третини походів по чужих сайтах.

Чому не через звичайну переекстракцію (raw_items → upsert). Upsert шукає
наявний запис за content_hash АБО slug АБО canonical_url+назва. Назва, яку
модель витягне зараз, не зобов'язана збігтися зі збереженою, тож переекстракція
створила б ДРУГИЙ запис замість виправлення першого (той самий висновок, що в
audit_seed.py). Тому тут — оновлення на місці за id.

Що пише і чого не чіпає:
  • дати (deadline, event_start_date, event_end_date) — перезаписуються
    набором, коли модель знайшла в тексті бодай одну. Стара розмітка дат
    ненадійна за побудовою, тому довіряємо свіжому читанню, а не мерджимо.
    Не знайшла жодної — не чіпаємо нічого;
  • details, apply_url, price_note — тільки якщо поле ПОРОЖНЄ. Те, що вже
    написано, могла писати людина;
  • записи з verified_at (99 штук) — модератор їх дивився й міг правити
    руками, тому дати там не чіпаємо взагалі, лише дозаповнюємо порожнє;
  • title, slug, status, вік, тип, вартість — не чіпаємо тут узагалі. Це
    справа audit_seed.py, і змішувати дві операції в одній — спосіб не
    зрозуміти, що саме зламалось.

Запуск:
    python scraper/remark.py --dry-run --limit 10   # подивитись, нічого не писати
    python scraper/remark.py --apply --limit 50     # обережний перший прогін
    python scraper/remark.py --apply                # усе, що підпадає
    python scraper/remark.py --apply --only-dates   # лише дати, без details
"""
from __future__ import annotations

import argparse
import html
import logging
import os
import re
import time
from collections import Counter
from datetime import date

import anthropic
import httpx

from db import get_client
# Той самий похід по сторінці, що в тижневій перевірці дат: httpx + зачистка
# розмітки + класифікація 404/таймаут. Другої копії тут бути не повинно.
from recheck_dates import fetch_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("remark")

MODEL = "claude-haiku-4-5-20251001"
LIMIT = int(os.environ.get("LIMIT", "200"))
# Пауза між походами на чужі сайти. Для записів, чий текст знайшовся в
# raw_items, паузи немає — ми нікуди не ходимо.
DELAY = 0.6
PAGE_CHARS = 9000

TOOL = {
    "name": "remark",
    "description": "Точні дати й деталі можливості за текстом джерела",
    "input_schema": {
        "type": "object",
        "properties": {
            "deadline": {
                "type": ["string", "null"],
                "description": "YYYY-MM-DD — останній день ПОДАЧІ ЗАЯВКИ. "
                               "Лише якщо в тексті прямо сказано про строк "
                               "подачі/реєстрації. Якщо названі тільки дати "
                               "самої події — тут null, а дати йдуть у "
                               "event_start_date / event_end_date.",
            },
            "event_start_date": {
                "type": ["string", "null"],
                "description": "YYYY-MM-DD — ПЕРШИЙ день проведення. Діапазон "
                               "«6–8 листопада» → 6 листопада. Одна дата "
                               "проведення → вона ж. Немає дат проведення → null.",
            },
            "event_end_date": {
                "type": ["string", "null"],
                "description": "YYYY-MM-DD — ОСТАННІЙ день проведення. Діапазон "
                               "«6–8 листопада» → 8 листопада. Одна дата "
                               "проведення → вона ж. Немає дат проведення → null.",
            },
            "apply_url": {
                "type": ["string", "null"],
                "description": "Повний URL, за яким подають заявку (Google-"
                               "форма, сторінка реєстрації). Лише якщо він "
                               "названий у тексті. Адреса самого допису, "
                               "каналу чи головної сторінки — не підходить.",
            },
            "price_note": {
                "type": ["string", "null"],
                "description": "Вартість словами, як у тексті: «€100, включає "
                               "проживання та харчування; дорога окремо». До "
                               "200 знаків. Про гроші не сказано → null.",
            },
            "details": {
                "type": ["string", "null"],
                "description": "Розгорнутий опис усього корисного з тексту: "
                               "програма й формат участі, умови та вимоги, що "
                               "входить у вартість, робоча мова, тема, як "
                               "подати, що учасник отримає. Лише те, що ПРЯМО "
                               "є в тексті. Розмітка: «## Підзаголовок», "
                               "«- пункт», «**жирний**», «[текст](посилання)», "
                               "порожній рядок — абзац. Без HTML і таблиць. "
                               "До 4000 знаків. Нема чого сказати → null.",
            },
            "page_kind": {
                "type": "string",
                "enum": ["one_opportunity", "listing_or_org", "not_found"],
                "description": "one_opportunity — текст описує ОДНУ конкретну "
                               "можливість. listing_or_org — перелік програм "
                               "або головна сторінка організації: єдиних дат "
                               "тут бути не може. not_found — сторінки немає.",
            },
            "confidence": {"type": "number", "description": "0.0–1.0"},
        },
        "required": ["page_kind", "confidence"],
        "additionalProperties": False,
    },
}

SYSTEM = """Сьогодні {today}. Ти уточнюєш картку можливості для українських
дітей за текстом її джерела.

ГОЛОВНЕ ПРАВИЛО: НІЧОГО НЕ ВИГАДУЙ. Заповнюй поле лише тим, що ПРЯМО сказано
в тексті. Невідоме лишай порожнім. Вигадана дата гірша за відсутню: родина
витрачає сили на програму, куди її вже не візьмуть.

ДАТИ — найважливіше. Це ДВІ РІЗНІ речі, і плутати їх не можна:
  • «до коли подати заявку» → deadline;
  • «коли це відбувається» → event_start_date і event_end_date.
У тексті вони часто стоять поруч: «Дати проведення: 6–8 листопада. Дедлайн
реєстрації: 17 вересня». Тоді event_start_date=6 листопада,
event_end_date=8 листопада, deadline=17 вересня.
Якщо названі ЛИШЕ дати проведення — deadline лишається null. Не підставляй
туди перший день події: це різні факти.
Рік не вказано → найближчий майбутній.

Якщо текст описує НЕ одну конкретну можливість, а перелік програм чи просто
організацію — постав page_kind=listing_or_org і не вигадуй дат: єдиних дат у
такого тексту не буває."""


def _payload(row: dict, page: str) -> str:
    return (
        f"Запис у нашій базі: «{row.get('title') or ''}» "
        f"(тип: {row.get('opportunity_type') or '—'}, "
        f"вік {row.get('age_from')}–{row.get('age_to')}).\n"
        f"Адреса джерела: {row.get('source_url') or '—'}\n"
        f"Зараз у базі: дедлайн={row.get('deadline') or '—'}, "
        f"початок події={row.get('event_start_date') or '—'}, "
        f"кінець події={row.get('event_end_date') or '—'}\n\n"
        f"ТЕКСТ ДЖЕРЕЛА:\n{page[:PAGE_CHARS]}"
    )


def ask(llm, row: dict, page: str) -> dict | None:
    """Один виклик на запис. Системний промпт кешується між викликами."""
    for attempt in range(3):
        try:
            resp = llm.messages.create(
                model=MODEL,
                max_tokens=4000,
                system=[{"type": "text",
                         "text": SYSTEM.format(today=date.today().isoformat()),
                         "cache_control": {"type": "ephemeral"}}],
                tools=[TOOL],
                tool_choice={"type": "tool", "name": "remark"},
                messages=[{"role": "user", "content": _payload(row, page)}],
            )
            break
        except anthropic.APIStatusError as e:
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                logger.error("API %s на «%s»", e.status_code, row.get("title"))
                return None
            time.sleep(2 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                return None
            time.sleep(2 * (attempt + 1))
    else:
        return None

    block = next((b for b in resp.content if b.type == "tool_use"), None)
    return block.input if block else None


def _valid_date(value) -> str | None:
    """YYYY-MM-DD або нічого. Словесні дати («листопад») відкидаємо."""
    from datetime import datetime
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


_TG_POST = re.compile(r"^https://t\.me/(?:s/)?([A-Za-z0-9_]+)/(\d+)")
_TG_TEXT = re.compile(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)


def telegram_text(url: str) -> str | None:
    """Повний текст допису в публічному Telegram-каналі — разом із посиланнями.

    Сирець у raw_items для Telegram-джерел лежить уже без href: посилання на
    Google-форму в пості про сесію ЄМП у Мальме там не збереглось, і саме тому
    apply_url неможливо було відновити з бази. Embed-віджет t.me віддає допис
    цілком, а посилання ми розгортаємо в «текст (адреса)», щоб модель їх
    бачила. Telegram, на відміну від частини сайтів, не блокує сервери GitHub.
    """
    m = _TG_POST.match(url)
    if not m:
        return None
    try:
        r = httpx.get(f"https://t.me/{m.group(1)}/{m.group(2)}?embed=1&mode=tme",
                      timeout=20, follow_redirects=True)
    except Exception:
        return None
    found = _TG_TEXT.search(r.text) if r.status_code == 200 else None
    if not found:
        return None
    body = found.group(1)
    body = re.sub(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                  lambda a: f"{a.group(2)} ({html.unescape(a.group(1))})", body, flags=re.S)
    body = re.sub(r"<br\s*/?>", "\n", body)
    text = html.unescape(re.sub(r"<[^>]+>", "", body)).strip()
    return text if len(text) >= 200 else None


def source_text(sb, row: dict) -> tuple[str | None, str]:
    """Текст джерела. Повертає (текст, звідки).

    Порядок: допис у Telegram (свіжий і з посиланнями) → збережений сирець із
    raw_items (не треба ходити на чужий сайт) → жива сторінка.
    """
    url = (row.get("source_url") or "").strip()
    if _TG_POST.match(url):
        text = telegram_text(url)
        if text:
            return text, "telegram"
    if url:
        try:
            got = (sb.table("raw_items")
                   .select("raw_text")
                   .eq("source_url", url)
                   .order("fetched_at", desc=True)
                   .limit(1).execute().data or [])
            if got and len((got[0].get("raw_text") or "")) >= 200:
                return got[0]["raw_text"], "raw_items"
        except Exception as e:
            logger.warning("raw_items недоступні (%s) — йду на сторінку", e)

    if not url.startswith("http"):
        return None, "немає адреси"
    time.sleep(DELAY)
    text, _why, kind = fetch_text(url)
    return (text, "сторінка") if kind == "ok" else (None, f"сторінка: {_why}")


def plan_patch(row: dict, out: dict, only_dates: bool) -> tuple[dict, list[str]]:
    """Що саме змінюємо в записі. Повертає (патч, перелік змін словами)."""
    patch, notes = {}, []
    verified = bool(row.get("verified_at"))

    start = _valid_date(out.get("event_start_date"))
    end = _valid_date(out.get("event_end_date"))
    deadline = _valid_date(out.get("deadline"))
    # Перевернутий діапазон означає, що модель переплутала поля місцями.
    if start and end and start > end:
        start, end = end, start

    # Дати перезаписуємо набором — але лише якщо модель знайшла бодай одну і
    # текст описує саме цю можливість. Запис, який дивився модератор, не
    # чіпаємо: там могли бути ручні правки.
    if not verified and (start or end or deadline):
        for key, val in (("deadline", deadline),
                         ("event_start_date", start),
                         ("event_end_date", end)):
            if (row.get(key) or None) != val:
                patch[key] = val
                notes.append(f"{key}: {row.get(key) or '—'} → {val or '—'}")

    # Решта — тільки дозаповнення порожнього, щоб не затерти ручну роботу.
    if not only_dates:
        if not row.get("details") and (out.get("details") or "").strip():
            patch["details"] = out["details"].strip()[:20000]
            notes.append(f"details: +{len(patch['details'])} знаків")
        apply_url = (out.get("apply_url") or "").strip()
        if (not row.get("apply_url") and apply_url.startswith("http")
                and apply_url != (row.get("source_url") or "")):
            patch["apply_url"] = apply_url[:500]
            notes.append(f"apply_url: {apply_url[:60]}")
        if not row.get("price_note") and (out.get("price_note") or "").strip():
            patch["price_note"] = out["price_note"].strip()[:200]
            notes.append("price_note заповнено")

    return patch, notes


SELECT = ("id, title, source, source_url, opportunity_type, is_international, "
          "age_from, age_to, deadline, event_start_date, event_end_date, "
          "details, apply_url, price_note, verified_at")


def pick_rows(sb, scope: str, offset: int, limit: int) -> list[dict]:
    """Які записи дивимось і в якому порядку.

    Перший сухий прогін 16.09.2026 брав найдавніші за updated_at — і влучив
    у квітневий стартовий набір: головні сторінки Пласту, Save the Children,
    інклюзивно-ресурсних центрів. Єдиних дат там не буває, а 35 із 50 сайтів
    відповіли серверам GitHub 403. Змінено один запис із п'ятдесяти.

    Тепер спершу міжнародні (там дати й посилання на подачу важать найбільше),
    а гуртки в scope=priority не беремо зовсім: вони постійні, без дат, і не в
    пріоритеті наповнення. Порядок стабільний — за полями, яких цей скрипт не
    змінює, — тож прогони можна гортати через --offset.
    """
    rows, start = [], 0
    while True:
        # PostgREST віддає щонайбільше 1000 рядків — активних записів більше.
        page = (sb.table("opportunities").select(SELECT)
                .eq("status", "active").is_("canonical_slug", "null")
                .order("id").range(start, start + 999).execute().data or [])
        rows += page
        if len(page) < 1000:
            break
        start += 1000
    if scope == "priority":
        rows = [r for r in rows if r.get("opportunity_type") != "club"]
    rows.sort(key=lambda r: (not r.get("is_international"), r["id"]))
    return rows[offset:offset + limit]


def run(apply: bool, limit: int, only_dates: bool,
        scope: str = "priority", offset: int = 0) -> dict:
    sb = get_client()
    llm = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    rows = pick_rows(sb, scope, offset, limit)

    print(f"{'=' * 70}\nПерерозмітка: {len(rows)} записів "
          f"(scope={scope}, offset={offset})"
          f"{' — СУХИЙ ПРОГІН' if not apply else ''}\n{'=' * 70}")

    stats = {"seen": 0, "from_raw": 0, "from_page": 0, "from_tg": 0, "no_text": 0,
             "changed": 0, "dates_fixed": 0, "details_added": 0,
             "apply_added": 0, "skipped_listing": 0, "unchanged": 0}
    why_no_text = Counter()

    for row in rows:
        stats["seen"] += 1
        page, whence = source_text(sb, row)
        if not page:
            stats["no_text"] += 1
            why_no_text[whence] += 1
            logger.info("· без тексту (%s): %s", whence, (row.get("title") or "")[:60])
            continue
        stats[{"raw_items": "from_raw", "telegram": "from_tg"}.get(whence, "from_page")] += 1

        out = ask(llm, row, page)
        if not out:
            continue
        if out.get("page_kind") != "one_opportunity" or out.get("confidence", 0) < 0.5:
            stats["skipped_listing"] += 1
            continue

        patch, notes = plan_patch(row, out, only_dates)
        if not patch:
            stats["unchanged"] += 1
            continue

        if any(k in patch for k in ("deadline", "event_start_date", "event_end_date")):
            stats["dates_fixed"] += 1
        if "details" in patch:
            stats["details_added"] += 1
        if "apply_url" in patch:
            stats["apply_added"] += 1
        stats["changed"] += 1

        print(f"\n▸ {(row.get('title') or '')[:70]}  [{whence}]")
        for n in notes:
            print(f"    {n}")

        if apply:
            try:
                sb.table("opportunities").update(patch).eq("id", row["id"]).execute()
            except Exception as e:
                logger.error("не записалось (%s): %s", row["id"], e)
                stats["changed"] -= 1

    print(f"\n{'=' * 70}")
    print(f"переглянуто {stats['seen']}: "
          f"{stats['from_tg']} з Telegram, {stats['from_raw']} із сирцю, "
          f"{stats['from_page']} зі сторінки, {stats['no_text']} без тексту")
    for why, n in why_no_text.most_common():
        print(f"    без тексту — {why}: {n}")
    print(f"змінено {stats['changed']}: дати {stats['dates_fixed']}, "
          f"details {stats['details_added']}, apply_url {stats['apply_added']}")
    print(f"без змін {stats['unchanged']}, "
          f"перелік/організація {stats['skipped_listing']}")
    if not apply:
        print("\nСУХИЙ ПРОГІН — у базу нічого не записано.")
    return stats


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true", help="писати в базу")
    p.add_argument("--dry-run", action="store_true", help="лише показати")
    p.add_argument("--limit", type=int, default=LIMIT)
    p.add_argument("--only-dates", action="store_true",
                   help="чіпати лише дати, не заповнювати details")
    p.add_argument("--scope", choices=["priority", "all"], default="priority",
                   help="priority — без гуртків, міжнародні першими")
    p.add_argument("--offset", type=int, default=0)
    a = p.parse_args()
    run(apply=a.apply and not a.dry_run, limit=a.limit, only_dates=a.only_dates,
        scope=a.scope, offset=a.offset)
