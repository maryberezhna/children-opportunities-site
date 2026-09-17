"""discover_agent.py — щоденний агент веб-пошуку можливостей (Claude).

Бере пару «тема дня × регіон дня» (дві незалежні детерміновані ротації), просить
Claude пошукати в інтернеті СВІЖІ конкретні можливості для дітей 0–18 і зберігає
знайдених кандидатів зі статусом ``draft``.

Регіон — Україна або країна з великою українською громадою (Польща, Німеччина,
Чехія та ін., див. keywords.REGION_ROTATION). Україна чергується з кожною
країною, тож лишається половиною запусків. Для закордонних регіонів у джерелі
(``source``) дописується назва країни — видно на /admin. На сайті
драфти не показуються (сайт фільтрує status='active') — їх схвалюють вручну на
/admin.

Env:
  ANTHROPIC_API_KEY         — ключ (web search має бути увімкнений в організації)
  SUPABASE_URL / SUPABASE_SERVICE_KEY
  DISCOVER_MODEL            — опц., модель (деф. claude-haiku-4-5-20251001).
                             Якщо буде HTTP 400 "web search not supported" —
                             постав claude-opus-4-8.
  DISCOVER_MAX              — опц., скільки кандидатів шукати (деф. 5)
  DISCOVER_REGION           — опц., перебити ротацію: назва міста або країни
                             («Дніпро», «Польща»). Потрібно, щоб закрити місто,
                             де в нас нуль, не чекаючи його дня в циклі.
  DISCOVER_KEYWORD          — опц., перебити тему дня («діти ветеранів»).
                             Ротація триває 161 день, а кампанія має дату.
  DRY_RUN=true              — лише вивести, нічого не писати
"""
import os
import re
import json
import difflib
import hashlib
import logging
from datetime import date, datetime, timezone

import httpx
from slugify import slugify

from urllib.parse import urlparse

from canonical import canonical_url
from db import get_client, record_crawl_result
import anthropic
import api_guard  # відмова через ліміт/оплату робить запуск червоним
import hubs
from keywords import (
    DISCOVER_KEYWORDS, RARE_ABROAD_KEYWORDS, RARE_ABROAD_REGIONS, REGION_ROTATION,
)
from normalizer import _sanitize, summary_says_over
from recheck_dates import fetch_text

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Web search is not supported on every model — haiku 4.5 returns HTTP 400.
# Default to sonnet-5 (supports web search, cheaper than opus); override with
# DISCOVER_MODEL=claude-opus-4-8 if needed.
MODEL = os.environ.get("DISCOVER_MODEL") or "claude-sonnet-5"
# Воркфлоу за розкладом передає незаповнені inputs порожнім рядком, а
# os.environ.get("X", "5") на "" дефолту не бере: int("") упав 11–13.09.2026,
# і агент три дні не шукав нічого. Тому скрізь `or` — він ловить і "".
MAX_CANDIDATES = int(os.environ.get("DISCOVER_MAX") or "5")
DRY_RUN = os.environ.get("DRY_RUN") == "true"
# Duplicate control: ≥ DUP_SKIP title match → drop the candidate entirely;
# DUP_TAG..DUP_SKIP → keep but flag as a possible duplicate of the match.
DUP_SKIP = float(os.environ.get("DUP_SKIP") or "0.80")
DUP_TAG = float(os.environ.get("DUP_TAG") or "0.60")

# Лише пріоритетні теми, категорії чергуються щодня — див. keywords.DISCOVER_KEYWORDS.
KEYWORDS = DISCOVER_KEYWORDS

# Профіль «рідкісне за кордоном» (discover-rare.yml): свої теми, лише закордонні
# регіони й окремий фокус у промпті. Решта конвеєра — та сама: дедуп, п'ять
# обовʼязкових полів, лише чернетки на модерацію.
PROFILE = (os.environ.get("DISCOVER_PROFILE") or "").strip()
RARE = PROFILE == "rare_abroad"

RARE_FOCUS = (
    "\nЦЕЙ ПОШУК — ПРО РІДКІСНЕ Й НЕЗВИЧНЕ. Шукай те, про що батьки самі не "
    "дізнаються: програми фондів відомих людей і клубів (зразок — безкоштовний "
    "тенісний табір Фонду Марти Костюк в Іспанії для українських дітей), "
    "спортивні, мистецькі й наукові табори, експедиції, турніри, резиденції, "
    "реабілітаційний відпочинок.\n"
    "ГОЛОВНА УМОВА: можливістю має змогу скористатися дитина, яка ЖИВЕ В "
    "УКРАЇНІ, — приїхати на табір, турнір чи програму або подати заявку з "
    "України. НЕ бери те, що вимагає проживати в цій країні: місцева школа, "
    "реєстрація за адресою, тимчасовий захист, статус біженця, «для родин, які "
    "перебувають у країні» — це для діаспори, не для нас.\n"
    "Бери ЛИШЕ якщо з тексту видно одне з двох: програма запрошує чи привозить "
    "дітей з України, АБО приймає заявки з будь-якої країни. Якщо умов участі не "
    "видно — не бери.\n"
    "НЕ бери: звичайні гуртки й мовні курси, олімпіади й конкурси лише для "
    "громадян цієї країни, комерційні табори без жодної ознаки відкритості для "
    "українських дітей.\n"
    "Вік — будь-який у межах 0–18; у summary одним реченням поясни, що саме "
    "незвичне і хто може подаватися.\n"
)


def _regions() -> list[dict]:
    return RARE_ABROAD_REGIONS if RARE else REGION_ROTATION


# ── Перевірка кандидата сторінкою (лише «рідкісне за кордоном») ─────────────
#
# Слово моделі з вебпошуку — ще не факт. Перший прогін 14.09.2026 запропонував
# «дитячий хор Palianycia для українських дітей у Празі»: на palianycia.cz не
# було ні слова про дітей, ні про Україну — лише концерти й назва. Тому
# кандидат іде в модерацію, тільки якщо агент САМ відкрив сторінку і на ній
# дослівно видно: це для дітей, і діти з України можуть брати участь.
VERIFY = RARE and (os.environ.get("DISCOVER_VERIFY") or "true") != "false"
# Перевірка актуальності сторінкою для ЗВИЧАЙНОГО пошуку. До 17.09.2026 сторінку
# читав лише флоу «рідкісне за кордоном», а щоденний агент пускав у чергу все:
# «Bloomsday Young Authors» (Ірландія) приїхав зі своїм же описом «сезон 2026
# року вже завершено». Тут перевіряємо лише одне — чи це ще попереду.
CHECK_CURRENT = not RARE and (os.environ.get("DISCOVER_CHECK_CURRENT") or "true") != "false"
VERIFY_MODEL = os.environ.get("DISCOVER_VERIFY_MODEL") or "claude-haiku-4-5-20251001"
MIN_QUOTE = 12

VERIFY_TOOL = {
    "name": "verify",
    "description": "Що сторінка каже про програму: для кого вона і чи можуть подаватися діти з України",
    "input_schema": {
        "type": "object",
        "properties": {
            "page_kind": {"type": "string", "enum": ["one_opportunity", "listing_or_org", "not_found"]},
            "for_children": {"type": "boolean"},
            "children_evidence": {"type": "string",
                                  "description": "ДОСЛІВНА цитата: вік, класи, «для дітей». Немає — порожньо."},
            "eligibility": {"type": "string", "enum": ["for_ukrainians", "open_to_all", "not_stated"]},
            "eligibility_evidence": {"type": "string",
                                     "description": "ДОСЛІВНА цитата про те, хто може брати участь. Немає — порожньо."},
            "kind": {"type": "string", "enum": ["unusual", "regular_club"]},
            "kind_reason": {"type": "string"},
            "residency": {"type": "string", "enum": ["open_from_ukraine", "residents_only", "unknown"],
                          "description": "open_from_ukraine — дитина з України може приїхати чи подати "
                                         "заявку звідти; residents_only — треба жити в країні "
                                         "(школа, адреса, тимчасовий захист, статус біженця); "
                                         "unknown — не сказано."},
            "residency_evidence": {"type": "string",
                                   "description": "ДОСЛІВНА цитата про те, чи треба жити в країні. Немає — порожньо."},
            "is_current": {"type": "string", "enum": ["current", "past", "unknown"],
                           "description": "current — набір чи подія ще попереду або триває; "
                                          "past — уже минуло; unknown — дат на сторінці немає."},
            "date_evidence": {"type": "string",
                              "description": "ДОСЛІВНА цитата з датою чи роком (дедлайн, дати "
                                             "проведення, «сезон 2026/27»). Немає — порожньо."},
        },
        "required": ["page_kind", "for_children", "children_evidence", "eligibility",
                     "eligibility_evidence", "kind", "residency", "residency_evidence",
                     "is_current", "date_evidence"],
        "additionalProperties": False,
    },
}

VERIFY_SYSTEM = """Тобі дають сторінку, яку агент запропонував як рідкісну можливість
за кордоном для дітей з України. Перевір її ЛИШЕ за текстом сторінки.

ГОЛОВНЕ ПРАВИЛО: НІЧОГО НЕ ВИГАДУЙ. Кожна відповідь — з дослівною цитатою мовою
оригіналу. Немає цитати — for_children=false або eligibility="not_stated".

1. page_kind: one_opportunity — сторінка описує одну конкретну програму;
   listing_or_org — головна організації чи перелік; not_found — сторінки немає.
2. for_children: програма для дітей чи підлітків до 18 років. children_evidence —
   цитата з віком, класами або словами «для дітей».
3. eligibility: for_ukrainians — прямо для дітей з України чи біженців;
   open_to_all — у тексті ЯВНО сказано, що участь відкрита для всіх, будь-якого
   походження чи для міжнародних учасників; not_stated — про це не сказано.
   Назва («Паляниця»), мова сайту чи країна — НЕ доказ.
4. kind: regular_club — звичайний регулярний гурток, секція чи курс поруч із
   домом; unusual — табір, турнір, експедиція, резиденція, фестиваль, програма
   фонду, стипендія — те, чого родина сама не знайде.
5. is_current: чи це ще актуально НА СЬОГОДНІ (дата — у повідомленні). Новина
   про табір, який уже відбувся, — past, навіть якщо програма колись була
   чудова. Щорічний конкурс, чий дедлайн чи подія цього року вже минули, а про
   наступний сезон нічого не сказано, — теж past. date_evidence — цитата з
   датою чи роком. Дата публікації новини — теж дата: стаття 2023 року без
   згадки про новий сезон — past.
6. residency: чи може скористатися дитина, яка ЖИВЕ В УКРАЇНІ. residents_only —
   у тексті вимога жити в країні: місцева школа, реєстрація, тимчасовий
   захист, «для родин, які перебувають у країні». open_from_ukraine — програма
   запрошує чи привозить дітей з України або приймає заявки з будь-якої
   країни. residency_evidence — цитата."""


def _norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def decide_verified(out: dict, page: str, today: date | None = None) -> tuple[bool, str]:
    """Чи пускати кандидата в модерацію. Чиста функція — під тести."""
    if out.get("page_kind") != "one_opportunity":
        return False, "сторінка не про одну програму"
    ch = (out.get("children_evidence") or "").strip()
    if not out.get("for_children") or len(ch) < MIN_QUOTE:
        return False, "на сторінці не видно, що це для дітей"
    if _norm_text(ch)[:60] not in _norm_text(page):
        return False, "цитати про дітей на сторінці немає"
    el = out.get("eligibility")
    ev = (out.get("eligibility_evidence") or "").strip()
    if el not in ("for_ukrainians", "open_to_all") or len(ev) < MIN_QUOTE:
        return False, "не видно, що діти з України можуть брати участь"
    if _norm_text(ev)[:60] not in _norm_text(page):
        return False, "цитати про участь на сторінці немає"
    if out.get("kind") == "regular_club":
        return False, "звичайний гурток, а не рідкісна можливість"

    # Доступність з України (Марія, 14.09.2026): «Darujeme kroužky dětem» —
    # доплата на гуртки для родин біженців, які ПЕРЕБУВАЮТЬ у Чехії. Дитина,
    # яка живе в Україні, цим не скористається — це для діаспори, не для нас.
    rq = (out.get("residency_evidence") or "").strip()
    residency = out.get("residency")
    if residency == "residents_only":
        return False, (f"треба жити в країні — з України не скористатися: «{rq[:100]}»"
                       if rq else "треба жити в країні — з України не скористатися")
    if residency == "open_from_ukraine" and rq and _norm_text(rq)[:60] not in _norm_text(page):
        return False, "цитати про участь з України на сторінці немає"
    ok, why = decide_current(out, page, today)
    if not ok:
        return False, why
    dq = (out.get("date_evidence") or "").strip()
    label = "для дітей з України" if el == "for_ukrainians" else "відкрито для всіх"
    # Безстрокові програми (урядовий протокол, постійний набір) дат не мають —
    # їх не губимо, але модератор бачить, що дату треба перевірити.
    when = f" · дата: «{dq[:80]}»" if dq else " · ⚠️ дату на сторінці не видно — перевірити"
    reach = (f" · з України: «{rq[:80]}»" if residency == "open_from_ukraine" and rq
             else " · ⚠️ не видно, чи можна скористатися з України — перевірити")
    return True, f"{label}: «{ev[:140]}»{reach}{when}"


def decide_current(out: dict, page: str, today: date | None = None) -> tuple[bool, str]:
    """Чи можливість ще попереду. Чиста функція — під тести.

    Актуальність. 14.09.2026 контрольний прогін «теніс · Іспанія» приніс
    новину 2023 року про табір, що давно відбувся: дітей і Україну перевірка
    бачила, а дату — ні. Рік у цитаті звіряємо самі, не покладаючись на
    модель: якщо всі роки в ній уже минули — це минуле. Минуле в межах
    ПОТОЧНОГО року (Bloomsday — 16 червня 2026) рік не ловить, тому моделі
    тепер передається сьогоднішня дата і її висновок is_current=past вирішальний.
    """
    dq = (out.get("date_evidence") or "").strip()
    if out.get("is_current") == "past":
        return False, f"уже минуло: «{dq[:80]}»" if dq else "уже минуло"
    if dq:
        if _norm_text(dq)[:60] not in _norm_text(page):
            return False, "цитати з датою на сторінці немає"
        years = [int(y) for y in re.findall(r"\b(20\d{2})\b", dq)]
        if years and max(years) < (today or date.today()).year:
            return False, f"дата в минулому: «{dq[:80]}»"
    return True, (f"актуально: «{dq[:80]}»" if dq
                  else "⚠️ дату на сторінці не видно — перевірити актуальність")


def verify_candidate(rec: dict, full: bool = True) -> tuple[bool, str]:
    """full=True — повна перевірка «рідкісного» флоу; False — лише актуальність."""
    page, status, _kind = fetch_text(rec["source_url"])
    if not page:
        if full:
            return False, f"сторінка не відкривається ({status})"
        # Частина сайтів не пускає сервери GitHub (403), хоча з браузера
        # відкривається. Звичайного кандидата через це не губимо — модератор
        # бачить, що актуальність ніхто не перевірив.
        return True, f"⚠️ актуальність не перевірено: сторінка не відкрилась ({status})"
    try:
        llm = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
        resp = llm.messages.create(
            model=VERIFY_MODEL, max_tokens=700, system=VERIFY_SYSTEM,
            tools=[VERIFY_TOOL], tool_choice={"type": "tool", "name": "verify"},
            messages=[{"role": "user", "content":
                       f"Сьогодні: {date.today().isoformat()}\n"
                       f"Кандидат: «{rec['title']}»\nАдреса: {rec['source_url']}\n\n"
                       f"Текст сторінки:\n{page}"}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        out = block.input if block else {}
    except Exception as e:
        if full:
            return False, f"перевірка впала: {type(e).__name__}"
        return True, f"⚠️ актуальність не перевірено: {type(e).__name__}"
    return decide_verified(out, page) if full else decide_current(out, page)


def keyword_of_day() -> str:
    """Слово дня — детермінована ротація по KEYWORDS, без стану.

    DISCOVER_KEYWORD перебиває ротацію — так само, як DISCOVER_REGION перебиває
    регіон. Потрібно, щоб закрити тему, яку не можна чекати: кампанія має дату,
    а ротація — ні."""
    override = (os.environ.get("DISCOVER_KEYWORD") or "").strip()
    if override:
        return override
    pool = RARE_ABROAD_KEYWORDS if RARE else KEYWORDS
    doy = date.today().timetuple().tm_yday
    return pool[doy % len(pool)]


def region_of_day() -> dict:
    """Регіон дня — окрема ротація від теми, щоб пари (тема, регіон) не
    повторювались роками.

    DISCOVER_REGION=Дніпро перебиває ротацію. Без цього нове місто чекало б
    свого дня до 48 діб, а міста, де в нас нуль, треба вміти закрити сьогодні.
    """
    forced = (os.environ.get("DISCOVER_REGION") or "").strip()
    if forced:
        for r in _regions():
            if r["name"].casefold() == forced.casefold():
                logger.info(f"Регіон задано вручну: {r['name']}")
                return r
        known = ", ".join(sorted({r["name"] for r in _regions()}))
        raise SystemExit(
            f"DISCOVER_REGION={forced!r} — такого регіону немає.\nДоступні: {known}"
        )
    doy = date.today().timetuple().tm_yday
    regions = _regions()
    return regions[doy % len(regions)]


def _prompt(kw: str, region: dict) -> str:
    is_home = region["name"] == "Україна"
    return (
        f"Сьогодні {date.today().isoformat()}.\n"
        f"Знайди в інтернеті до {MAX_CANDIDATES} КОНКРЕТНИХ, актуальних можливостей "
        f"{region['audience']} за темою «{kw}». Використай веб-пошук.\n"
        f"Мова пошуку: {region['hint']}.\n\n"
        "Кожна має бути:\n"
        "- для дітей/підлітків 0–18 (НЕ для дорослих чи студентів ВНЗ),\n"
        "- конкретна, з реальним організатором і сторінкою (НЕ агрегатор/каталог),\n"
        "- АКТУАЛЬНА на сьогодні: набір відкритий, триває, або вже оголошено\n"
        "  наступний сезон. Якщо подача чи подія цього року вже минули, а про\n"
        "  новий набір нічого не сказано, — НЕ бери, навіть якщо програма щорічна.\n"
        # У флоу «рідкісне за кордоном» цей блок вимкнено: його «для дітей з
        # України/біженців» пускало діаспорні програми, для яких треба жити в
        # країні. Там своя, суворіша умова — RARE_FOCUS.
        + ("" if is_home or RARE else
           f"- доступна для української дитини в цій країні: або прямо для дітей "
           f"з України/біженців, або відкрита для всіх без вимоги громадянства. "
           f"Мовний бар'єр — не привід відкидати, але познач у summary, якою "
           f"мовою проходить.\n"
           f"\nТему «{kw}» сприймай як загальний напрям, а не буквальний запит: "
           f"шукай місцевий відповідник. Українських реалій (ДЮСШ, МАН, НУШ, "
           f"позашкілля) в цій країні немає — там свої формати.\n")
        + (RARE_FOCUS if RARE else "")
        + "\n"
        "Поверни ВІДПОВІДЬ ЛИШЕ як JSON-масив (без пояснень, без markdown):\n"
        '[{"title":"...","summary":"1-3 речення опису","url":"https-посилання",'
        '"deadline":"YYYY-MM-DD або null","event_start_date":"YYYY-MM-DD або null",'
        '"event_end_date":"YYYY-MM-DD або null","recurrence":"annual|ongoing|null",'
        '"age_from":7,"age_to":17,'
        '"opportunity_type":"course|olympiad|competition|club|camp|scholarship|grant|festival|exchange|workshop",'
        '"cost_type":"free|paid_affordable",'
        '"format":"online|offline|hybrid|null","cities":["Рим"],'
        '"countries":["it"],"is_international":true}]\n'
        "\n"
        "ПʼЯТЬ ПОЛІВ, БЕЗ ЯКИХ ЗАПИС НЕ ПУБЛІКУЄТЬСЯ: вік, тип, вартість,\n"
        "дата-або-періодичність і місце-або-формат. Сторінку читаєш ти —\n"
        "тож і витягай їх ти, а не лишай модератору те, що в оголошенні\n"
        "написано прямим текстом:\n"
        "- cost_type — free, якщо родина нічого не платить (зокрема місце\n"
        "  покрите державою чи грантом); paid_affordable — якщо без оплати\n"
        "  участь неможлива, навіть часткової. Інших значень немає.\n"
        "- deadline — останній день ПОДАЧІ заявки. Якщо в тексті лише дати\n"
        "  проведення — deadline=null: день початку події НЕ є дедлайном.\n"
        "- event_start_date / event_end_date — коли подія ВІДБУВАЄТЬСЯ:\n"
        "  «6–8 листопада» → 6 і 8 листопада; одна дата → в обидва поля.\n"
        "- recurrence — коли конкретної дати подачі немає: annual, якщо в\n"
        "  тексті сказано, що це буває щороку («щорічний конкурс», «реєстрація\n"
        "  зазвичай у жовтні, сам конкурс — у листопаді»); ongoing, якщо набір\n"
        "  відкритий постійно (гурток, курс, виплата).\n"
        "- format — online (лише дистанційно), offline (лише наживо) або\n"
        "  hybrid. Участь через школу, приїзд на місце, адреса → offline.\n"
        "- cities — місто українською в називному («Рим», «Варшава», «Львів»).\n"
        "- countries — де дитина ФІЗИЧНО буде під час участі, кодами ISO\n"
        "  alpha-2: Італія → it, Польща → pl, Україна → ua. Повністю\n"
        "  дистанційна участь → [].\n"
        "- is_international — true, якщо організатор закордонний, учасники з\n"
        "  різних країн або дитина їде за кордон.\n"
        "НІЧОГО НЕ ВИГАДУЙ: чого в тексті немає — лишай null або [].\n"
        "Якщо нічого певного не знайдено — поверни []."
    )


def _extract_json_array(text: str):
    """Parse the first balanced JSON array in the text, ignoring any trailing
    prose (e.g. a citation/source list the model may append). Tries each '['
    position with raw_decode so a greedy '[.*]' span can't swallow non-JSON."""
    decoder = json.JSONDecoder()
    start = 0
    while True:
        i = text.find("[", start)
        if i == -1:
            return None
        try:
            value, _ = decoder.raw_decode(text, i)
            if isinstance(value, list):
                return value
        except json.JSONDecodeError:
            pass
        start = i + 1


def search_candidates(kw: str, region: dict) -> list[dict]:
    body = {
        "model": MODEL,
        # Вебпошук кладе результати в контекст, а відповідь моделі — це ще й
        # summary для кожного кандидата. 5000–6000 токенів не вистачало: у 2 з 13
        # прогонів (11.09 і 14.09.2026) відповідь обрізалась до JSON, і агент
        # «знаходив» 0 замість 8 — хоча пошук відпрацював.
        "max_tokens": 16000,
        # No user_location — the web_search tool rejects country code "UA"
        # ("Country code UA is not supported"). Ukraine focus comes from the
        # prompt text instead.
        "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}],
        "messages": [{"role": "user", "content": _prompt(kw, region)}],
    }
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
            timeout=300,
        )
    except Exception as e:
        logger.error("Request failed: %s", e)
        return []

    if r.status_code != 200:
        # Surface the real API message (e.g. low credit balance, web search
        # disabled, unsupported model) rather than guessing.
        detail = r.text[:400]
        try:
            detail = r.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        api_guard.note(r.status_code, detail)
        logger.error("Anthropic API HTTP %s: %s", r.status_code, detail)
        return []

    data = r.json()
    # Final answer = concatenation of top-level text blocks, in order.
    text = "".join(b.get("text", "") for b in data.get("content", [])
                   if b.get("type") == "text")
    searches = data.get("usage", {}).get("server_tool_use", {}).get("web_search_requests")
    logger.info("  web searches used: %s", searches)

    stop = data.get("stop_reason")
    if stop in ("max_tokens", "pause_turn"):
        logger.warning("  stop_reason=%s — відповідь могла обірватись, кандидати можуть бути неповні.", stop)

    parsed = _extract_json_array(text)
    if parsed is None:
        logger.info("  JSON-масив не виділено. Голова тексту: %s",
                    text[:200].replace("\n", " "))
        return []
    return [c for c in parsed if isinstance(c, dict)]


def _clamp_age(v, default):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(0, min(18, n))


def publisher(url: str) -> str:
    """Хто опублікував — за адресою. Це і є джерело в тому сенсі, у якому його
    читає людина на сайті.

    Раніше в source лежав пошуковий запит агента («🔎 Агент: гончарство»).
    Він потрібен модератору, але це не організація: 50 опублікованих записів
    показували відвідувачам внутрішній запит замість того, хто це проводить.
    Слід агента тепер живе в admin_comment, який публічно не видно.
    """
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


VALID_FORMATS = ("online", "offline", "hybrid")


def _clean_cities(raw) -> list:
    """Міста від моделі — списком рядків, без порожніх і без дублів.

    `_sanitize()` чистить країни, вік і періодичність, але не міста: у
    нормалізаторі вони приходять зі схеми інструмента, а тут — з вільного
    JSON, де замість масиву легко приїде рядок «Рим, Мілан».
    """
    if isinstance(raw, str):
        raw = [p for p in re.split(r"[,;/]", raw)]
    out = []
    for c in raw or []:
        city = str(c).strip()[:80]
        if city and city not in out:
            out.append(city)
    return out


def to_record(c: dict, kw: str, region: dict) -> dict | None:
    title = (c.get("title") or "").strip()
    url = (c.get("url") or "").strip()
    if not title or not url.startswith("http"):
        return None

    rec = {
        "title": title[:300],
        "summary": (c.get("summary") or "").strip()[:400],
        "age_from": _clamp_age(c.get("age_from"), 0),
        "age_to": _clamp_age(c.get("age_to"), 18),
        "opportunity_type": c.get("opportunity_type"),
        "cost_type": c.get("cost_type"),
        "deadline": c.get("deadline"),
        # Дати проведення окремо від дедлайну (з 16.09.2026). Агент раніше
        # клав перший день події в deadline — див. міграцію
        # 20260916_event_start_and_apply_url.sql.
        "event_start_date": c.get("event_start_date"),
        "event_end_date": c.get("event_end_date"),
        # Дата-або-періодичність і місце-або-формат — два з пʼяти обовʼязкових
        # полів. Агент їх не питав узагалі, тож КОЖЕН його драфт приїздив у
        # чергу з «бракує: дата…, формат або місце», навіть коли в самому
        # оголошенні написано «щорічний конкурс для італійських шкіл».
        # Модератор дочитував це руками за моделлю, яка сторінку вже прочитала.
        "recurrence": c.get("recurrence"),
        "format": c.get("format") if c.get("format") in VALID_FORMATS else None,
        "cities": _clean_cities(c.get("cities")),
        "countries": c.get("countries"),
        "is_international": c.get("is_international"),
        # Джерело — той, хто опублікував. Слід агента (запит і країна) іде в
        # admin_comment: модератору він потрібен, відвідувачу — ні.
        "source": publisher(url) or "інтернет",
        "admin_comment": (f"🌍 Рідкісне за кордоном: {kw} · {region['name']}" if RARE
                          else f"🔎 Агент: {kw}" if region["name"] == "Україна"
                          else f"🔎 Агент: {kw} · {region['name']}"),
        "source_url": url,
        "canonical_url": canonical_url(url),
        "status": "draft",
    }
    rec = _sanitize(rec)
    # «Онлайн» у cities — теж відповідь на питання «де», і фільтр міст на
    # сайті вміє її читати. Та сама умова, що в main.py: без неї
    # онлайн-можливість випадала з фільтра зовсім.
    if not rec.get("cities") and rec.get("format") == "online":
        rec["cities"] = ["Онлайн"]
    if rec["age_from"] > rec["age_to"]:
        rec["age_from"], rec["age_to"] = 0, 18

    short = hashlib.md5(f"{title}{url}".encode()).hexdigest()[:6]
    rec["slug"] = f"{slugify(title, max_length=80, word_boundary=True)}-{short}"
    normalized = re.sub(r"[^\w\s]", "", title.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    rec["content_hash"] = hashlib.sha256(f"{normalized}|{url}".encode()).hexdigest()[:16]
    rec["canonical_url"] = canonical_url(url)
    return rec


def _norm_title(t: str) -> str:
    t = (t or "").lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _domain(u: str) -> str:
    """Registrable-домен без www: для «цей сайт уже в каталозі»-дедупу."""
    from urllib.parse import urlparse
    netloc = urlparse(u or "").netloc.lower()
    return netloc[4:] if netloc.startswith("www.") else netloc


def _best_match(title: str, existing: list) -> tuple:
    """existing: list of (slug, normalized_title). Returns (slug, score) of the
    closest existing opportunity by title similarity."""
    nt = _norm_title(title)
    if not nt:
        return None, 0.0
    best_slug, best = None, 0.0
    for slug, ntitle in existing:
        if not ntitle:
            continue
        score = difflib.SequenceMatcher(None, nt, ntitle).ratio()
        if score > best:
            best, best_slug = score, slug
    return best_slug, best


def _esc(s):
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def notify_new(added: int, kw: str) -> None:
    """Ping the admin chat that N new candidates are queued, with a ▶️ button
    that starts the one-by-one review (the bot then delivers them one at a time).
    No-op unless TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID are set."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID")
    if not token or not chat or added <= 0:
        return
    payload = {
        "chat_id": chat,
        "text": (f"🆕 <b>{added} нових кандидатів</b> на апрув (слово «{_esc(kw)}»).\n"
                 "Переглянути по одному:"),
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": [[
            {"text": "▶️ Переглянути", "callback_data": "mod:next"},
        ]]},
    }
    try:
        httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload, timeout=20)
    except Exception as e:
        logger.warning("  Telegram notify failed: %s", e)


def main() -> int:
    kw = keyword_of_day()
    region = region_of_day()
    if RARE:
        logger.info("🌍 Профіль: рідкісне за кордоном")
    logger.info("🔎 Агент — слово дня: «%s» · регіон: %s (модель %s)%s",
                kw, region["name"], MODEL, " [DRY RUN]" if DRY_RUN else "")

    candidates = search_candidates(kw, region)
    logger.info("  Знайдено кандидатів: %d", len(candidates))
    if not candidates:
        return 0

    client = get_client()

    # Existing titles (active + draft) for duplicate analysis — every candidate
    # is compared against these BEFORE it can enter the moderation queue.
    try:
        rows = (client.table("opportunities").select("title, slug, canonical_url, source_url")
                .in_("status", ["active", "draft"]).execute().data or [])
    except Exception as e:
        logger.warning("  Не вдалося завантажити наявні для дедупу: %s", e)
        rows = []
    existing = [(r["slug"], _norm_title(r.get("title"))) for r in rows if r.get("slug")]

    # URL-дедуп: назва кандидата може бути якою завгодно, але сайт, що вже є в
    # каталозі, НЕ сміє пропонуватися як новий (кейс liouba-lorrukraine.fr —
    # запис існував з квітня, а дедуп по назві його не бачив).
    #
    # «Сайт уже є» — лише коли в базі запис про сайт ЦІЛКОМ (корінь домену).
    # Раніше тут вистачало будь-якого запису з домену, а хаби читались із
    # колонки `url`, якої в dedup_hub_urls немає (там url_prefix): виняток тихо
    # ковтався, список хабів завжди був порожній, і портал на кшталт
    # spilkuisia.kr.gov.ua відкидав усі нові можливості (11.09.2026: 5 із 8).
    existing_cus, existing_urls = set(), []
    for r in rows:
        cu = r.get("canonical_url") or (canonical_url(r["source_url"]) if r.get("source_url") else "")
        if cu:
            existing_cus.add(cu)
            existing_urls.append(cu)
    site_domains = hubs.site_root_domains(existing_urls)
    hub_domains = hubs.hub_domains(hubs.prime(client))

    added, skipped, dup_skipped, flagged = 0, 0, 0, 0
    unverified = 0
    for c in candidates:
        rec = to_record(c, kw, region)
        if not rec:
            skipped += 1
            continue

        cu = rec.get("canonical_url") or ""
        dom = _domain(cu)
        if cu and cu in existing_cus:
            dup_skipped += 1
            logger.info("  ⏭ URL уже в каталозі — не пропоную: %s", cu)
            continue
        if dom and dom in site_domains and dom not in hub_domains:
            dup_skipped += 1
            logger.info("  ⏭ сайт уже в каталозі як одна можливість (%s) — не пропоную: %s",
                        dom, rec["title"][:55])
            continue

        # Duplicate analysis (also catches near-dupes within this batch).
        best_slug, score = _best_match(rec["title"], existing)
        if score >= DUP_SKIP:
            dup_skipped += 1
            logger.info("  ⏭ дублікат %.0f%% (з %s) — не пропоную: %s",
                        score * 100, best_slug, rec["title"][:55])
            continue
        if score >= DUP_TAG:
            rec["dup_of"] = best_slug
            rec["dup_score"] = round(score, 3)
            flagged += 1

        # Агент сам написав, що все минуло, — сторінку навіть не відкриваємо.
        if summary_says_over(rec.get("summary")):
            unverified += 1
            logger.info("  ✗ в описі сказано, що вже завершено: %s", rec["title"][:55])
            continue

        if VERIFY or CHECK_CURRENT:
            ok, why = verify_candidate(rec, full=VERIFY)
            if not ok:
                unverified += 1
                logger.info("  ✗ не підтверджено сторінкою (%s): %s", why, rec["title"][:55])
                continue
            rec["admin_comment"] = f"{rec['admin_comment']} · {why}"[:500]
            logger.info("  ✓ підтверджено: %s", why[:120])

        if DRY_RUN:
            tag = f"  ⚠ схоже на {best_slug} ({score:.0%})" if rec.get("dup_of") else ""
            logger.info("  [DRY] %s → %s%s", rec["title"][:60], rec["source_url"], tag)
            added += 1
            existing.append((rec["slug"], _norm_title(rec["title"])))
            continue

        try:
            if (client.table("opportunities").select("id")
                    .eq("content_hash", rec["content_hash"]).execute().data):
                skipped += 1
                continue
            client.table("opportunities").insert(
                {**rec, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).execute()
            added += 1
            existing.append((rec["slug"], _norm_title(rec["title"])))
            if cu:
                existing_cus.add(cu)
                # Щойно доданий сайт-цілком теж має блокувати повтор у цій же партії.
                if hubs.is_site_root(cu):
                    site_domains.add(dom)
            logger.info("  ✅ draft%s: %s",
                        f" ⚠дубль~{int(score*100)}%" if rec.get("dup_of") else "",
                        rec["title"][:65])
        except Exception as e:
            logger.error("  ✗ insert failed for '%s': %s", rec["title"][:50], e)
            skipped += 1

    if VERIFY or CHECK_CURRENT:
        logger.info("Не пройшли перевірку (минуле або не підтверджено): %d", unverified)

    # Здоров'я агента в тому ж реєстрі, що й у решти джерел. Без цього
    # рядок discover-agent мав checks_count=0 і порожній last_success_at:
    # агент міг мовчки падати тижнями, і ніде б це не спливло.
    try:
        record_crawl_result(client, "discover-agent", ok=True, new_items=added)
    except Exception as e:
        logger.error("Не вдалось записати здоров'я discover-agent: %s", e)

    notify_new(added, kw)  # ping the admin chat with a ▶️ button to start review
    logger.info("\nГотово: %d драфтів (%d з тегом «дубль»), %d як дублікати відкинуто, "
                "%d інших пропущено. Модерація — на /admin або в боті.",
                added, flagged, dup_skipped, skipped)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
