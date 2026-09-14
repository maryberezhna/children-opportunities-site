"""recheck_cost.py — «безкоштовно» чи «платно», прочитане з живої сторінки.

На сайті вартість — лише два варіанти (рішення Марії 13.09.2026): платить
родина хоч щось чи ні. У базі лишились проміжні значення — partially_free
(«з фінансуванням») і subsidized, — які на це питання не відповідали. На
13.09.2026 таких активних записів 43, і жоден не мав заповненої ціни. Гуртом
їх не перенесеш: хор «Щедрик», Coursera, FIRST Robotics і табір у Карпатах
мають різні відповіді.

Тому скрипт відкриває сторінку джерела й питає модель не «здогадайся», а «що
тут написано про гроші». Правило:
- free — дитина бере участь, і родина нічого не платить (зокрема місце
  покрите державою, грантом, фондом, організатором);
- paid — без оплати з боку родини участь неможлива, навіть часткової.

ПРАВИЛО, ВАЖЛИВІШЕ ЗА ВСІ ІНШІ: нічого не вигадувати. Кожен вердикт — лише з
дослівною цитатою зі сторінки. Немає цитати — нічого не міняємо, а в
модерацію йде діагноз.

Про живість сторінки тут не судимо — це справа verify-links.mjs. Не вдалося
прочитати — мовчимо й лишаємо наступному прогону (див. recheck_dates.py).

Запуск:
    python recheck_cost.py                       # дамп проміжних, нічого не пише
    python recheck_cost.py --apply               # пише в базу
    python recheck_cost.py --scope all --limit 200   # переглянути й решту бази

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
"""
import argparse
import logging
import os
import re
import time

import json
from urllib.parse import urlparse

import anthropic

import api_guard  # відмова через ліміт/оплату робить запуск червоним
import httpx

from recheck_dates import fetch_text

logger = logging.getLogger("recheck_cost")

MODEL = "claude-haiku-4-5-20251001"
BATCH = int(os.environ.get("BATCH", "150"))
DELAY = 0.6
MIN_EVIDENCE = 12
MIN_CONFIDENCE = 0.6

# Значення в базі. «Платно» зберігаємо як paid_affordable, щоб не міняти
# CHECK-обмеження таблиці; на сайті обидва платні підписані «Платно».
PAID_VALUES = {"paid_affordable", "paid_premium"}
IN_BETWEEN = ["partially_free", "subsidized"]

# «Безкоштовно» лише тоді, коли цитата прямо це каже. 14.09.2026 гурток
# «Кварц» отримав free за «комунальна, бюджетна, неприбуткова установа» — але
# бюджетна установа ще не означає безкоштовних занять. Це здогад, не цитата.
FREE_MARKERS = re.compile(
    r"безкоштовн|безоплатн|безплатн|без оплати|не потрібно платити|не сплачу"
    r"|за кошти (?:бюджету|держави|гранту|фонду|організатор)|повністю (?:покрива|фінансу|оплачу)"
    r"|\bfree\b|free of charge|no cost|no fee|fully (?:funded|covered|paid)"
    r"|kostenlos|gratis|gratuit|zdarma|zadarmo|bezpłatn|darmow|ingyenes|gratuito",
    re.IGNORECASE,
)

# Пошук в інших джерелах — лише для записів, по яких власна сторінка нічого не
# дала (рішення Марії 14.09.2026). Вебпошук є не на кожній моделі: той самий
# вибір, що в discover_agent.py.
SEARCH_MODEL = os.environ.get("SEARCH_MODEL") or "claude-sonnet-5"
SEARCH_MAX_USES = 4
# Причини, з якими варто шукати далі: сторінка мовчить або це перелік.
SEARCHABLE_WHY = (
    "сторінка не каже, чи платить родина",
    "сторінка не про одну можливість — це головна або перелік",
)

# Слова, з якими цитата про «безкоштовно» насправді каже «комусь доведеться
# платити». Прогін 13.09.2026 поставив UWC «безкоштовно» за цитатою «the offer
# may be fully or partially funded» — а часткове фінансування за нашим
# правилом означає «платно». Такий вердикт не приймаємо: безкоштовне має бути
# безкоштовним для всіх.
PARTIAL_MARKERS = re.compile(
    r"partial|partly|discount|reduced|subsidi|scholarship|depending on (?:demonstrated )?need"
    r"|частков|знижк|пільг|залежно від|стипенді|субсиді|доплат",
    re.IGNORECASE,
)

TOOL = {
    "name": "read_cost",
    "description": "Що сторінка каже про те, чи платить родина за участь дитини",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["free", "paid", "unknown"],
                "description": "free — родина нічого не платить (місце може бути "
                               "покрите державою, грантом, фондом). paid — без "
                               "оплати участь неможлива, навіть часткової; пільга "
                               "лише для окремих категорій — теж paid. unknown — "
                               "сторінка про гроші не говорить.",
            },
            "page_kind": {
                "type": "string",
                "enum": ["one_opportunity", "listing_or_org"],
                "description": "one_opportunity — сторінка описує саме ЦЮ програму. "
                               "listing_or_org — головна організації або перелік "
                               "багатьох подій: слова про оплату там стосуються "
                               "інших програм, а не нашої.",
            },
            "evidence": {
                "type": "string",
                "description": "ДОСЛІВНА цитата зі сторінки мовою оригіналу, на якій "
                               "стоїть вердикт, і вона має стосуватися САМЕ цієї "
                               "програми. Не переказ. Немає цитати — порожній рядок "
                               "і verdict=unknown.",
            },
            "price": {
                "type": "string",
                "description": "Якщо на сторінці названо суму — ДОСЛІВНО, як написано "
                               "(«500 грн/місяць», «$45 за курс»). Інакше порожньо.",
            },
            "confidence": {"type": "number", "description": "0.0–1.0"},
        },
        "required": ["verdict", "page_kind", "evidence", "confidence"],
        "additionalProperties": False,
    },
}

SYSTEM = """Тобі дають текст сторінки, з якої ми взяли можливість для дитини.
Питання одне: чи платить РОДИНА за участь дитини.

ГОЛОВНЕ ПРАВИЛО: НІЧОГО НЕ ВИГАДУЙ. Вердикт — лише з дослівною цитатою в
evidence. Немає цитати — verdict="unknown" і порожній evidence. Порожня
відповідь коштує нам одного тижня в черзі; вигаданий «безкоштовно» коштує
родині поїздки туди, де попросять гроші.

Як вирішувати:
- free: «безкоштовно», «навчання безоплатне», «участь безкоштовна», «за кошти
  бюджету», «грант покриває проживання й дорогу» — і на сторінці НЕМАЄ суми,
  яку платить родина. «Fully or partially funded», «часткова стипендія»,
  «знижка залежно від доходу» — це НЕ free: частина родин платить.
- paid: названо вартість, оргвнесок, абонемент, членський внесок, доплату,
  «батьківську плату», платний курс чи платну участь. Знижка, розстрочка,
  стипендія лише для частини учасників — усе одно paid.
- Безкоштовний доступ до частини (прослухати курс) при платному сертифікаті:
  якщо дитина може взяти участь, нічого не заплативши, — free; платне
  доповнення впиши в price.
- Якщо це головна сторінка організації чи перелік багатьох подій —
  page_kind="listing_or_org": фраза «участь безплатна» під ІНШОЮ подією
  нічого не каже про нашу програму.
- unknown: сторінка не говорить про гроші. НЕ здогадуйся з типу програми,
  назви організації чи того, що «державні школи зазвичай безкоштовні»."""


def ask(llm, row: dict, page: str) -> dict:
    try:
        resp = llm.messages.create(
            model=MODEL,
            max_tokens=500,
            system=SYSTEM,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "read_cost"},
            messages=[{"role": "user", "content":
                       f"Можливість: «{row['title']}» (тип: {row.get('opportunity_type')}).\n"
                       f"Адреса: {row['source_url']}\n\n"
                       f"Текст сторінки:\n{page}"}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        return block.input if block else {}
    except Exception as e:
        logger.error("LLM впав на «%s»: %s", row.get("title"), e)
        _stop_if_limit(e)
        # None, а не {}: порожня відповідь означала б «сторінка мовчить», і в
        # модерацію пішов би хибний діагноз (14.09.2026 — дев'ять записів).
        return None


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def decide_cost(row: dict, out: dict, page: str) -> tuple[dict, str]:
    """Що змінити в записі. Повертає (патч, пояснення); порожній патч — нічого.

    Чиста функція: ані мережі, ані бази — щоб правило можна було перевірити тестом.
    """
    verdict = out.get("verdict")
    evidence = (out.get("evidence") or "").strip()
    conf = out.get("confidence") or 0

    # Головна організації чи перелік подій: «участь безплатна» там стоїть під
    # чужими програмами. Прогін 14.09.2026 так поставив «безкоштовно» Літній
    # STEM-школі МАН — цитата була з man.gov.ua, але про семінари для педагогів.
    if out.get("page_kind") != "one_opportunity":
        return {}, "сторінка не про одну можливість — це головна або перелік"

    if verdict not in ("free", "paid") or len(evidence) < MIN_EVIDENCE or conf < MIN_CONFIDENCE:
        return {}, "сторінка не каже, чи платить родина"

    # Цитата мусить справді стояти на сторінці — інакше це переказ, а не цитата.
    if _norm(evidence)[:60] not in _norm(page):
        return {}, "цитати на сторінці немає — вердикт не приймаю"

    current = row.get("cost_type")
    patch: dict = {}

    if verdict == "free":
        if PARTIAL_MARKERS.search(evidence):
            return {}, "безкоштовно не для всіх (часткове фінансування чи пільга) — у модерацію"
        if not FREE_MARKERS.search(evidence):
            return {}, "цитата прямо не каже «безкоштовно» — здогад, не приймаю"
        if current != "free":
            patch["cost_type"] = "free"
        why = "безкоштовно"
    else:
        if current not in PAID_VALUES:
            patch["cost_type"] = "paid_affordable"
        why = "платно"
        price = (out.get("price") or "").strip()
        # Ціну пишемо, лише якщо її немає і якщо вона дослівно є на сторінці.
        if price and not row.get("price_note") and _norm(price) in _norm(page):
            patch["price_note"] = f"Платно: {price}"

    if not patch:
        return {}, f"{why} — без змін"
    return patch, f"{why}: «{evidence[:140]}»"


# Загальники, які є на будь-якій сторінці довідника чи програм обміну: збіг за
# ними нічого не каже. 14.09.2026 обмін «O-live T.R.E.E.S.» отримав «платно» за
# внеском із італійської сторінки про ІНШИЙ обмін — спільним було лише «Erasmus».
_STOP = {"для", "дітей", "дитячий", "дитяча", "дитячі", "гурток", "студія", "клуб",
         "школа", "центр", "україни", "український", "українська", "курси", "курс",
         "програма", "the", "and", "for", "with", "course", "courses", "program",
         "erasmus", "молодіжний", "молодіжні", "обмін", "обміни", "exchange", "youth",
         "олімпіада", "olympiad", "конкурс", "міжнародний", "міжнародна",
         "international", "табір", "camp", "summer", "літня", "school", "academy",
         "україна", "ukraine", "світова", "online", "онлайн"}


def title_tokens(title: str) -> list[str]:
    """Характерні слова назви: без загальників («гурток», «клуб»), від 4 літер."""
    words = re.findall(r"[\wЀ-ӿ'’-]+", (title or "").lower())
    return [w for w in words if len(w) >= 4 and w not in _STOP]


def page_mentions_title(title: str, page: str) -> bool:
    """Чи сторінка взагалі про цю програму: хоч одне характерне слово назви."""
    low = (page or "").lower()
    toks = sorted(set(title_tokens(title)))
    if not toks:
        return False
    # Дві характерні ознаки, якщо назва їх має: одне слово збігається випадково.
    need = 2 if len(toks) >= 2 else 1
    return sum(1 for t in toks if t in low) >= need


def extract_json_object(text: str) -> dict:
    """Перший JSON-обʼєкт у тексті моделі (вона інколи обгортає його словами)."""
    start = (text or "").find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start:i + 1])
                        return obj if isinstance(obj, dict) else {}
                    except ValueError:
                        break
        start = text.find("{", start + 1)
    return {}


SEARCH_PROMPT = """Знайди в інтернеті, чи платить родина за участь дитини в цій програмі.

Програма: «{title}»
Місто / формат: {place}
Сторінка, де ми її знайшли (про гроші там нічого): {url}

Шукай сайт самої організації, сторінку гуртка, положення, умови вступу, новину.
ГОЛОВНЕ ПРАВИЛО: НІЧОГО НЕ ВИГАДУЙ. Відповідь — лише з ДОСЛІВНОЮ цитатою зі
сторінки, яка описує САМЕ цю програму, і з адресою цієї сторінки. Не знайшов —
verdict="unknown". Здогадка «державні гуртки зазвичай безкоштовні» — це unknown.

free — родина нічого не платить. paid — без оплати участь неможлива, навіть
часткової; «частково фінансується», пільга для частини — теж paid.

Поверни ЛИШЕ JSON-обʼєкт, без пояснень:
{{"verdict": "free|paid|unknown", "page_kind": "one_opportunity|listing_or_org",
  "evidence": "дослівна цитата", "url": "адреса сторінки з цитатою",
  "price": "сума дослівно або порожньо", "confidence": 0.0}}"""


def search_other_sources(row: dict) -> dict:
    """Запит до моделі з вебпошуком. Повертає її JSON або {}."""
    place = ", ".join(row.get("cities") or []) or (row.get("format") or "невідомо")
    body = {
        "model": SEARCH_MODEL,
        "max_tokens": 1500,
        "tools": [{"type": "web_search_20250305", "name": "web_search",
                   "max_uses": SEARCH_MAX_USES}],
        "messages": [{"role": "user", "content": SEARCH_PROMPT.format(
            title=row["title"], place=place, url=row.get("source_url") or "—")}],
    }
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=180, json=body,
                       headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"],
                                "anthropic-version": "2023-06-01",
                                "content-type": "application/json"})
    except Exception as e:
        logger.error("Пошук впав на «%s»: %s", row.get("title"), e)
        return None
    if r.status_code != 200:
        logger.error("Пошук HTTP %s на «%s»: %s", r.status_code, row.get("title"), r.text[:300])
        api_guard.note(r.status_code, r.text[:400])
        _stop_if_limit(r.text)
        return None
    text = "".join(b.get("text", "") for b in r.json().get("content", [])
                   if b.get("type") == "text")
    return extract_json_object(text)


def decide_from_search(row: dict, out: dict, page: str | None) -> tuple[dict, str]:
    """Вердикт з іншого джерела. Ті самі правила, що й для власної сторінки, плюс:
    сторінку ми відкрили самі, і вона мусить згадувати саме цю програму."""
    url = (out.get("url") or "").strip()
    if out.get("verdict") not in ("free", "paid") or not url.startswith("http"):
        return {}, "в інших джерелах про оплату нічого"
    if not page:
        return {}, f"джерело не відкривається ({url})"
    if not page_mentions_title(row.get("title"), page):
        return {}, f"джерело не про цю програму ({url})"
    patch, why = decide_cost(row, out, page)
    host = urlparse(url).netloc.replace("www.", "")
    return patch, f"{why} · джерело: {host} {url}"


class UsageLimitReached(SystemExit):
    """Вичерпано ліміт витрат API — далі кожен запис дав би лише хибний діагноз."""


def _stop_if_limit(err) -> None:
    # 14.09.2026 о 09:14:54 API почав відповідати «You have reached your specified
    # API usage limits» — а скрипт ішов далі й писав у модерацію «сторінка не каже,
    # чи платить родина» дев'яти записам, яких модель навіть не бачила.
    if "usage limit" in str(err).lower():
        logger.error("Вичерпано ліміт витрат API — зупиняю прогін, щоб не писати хибних діагнозів.")
        raise UsageLimitReached(2)


# Діагнози, які з'являються, коли модель «нічого не сказала». Якщо насправді впав
# API, вони хибні — їх можна зняти за списком id, без жодного виклику моделі.
_API_FAILURE_NOTES = re.compile(
    r"\s*·?\s*recheck-cost · (?:сторінка не каже, чи платить родина"
    r"|в інших джерелах про оплату нічого)"
)


def strip_api_failure_notes(comment: str | None) -> str:
    cleaned = _API_FAILURE_NOTES.sub("", comment or "")
    cleaned = re.sub(r"(?:\s*·\s*){2,}", " · ", cleaned)
    return cleaned.strip(" ·\t\n")


def clear_notes(ids: list[str], apply: bool) -> int:
    """Зняти хибні діагнози з перелічених записів. Модель не потрібна."""
    from db import get_client
    sb = get_client()
    changed = 0
    for oid in ids:
        rows = sb.table("opportunities").select("id, title, admin_comment").eq("id", oid).execute().data or []
        if not rows:
            print(f"   · {oid} — не знайдено")
            continue
        row = rows[0]
        before = (row.get("admin_comment") or "").strip(" ·\t\n")
        after = strip_api_failure_notes(before)
        if after == before:
            print(f"   · {row['title'][:52]} — хибних діагнозів немає")
            continue
        changed += 1
        print(f"   · {row['title'][:52]} — знято")
        if apply:
            sb.table("opportunities").update({"admin_comment": after or None}).eq("id", oid).execute()
    print(f"\nЗнято з {changed} записів." + ("" if apply else " Це дамп — нічого не записано."))
    return changed


def _with_trace(row: dict, note: str) -> str:
    prev = (row.get("admin_comment") or "").strip()
    return (f"{prev} · {note}" if prev else note)[:500]


def _note(sb, row: dict, why: str, apply: bool) -> None:
    note = f"recheck-cost · {why}"
    if not apply or note in (row.get("admin_comment") or ""):
        return
    sb.table("opportunities").update(
        {"admin_comment": _with_trace(row, note)}
    ).eq("id", row["id"]).execute()


def select_rows(sb, scope: str, limit: int) -> list:
    q = (sb.table("opportunities")
         .select("id, title, source_url, opportunity_type, cost_type, price_note, "
                 "admin_comment, link_status, cities, format")
         .eq("status", "active"))
    if scope == "in_between":
        q = q.or_("cost_type.in.(partially_free,subsidized),cost_type.is.null")
    return q.order("updated_at").limit(limit).execute().data or []


def run(apply: bool = False, scope: str = "in_between", limit: int = BATCH,
        search: bool = False) -> dict:
    from db import get_client
    sb = get_client()
    llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])

    rows = select_rows(sb, scope, limit)
    print(f"Записів до перегляду ({scope}): {len(rows)}\n")

    stats = {"to_free": 0, "to_paid": 0, "price_added": 0, "unchanged": 0,
             "unclear": 0, "unread": 0, "missing": 0, "searched": 0}
    lists = {"free": [], "paid": [], "flip": [], "unclear": []}

    for row in rows:
        url = row.get("source_url")
        if not url:
            stats["unclear"] += 1
            lists["unclear"].append((row, "немає посилання"))
            _note(sb, row, "немає посилання — вартість не перевірити", apply)
            continue

        page, status, kind = fetch_text(url)
        time.sleep(DELAY)
        if not page:
            if kind == "transient" or row.get("link_status") == "ok":
                stats["unread"] += 1
                continue
            stats["missing"] += 1
            lists["unclear"].append((row, f"сторінки немає ({status})"))
            _note(sb, row, f"сторінки немає ({status}) — вартість не перевірити", apply)
            continue

        answer = ask(llm, row, page)
        if answer is None:
            stats["unread"] += 1
            continue
        patch, why = decide_cost(row, answer, page)
        # Власна сторінка мовчить або це перелік — шукаємо в інших джерелах.
        if search and not patch and why in SEARCHABLE_WHY:
            found = search_other_sources(row)
            if found is None:
                stats["unread"] += 1
                continue
            src_url = (found.get("url") or "").strip()
            src_page = fetch_text(src_url)[0] if src_url.startswith("http") else None
            time.sleep(DELAY)
            patch, why = decide_from_search(row, found, src_page)
            stats["searched"] += 1
        if not patch:
            if why.endswith("без змін"):
                stats["unchanged"] += 1
            else:
                stats["unclear"] += 1
                lists["unclear"].append((row, why))
                _note(sb, row, why, apply)
            continue

        before = row.get("cost_type")
        after = patch.get("cost_type", before)
        # Зміна вже двійкового значення на протилежне — окремим списком: її
        # людина має побачити першою.
        was_binary = before == "free" or before in PAID_VALUES
        if "cost_type" in patch and was_binary:
            lists["flip"].append((row, f"{before} → {after} · {why}"))
        elif after == "free":
            lists["free"].append((row, why))
        else:
            lists["paid"].append((row, why))

        if "cost_type" in patch:
            stats["to_free" if after == "free" else "to_paid"] += 1
        if "price_note" in patch:
            stats["price_added"] += 1

        if apply:
            patch["admin_comment"] = _with_trace(row, f"recheck-cost · {why}")
            sb.table("opportunities").update(patch).eq("id", row["id"]).execute()

    def dump(title, items):
        print(f"\n{title}: {len(items)}")
        for r, why in items:
            print(f"   · {r['title'][:52]:52} — {why}")

    dump("⚠️  ЗМІНА НА ПРОТИЛЕЖНЕ (перевірити першими)", lists["flip"])
    dump("🟢 БЕЗКОШТОВНО", lists["free"])
    dump("💳 ПЛАТНО", lists["paid"])
    dump("❔ НЕЗРОЗУМІЛО — у модерацію", lists["unclear"])

    print(f"\nРазом: → безкоштовно {stats['to_free']}, → платно {stats['to_paid']}, "
          f"ціну дописано {stats['price_added']}, без змін {stats['unchanged']}, "
          f"незрозуміло {stats['unclear']}, сторінки немає {stats['missing']}, "
          f"не прочитано {stats['unread']}, шукали в інших джерелах {stats['searched']}")
    if not apply:
        print("\nЦе дамп. Нічого не записано. Щоб застосувати: --apply")
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Безкоштовно чи платно — з живої сторінки")
    p.add_argument("--apply", action="store_true", help="реально писати в базу")
    p.add_argument("--scope", choices=["in_between", "all"], default="in_between")
    p.add_argument("--limit", type=int, default=BATCH)
    p.add_argument("--search", action="store_true",
                   help="якщо власна сторінка мовчить — шукати в інших джерелах")
    p.add_argument("--clear-notes", default="",
                   help="id через кому: зняти хибні діагнози, що з'явились через падіння API")
    args = p.parse_args()
    if args.clear_notes:
        clear_notes([x.strip() for x in args.clear_notes.split(",") if x.strip()], apply=args.apply)
    else:
        run(apply=args.apply, scope=args.scope, limit=args.limit, search=args.search)
