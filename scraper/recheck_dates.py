"""recheck_dates.py — дата з ЖИВОЇ сторінки, а не зі збереженого тексту.

Навіщо ще один скрипт, коли є backfill_deadlines.py. Той читає лише те, що
вже лежить у базі: title, summary, details. Прогін 11.09.2026 показав межу
такого підходу — з 120 записів він визначив 28, а 92 повернув як
«незрозумілі». І це закономірно: дата зазвичай стоїть на сторінці, а не в
нашому стислому описі. Ми питали LLM про те, чого їй не показували.

Цей скрипт відкриває сторінку джерела й читає її. Питання до моделі інше:
не «здогадайся за назвою», а «що написано ось тут».

Чому саме ці записи. Активних без жодної дати — 127, і всі до одного
належать до типів, які за природою мають дату: конкурси, табори, гранти,
фестивалі, обміни, волонтерські програми, олімпіади, стипендії. Серед них
можуть висіти закриті набори — родина витрачає сили на подачу, якої вже
немає. Саме такий запис Марія знайшла 11.09.2026 першим на сторінці
«Дітям захисників».

ПРАВИЛО, ВАЖЛИВІШЕ ЗА ВСІ ІНШІ: нічого не вигадувати. Модель зобовʼязана
повернути ЦИТАТУ зі сторінки для кожного висновку. Немає цитати — немає
запису в базу: такий запис іде в чергу з поміткою, а не на здогад.

Запуск:
    python recheck_dates.py            # дамп, нічого не пише
    python recheck_dates.py --apply    # пише в базу

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     BATCH (скільки за прогін, деф. 150).
"""
import argparse
import logging
import os
import re
import time
from datetime import date, timedelta

import anthropic
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("recheck_dates")

MODEL = "claude-haiku-4-5-20251001"
UA = "Mozilla/5.0 (compatible; DityamDateCheck/1.0; +https://dityam.com.ua)"
BATCH = int(os.environ.get("BATCH", "150"))
# Пауза між сторінками: ми ходимо по чужих сайтах, і швидкість тут нічого
# не вартує — прогін усе одно раз на тиждень.
DELAY = 0.6

TOOL = {
    "name": "read_dates",
    "description": "Що сторінка каже про строки і про те, чи набір ще відкритий",
    "input_schema": {
        "type": "object",
        "properties": {
            "deadline": {
                "type": ["string", "null"],
                "description": "YYYY-MM-DD — дата, до якої подають заявки, "
                               "АБО дата початку події. Лише якщо вона названа "
                               "на сторінці. Діапазон — перша дата.",
            },
            "event_end_date": {
                "type": ["string", "null"],
                "description": "YYYY-MM-DD — дата завершення події чи програми, "
                               "якщо названа окремо.",
            },
            "recurrence": {
                "type": ["string", "null"],
                "enum": ["annual", "ongoing", None],
                "description": "annual — сторінка прямо каже, що це щорічна "
                               "програма (є згадки інших років, «щороку», "
                               "«XII конкурс»). ongoing — прямо каже, що набір "
                               "триває постійно, без сезону. Порожньо, якщо "
                               "сторінка про це не говорить.",
            },
            "page_kind": {
                "type": "string",
                "enum": ["one_opportunity", "listing_or_org", "not_found"],
                "description": "one_opportunity — сторінка описує ОДНУ конкретну "
                               "можливість зі своїми строками. listing_or_org — "
                               "це головна сторінка організації або перелік "
                               "багатьох програм: єдиної дати тут бути не може. "
                               "not_found — сторінки немає, редирект на каталог, "
                               "помилка.",
            },
            "enrollment": {
                "type": "string",
                "enum": ["open", "closed", "unknown"],
                "description": "closed — сторінка прямо каже, що набір "
                               "завершено, реєстрацію закрито, подія минула. "
                               "open — прямо каже, що триває. unknown — не "
                               "говорить ні того, ні того.",
            },
            "evidence": {
                "type": "string",
                "description": "ДОСЛІВНА цитата зі сторінки мовою оригіналу, на "
                               "якій ґрунтується висновок. Не переказ, не "
                               "узагальнення — саме фрагмент тексту. Якщо "
                               "цитати немає, поверни порожній рядок і не "
                               "заповнюй інші поля.",
            },
            "confidence": {"type": "number", "description": "0.0–1.0"},
        },
        "required": ["page_kind", "enrollment", "evidence", "confidence"],
        "additionalProperties": False,
    },
}

SYSTEM = """Сьогодні {today}. Тобі дають текст сторінки, з якої ми колись узяли
можливість для дитини. Наше завдання — зрозуміти, чи вона ще жива і коли
закінчується.

ГОЛОВНЕ ПРАВИЛО, ВАЖЛИВІШЕ ЗА ВСІ ІНШІ: НІЧОГО НЕ ВИГАДУЙ.
Пиши лише те, що ПРЯМО написано на сторінці. Для кожного висновку наводь
дослівну цитату в полі evidence. Немає цитати — став порожній evidence,
enrollment="unknown" і не заповнюй дати. Порожня відповідь коштує нам одного
дня в черзі; вигадана дата коштує родині поданої заявки, якої вже не чекають.

Чого НЕ робити:
- не бери рік «за замовчуванням», якщо на сторінці стоїть лише день і місяць
  без року і зі змісту рік не випливає;
- не став recurrence="annual" тільки тому, що конкурс звучить як щорічний;
  потрібна згадка інших років або слово «щороку» на самій сторінці;
- не став enrollment="closed" через те, що дата минула — для цього є окреме
  поле deadline. closed — це коли сторінка СЛОВАМИ каже, що все скінчилось.

Спершу визнач page_kind. Дуже часто адреса веде не на можливість, а на
головну сторінку організації або на перелік програм — там єдиної дати бути
не може в принципі. Це не привід щось вигадати, це окремий діагноз:
page_kind="listing_or_org". Якщо сторінки немає або редирект вивів кудись
інде — page_kind="not_found". У цих двох випадках дати не заповнюй."""


def fetch_text(url: str) -> tuple[str | None, str]:
    """Текст сторінки або (None, причина). Причина йде в лог і в коментар."""
    try:
        with httpx.Client(timeout=20, follow_redirects=True,
                          headers={"User-Agent": UA,
                                   "Accept-Language": "uk,en;q=0.8"}) as c:
            r = c.get(url)
    except Exception as e:
        return None, f"не відповів: {type(e).__name__}"
    if r.status_code >= 400:
        return None, f"HTTP {r.status_code}"
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "svg"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    if len(text) < 200:
        return None, f"порожня сторінка ({len(text)} символів)"
    return text[:12000], f"HTTP {r.status_code}"


def ask(llm, row: dict, page: str) -> dict:
    try:
        resp = llm.messages.create(
            model=MODEL,
            max_tokens=600,
            system=SYSTEM.format(today=date.today().isoformat()),
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "read_dates"},
            messages=[{"role": "user", "content":
                       f"Можливість у нашій базі: «{row['title']}» "
                       f"(тип: {row['opportunity_type']}).\n"
                       f"Адреса: {row['source_url']}\n\n"
                       f"Текст сторінки:\n{page}"}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        return block.input if block else {}
    except Exception as e:
        logger.error("LLM впав на «%s»: %s", row.get("title"), e)
        return {}


def _valid_date(v) -> str | None:
    """Дата в розумних межах. Рік за 400 днів у минулому чи за 5 років у
    майбутньому — це не дата програми, а помилка розпізнавання."""
    if not isinstance(v, str):
        return None
    try:
        d = date.fromisoformat(v.strip())
    except ValueError:
        return None
    today = date.today()
    if d < today - timedelta(days=400) or d > today + timedelta(days=1825):
        return None
    return d.isoformat()


MIN_CONFIDENCE = 0.6
MIN_EVIDENCE = 15

# Слова, якими сторінка СЛОВАМИ каже, що все скінчилось. Без жодного з них
# «enrollment=closed» не приймається: у першому прогоні 11.09.2026 модель
# позначила закритою стипендіальну програму, яка щойно почалась, і цитатою
# навела розклад занять. Тепер підстава мусить бути в самій цитаті.
CLOSED_MARKERS = (
    "заверш", "закрит", "закінч", "припинен", "відбул", "минул",
    "closed", "finished", "ended", "expired", "no longer",
)

MONTHS_UK = {
    1: ("січн",), 2: ("лют",), 3: ("берез",), 4: ("квітн",), 5: ("трав",),
    6: ("червн",), 7: ("липн",), 8: ("серпн",), 9: ("вересн", "вересень"),
    10: ("жовтн",), 11: ("листопад",), 12: ("грудн",),
}
MONTHS_EN = {
    1: ("jan",), 2: ("feb",), 3: ("mar",), 4: ("apr",), 5: ("may",),
    6: ("jun",), 7: ("jul",), 8: ("aug",), 9: ("sep",), 10: ("oct",),
    11: ("nov",), 12: ("dec",),
}


def _date_supported_by(iso: str, evidence: str) -> bool:
    """Чи стоїть ця дата в самій цитаті.

    Найтонше місце всієї роботи. У першому прогоні модель повернула для FLEX
    дату 2027-06-30 із цитатою «Аплікаційну форму на програму FLEX 2026-2027
    відкрито!» — числа 30 червня там немає й близько. Так само зʼявились
    19 вересня з «у вересні 2026-го» і 1 жовтня з цитати без жодної цифри.

    Тому правило просте й механічне: і день, і місяць мусять бути в цитаті —
    день як окреме число, місяць як число або як назва. Не збіглось — дати
    для нас немає, запис іде людині.
    """
    if not iso or not evidence:
        return False
    y, m, d = (int(x) for x in iso.split("-"))
    low = evidence.lower()
    if not re.search(rf"(?<!\d){d:02d}(?!\d)|(?<!\d){d}(?!\d)", low):
        return False
    if re.search(rf"(?<!\d){m:02d}(?!\d)", low):
        return True
    return any(name in low for name in MONTHS_UK[m] + MONTHS_EN[m])

# Сезонні типи закриваємо чесно, але через ~11 місяців дивимось ще раз:
# ttl_requeue перечитає сторінку, і нова річна програма оживить запис. Та
# сама домовленість, що в scripts/check-deadlines.mjs — не розходитись.
SEASONAL_RECHECK_TYPES = {
    "festival", "camp", "summer_school", "sport_tournament", "excursion",
    "olympiad", "competition", "exchange", "scholarship", "grant",
}


def _seasonal(row: dict) -> dict:
    if row.get("opportunity_type") not in SEASONAL_RECHECK_TYPES:
        return {}
    d = date.today() + timedelta(days=334)   # ~11 місяців
    return {"recheck_at": d.isoformat()}


def decide(row: dict, out: dict, today: str) -> tuple[dict, str]:
    """Що робимо із записом. Повертає (патч, пояснення). Порожній патч —
    нічого не міняємо."""
    evidence = (out.get("evidence") or "").strip()
    conf = out.get("confidence", 0)
    kind = out.get("page_kind")

    # Адреса веде на головну організації або на перелік програм. Єдиної дати
    # там немає й бути не може — і це діагноз не про дату, а про сам запис:
    # у базу потрапила організація замість можливості. Вигадувати тут
    # особливо нічого: віддаємо людині як є.
    if kind == "listing_or_org":
        return {}, "сторінка не про одну можливість — це головна або перелік"
    if kind == "not_found":
        return {}, "сторінки за адресою немає"

    # Без цитати висновку немає. Це не формальність: саме цитата відрізняє
    # прочитане від вигаданого.
    if len(evidence) < MIN_EVIDENCE or conf < MIN_CONFIDENCE:
        return {}, "сторінка про строки не говорить"

    # Дата приймається, лише якщо вона стоїть у самій цитаті.
    deadline = _valid_date(out.get("deadline"))
    if deadline and not _date_supported_by(deadline, evidence):
        deadline = None
    end = _valid_date(out.get("event_end_date"))
    if end and not _date_supported_by(end, evidence):
        end = None
    recurrence = out.get("recurrence") if out.get("recurrence") in ("annual", "ongoing") else None

    # Набір закрито словами самої сторінки — знімаємо з сайту.
    low = evidence.lower()
    if out.get("enrollment") == "closed":
        if not any(mark in low for mark in CLOSED_MARKERS):
            # Модель каже «закрито», а цитата цього не каже. Віримо цитаті.
            return {}, "модель каже «закрито», але цитата цього не підтверджує"
        return ({"status": "closed", **_seasonal(row)},
                f"набір закрито: «{evidence[:120]}»")

    # Дата в минулому — те саме, але підстава інша: не слова, а число.
    if deadline and deadline < today and not recurrence:
        return ({"status": "closed", "deadline": deadline, **_seasonal(row)},
                f"дедлайн минув ({deadline}): «{evidence[:120]}»")

    patch = {}
    # Дедлайн у минулому в щорічної програми — це торішній дедлайн. Писати
    # його не можна: саме прострочена дата на картці й обурила Марію
    # 11.09.2026. Пишемо періодичність — «щорічна, дата наступного набору
    # невідома» чесніше за минулорічне число.
    if deadline and not (deadline < today and recurrence == "annual"):
        patch["deadline"] = deadline
    if end and end >= today:
        patch["event_end_date"] = end
    if recurrence and not patch.get("deadline"):
        patch["recurrence"] = recurrence
    if not patch:
        return {}, "сторінка про строки не говорить"

    label = (patch.get("deadline") or patch.get("event_end_date")
             or {"annual": "щорічна", "ongoing": "постійна"}[patch["recurrence"]])
    return patch, f"{label}: «{evidence[:120]}»"


def _with_trace(row: dict, note: str) -> str:
    prev = (row.get("admin_comment") or "").strip()
    return (f"{prev} · {note}" if prev else note)[:500]


def run(apply: bool = False, limit: int = BATCH) -> dict:
    from db import get_client
    sb = get_client()
    llm = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    today = date.today().isoformat()

    rows = (sb.table("opportunities")
            .select("id, title, source, source_url, opportunity_type, admin_comment")
            .eq("status", "active")
            .is_("deadline", "null")
            .is_("event_end_date", "null")
            .is_("recurrence", "null")
            .order("updated_at")          # найдавніші першими: там найбільше ризику
            .limit(limit).execute().data or [])

    print(f"Активних записів без жодної дати: {len(rows)}\n")
    stats = {"closed": 0, "dated": 0, "recurring": 0, "unreachable": 0,
             "unclear": 0, "not_an_opportunity": 0}
    closed_list, dated_list, left_list, hub_list = [], [], [], []

    for row in rows:
        url = row.get("source_url")
        if not url:
            stats["unreachable"] += 1
            left_list.append((row, "немає посилання"))
            continue

        page, status = fetch_text(url)
        time.sleep(DELAY)
        if not page:
            stats["unreachable"] += 1
            left_list.append((row, f"сторінка недоступна ({status})"))
            continue

        patch, why = decide(row, ask(llm, row, page), today)
        if not patch:
            if why.startswith("сторінка не про одну можливість") or \
                    why.startswith("сторінки за адресою немає"):
                stats["not_an_opportunity"] += 1
                hub_list.append((row, why))
            else:
                stats["unclear"] += 1
                left_list.append((row, why))
            continue

        if patch.get("status") == "closed":
            stats["closed"] += 1
            closed_list.append((row, why))
        elif patch.get("recurrence"):
            stats["recurring"] += 1
            dated_list.append((row, why))
        else:
            stats["dated"] += 1
            dated_list.append((row, why))

        if apply:
            patch["admin_comment"] = _with_trace(row, f"recheck-dates · {why}")
            sb.table("opportunities").update(patch).eq("id", row["id"]).execute()

    def dump(title, items):
        print(f"{title}: {len(items)}")
        for row, why in items[:60]:
            print(f"   · {(row.get('title') or '')[:52]:<52} — {why}")
        if len(items) > 60:
            print(f"   …і ще {len(items) - 60}")
        print()

    dump("🔴 ЗНЯТИ З САЙТУ (набір закрито або дедлайн минув)", closed_list)
    dump("⏰ ДАТУ ЗНАЙДЕНО", dated_list)
    dump("🟡 ЛИШАЄТЬСЯ БЕЗ ДАТИ", left_list)
    dump("🔵 НЕ МОЖЛИВІСТЬ, А ОРГАНІЗАЦІЯ ЧИ ПЕРЕЛІК (нічого не міняємо)", hub_list)

    print(f"Разом: закрито {stats['closed']}, дат поставлено {stats['dated']}, "
          f"періодичність {stats['recurring']}, недоступних {stats['unreachable']}, "
          f"без відповіді {stats['unclear']}, "
          f"не можливість {stats['not_an_opportunity']}")
    if not apply:
        print("\nЦе дамп. Нічого не записано. Щоб застосувати: --apply")
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Дата з живої сторінки джерела")
    p.add_argument("--apply", action="store_true", help="реально писати в базу")
    p.add_argument("--limit", type=int, default=BATCH)
    args = p.parse_args()
    run(apply=args.apply, limit=args.limit)
