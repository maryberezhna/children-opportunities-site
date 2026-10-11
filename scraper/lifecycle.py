"""lifecycle.py — планова перевірка: єдиний власник життя запису в часі.

Навіщо. Аудит «Дедлайн, подія, сезон» (17.09.2026) знайшов, що записом у часі
керували шість процесів, кожен за своїм розкладом і своїм списком типів:
check-deadlines закривав і стирав дедлайни, ttl_requeue перечитував сторінки
за TTL типу, recheck_dates і backfill_deadlines щотижня перечитували базу,
сезонна перевірка давала одну спробу на рік. Наслідки: 128 періодичних програм
(зокрема Всеукраїнські олімпіади) закрились назавжди; конкурси й гранти з
минулим дедлайном висіли активними як «щорічні»; токени йшли пропорційно
розміру бази, а не тому, що справді треба перевірити.

Принцип Марії: «ціль не скрапити нон-стоп, а мати базу і періодично її
продивлятися або оновлювати». Тому тут три кроки:

  A. Закриття за датою — без моделі й без мережі. Минула подача чи подія →
     запис закривається, а дата наступної перевірки залежить від виду:
     одноразова — жодної; періодична — перед наступним сезоном; постійна —
     скоро (минула дата в постійної — суперечність); невідомий вид — скоро.
     Між сезонами періодична програма зникає зі списків, сторінка живе
     (рішення Марії «Б»).
  B. Планова перевірка — лише записи, чия дата перевірки настала. Читаємо
     сторінку чи допис у Telegram і вирішуємо: сезон відкрито → запис
     активний з новими датами; ще не відкрито → дивимось через два тижні;
     сезон завершився → наступна перевірка перед наступним сезоном; програми
     більше немає → позначка модератору. Минулих дат не пишемо ніколи.
  C. --bootstrap: разово ставить першу дату перевірки тим, у кого її немає,
     рівномірно по днях.

Схвалені людиною записи теж оновлюються — але лише полями часу (статус,
дати, дата перевірки, вид). Текст, який правила людина, не чіпаємо.

Запуск:
    python scraper/lifecycle.py --dry-run               # що зробив би сьогодні
    python scraper/lifecycle.py --bootstrap --dry-run   # розклад перших перевірок
    python scraper/lifecycle.py                         # щоденний прогін
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import time
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import anthropic

import api_guard
import usage
from db import get_client
from first_source import source_problem
from requests_guard import protected_ids
from normalizer import missing_required_keys
from recheck_dates import _date_supported_by, _valid_date, _with_trace, fetch_text
from remark import telegram_text, _TG_POST
from timing import (
    CONFIRM_AFTER_CLOSE_DAYS, JUST_CLOSED_DAYS, LABELS, RETRY_DAYS, UNKNOWN_RECHECK_DAYS,
    clean_kind, clean_months, clean_text, evidence_in_text, is_expired,
    next_season_check, permanent_recheck_days, recheck_after_close, spread_date,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("lifecycle")

MODEL = "claude-haiku-4-5-20251001"
# Скільки зʼїла перевірка — у llm_usage (04.10.2026, після вичерпаного
# балансу). Перевірку перед постом у Telegram (verify-before-post.mjs) запускає
# цей самий скрипт, тож вона пишеться під імʼям свого воркфлоу.
SPEND = usage.Spend("lifecycle")
DAILY_LIMIT = int(os.environ.get("LIFECYCLE_LIMIT") or "30")
PAGE_CHARS = 9000
# Скільки тексту сторінки взагалі читати. Моделі все одно йде не більше
# PAGE_CHARS — початок і місця з датами (focus_text).
FETCH_CHARS = 60000
DELAY = 0.6

SELECT = ("id, title, source, source_url, apply_url, status, opportunity_type, timing_kind, "
          "timing_assumed, season_months, deadline, event_start_date, event_end_date, "
          "results_date, recheck_at, verified_at, admin_comment, page_hash, "
          "check_interval_days")

# Ритм перевірки постійних записів — як у пошуковика (Марія, 21.09.2026:
# «візьми як робить гугл: якщо джерело оновлюється — перевіряти частіше, а
# якщо ні — рідше»). Сторінка змінилась — інтервал удвічі коротший; та сама —
# удвічі довший. Межі — теж її: «до тижня найчастіше і раз в 3 місяці
# найдовше».
MIN_CHECK_DAYS = 7
MAX_CHECK_DAYS = 90


def page_fingerprint(text: str) -> str | None:
    """Відбиток тексту сторінки: пробіли й регістр не рахуються, решта — так.

    Цифри свідомо НЕ прибираємо: зсунутий дедлайн чи новий рік на сторінці —
    саме та зміна, заради якої її треба перечитати моделлю."""
    norm = " ".join((text or "").split()).casefold()
    return hashlib.sha1(norm.encode("utf-8")).hexdigest() if norm else None


def unchanged_open(row: dict, fingerprint: str | None) -> bool:
    """Чи можна не питати модель: постійний відкритий запис, і текст сторінки
    дослівно той, на якому минула перевірка сказала «відкрито».

    Лише для постійних: у них стан не залежить від сьогоднішньої дати. Для
    записів із датами чи сезоном та сама сторінка сьогодні може означати інше
    («реєстрація з 1 жовтня»), тож їх модель читає завжди. Відбиток пишеться
    лише у вердикті «постійний і відкритий» (decide_check), після будь-якого
    іншого — стирається."""
    return bool(fingerprint) and row.get("page_hash") == fingerprint \
        and row.get("status") == "active" and row.get("timing_kind") == "permanent"


def plan_unchanged(row: dict, today: date) -> dict:
    """Сторінка та сама — модель не кличемо, наступну перевірку відсуваємо вдвічі
    (не далі ніж на MAX_CHECK_DAYS)."""
    prev = row.get("check_interval_days") or permanent_recheck_days(row)
    days = min(MAX_CHECK_DAYS, prev * 2)
    return {"recheck_at": (today + timedelta(days=days)).isoformat(),
            "check_interval_days": days,
            "content_checked_at": datetime.now(timezone.utc).isoformat()}


def _adaptive_days(row: dict, fingerprint: str | None, assumed: bool) -> int:
    """Інтервал після перевірки моделлю постійного відкритого запису."""
    prev_hash, prev = row.get("page_hash"), row.get("check_interval_days")
    if prev and prev_hash and fingerprint and prev_hash != fingerprint:
        return max(MIN_CHECK_DAYS, prev // 2)          # сторінка живе — частіше
    if prev and prev_hash == fingerprint:
        return prev
    return permanent_recheck_days({"timing_assumed": assumed})

STATES = ("open", "upcoming", "ended", "gone", "unclear")

TOOL = {
    "name": "check_season",
    "description": "Стан можливості на сьогодні за текстом її джерела",
    "input_schema": {
        "type": "object",
        "properties": {
            "state": {
                "type": "string",
                "enum": list(STATES),
                "description": "open — подати заявку чи записатися можна просто зараз; "
                               "upcoming — новий сезон оголошено, але подача ще не "
                               "відкрита; ended — цей сезон чи набір завершено, про "
                               "новий нічого; gone — програми за цією адресою більше "
                               "немає або сторінка не про неї; unclear — не зрозуміло.",
            },
            "deadline": {"type": ["string", "null"],
                         "description": "YYYY-MM-DD — останній день ПОДАЧІ поточного чи "
                                        "наступного сезону, якщо названий."},
            "event_start_date": {"type": ["string", "null"],
                                 "description": "YYYY-MM-DD — перший день проведення."},
            "event_end_date": {"type": ["string", "null"],
                               "description": "YYYY-MM-DD — останній день проведення."},
            "evidence": {"type": "string",
                         "description": "ДОСЛІВНА цитата зі сторінки, на якій ґрунтуються "
                                        "стан і дати. Дата мусить стояти в цитаті."},
            "timing_kind": {"type": "string",
                            "enum": ["one_time", "periodic", "permanent", "unknown"]},
            "season_months": {"type": "array",
                              "items": {"type": "integer", "minimum": 1, "maximum": 12}},
            "kind_evidence": {"type": "string",
                              "description": "ДОСЛІВНА цитата, з якої видно вид. "
                                             "Немає — порожньо."},
        },
        "required": ["state", "evidence", "timing_kind"],
    },
}

SYSTEM = """Сьогодні {today}. Ти перевіряєш, у якому стані зараз можливість для
дітей, за текстом її джерела — сторінки чи допису. Відповідай лише за текстом.

НІЧОГО НЕ ВИГАДУЙ. Кожен висновок — з дослівною цитатою. Дату пиши лише тоді,
коли вона стоїть у цитаті. Рік не вказано — найближчий майбутній; але якщо
текст про минулий сезон, дат не пиши.

Дати — дві різні речі: «до коли подати» → deadline; «коли відбувається» →
event_start_date / event_end_date. День початку події — не дедлайн.

Стан:
- open — подати чи записатися можна зараз: дедлайн попереду, набір триває,
  форма відкрита, запис постійний.
- upcoming — новий сезон оголошено, але подача ще не відкрита.
- ended — цьогорічний сезон завершено, про новий нічого. Сторінка з
  торішніми датами — теж ended, а не open.
- gone — програми за адресою більше немає: сторінка про інше, «проєкт
  завершено назавжди», організація припинила програму.
- unclear — не зрозуміло.

Вид (timing_kind): one_time — разова подія чи набір; periodic — повторюється
циклами («щороку», «традиційний», «VII Всеукраїнський»); permanent —
записатися можна будь-коли; unknown — не видно. season_months — для periodic:
місяці, коли зазвичай відкрита подача чи проходить подія, з тексту."""


# ── A. Закриття за датою ────────────────────────────────────────────────────

def plan_close(row: dict, today: date) -> dict | None:
    """Патч для запису, що минув, або None. Чиста функція — під тести."""
    if row.get("status") != "active" or not is_expired(row, today):
        return None
    kind = row.get("timing_kind")
    # Закриваємо за датою, не читаючи сторінки, — але за 2 дні читаємо її один
    # раз: організатори часто подовжують подачу. Без цього запис лишався
    # закритим назавжди: Sikorsky Challenge закрився 30.09.2026 і не мав жодної
    # перевірки, хоча заявки приймали до 20.10 (Марія, 07.10.2026: «чому
    # оновлення не працює»). Якщо перечитування нічого не прояснить, далі
    # розклад той самий, що й без нього (decide_check → recheck_after_close).
    recheck = today + timedelta(days=CONFIRM_AFTER_CLOSE_DAYS)
    last = row.get("deadline") or row.get("event_end_date") or row.get("event_start_date")
    label = LABELS.get(kind, "вид невідомий")
    note = (f"lifecycle: закрито {today.isoformat()} — дата {last} минула ({label}), "
            f"перевірка {recheck.isoformat()}: чи не подовжили")
    return {"status": "closed",
            "recheck_at": recheck.isoformat() if recheck else None,
            "admin_comment": _with_trace(row, note)}


# Сторінка нещодавно закритого запису каже «набір триває», а нової дати не
# дає — людині в чергу, якщо закрито не раніше ніж 60 днів тому.
REVIEW_AFTER_CLOSE_DAYS = 60


def just_closed(row: dict, today: date, days: int = JUST_CLOSED_DAYS) -> bool:
    """Остання дата запису минула щойно (за days днів) — це перевірка після
    закриття за датою, а не сезонна. Чиста функція — під тести."""
    dates = [str(d)[:10] for d in (row.get("deadline"), row.get("event_start_date"),
                                   row.get("event_end_date")) if d]
    if not dates:
        return False
    last = max(dates)
    return (today - timedelta(days=days)).isoformat() <= last < today.isoformat()


def pick_spare(rows: list[dict], due_ids: set, n: int) -> list[dict]:
    """Ким заповнити вільні місця щоденного ліміту. Чиста функція — під тести.

    582 з 761 активних записів (07.10.2026) не мають дат — гуртки, виплати,
    допомога. Самі вони не минають, а зникнути можуть тихо, і 371 з них ще
    жодного разу не перечитували: перші перевірки розкладено до грудня. Коли
    на сьогодні запланованих менше за ліміт, решту місць беремо з таких
    записів — найближчих за розкладом. Сайти, що не пускають робота, не
    беремо: їхній ритм веде plan_unreadable, щоденні спроби його зламали б."""
    out: list[dict] = []
    if n <= 0:
        return out
    for r in rows:
        comment = r.get("admin_comment") or ""
        if r["id"] in due_ids or UNREADABLE_MARK in comment or MANUAL_MARK in comment:
            continue
        out.append(r)
        if len(out) >= n:
            break
    return out


# ── B. Планова перевірка ────────────────────────────────────────────────────

def decide_check(row: dict, out: dict, page: str, today: date,
                 fingerprint: str | None = None) -> dict:
    """Що змінити за результатом перевірки. Чиста функція — під тести.

    fingerprint — відбиток прочитаного тексту (page_fingerprint). Зберігається
    лише для постійного відкритого запису; будь-який інший вердикт його стирає,
    щоб наступна перевірка не пропустила модель на старій підставі."""
    iso_today = today.isoformat()
    state = out.get("state") if out.get("state") in STATES else "unclear"
    evidence = (out.get("evidence") or "").strip()

    # Вид: беремо з перевірки лише тоді, коли запис його ще не має і модель
    # навела справжню цитату (правило розмітки від 17.09.2026).
    kind = row.get("timing_kind")
    patch: dict = {"page_hash": None} if fingerprint else {}
    new_kind = clean_kind(out.get("timing_kind"))
    kind_quote = (out.get("kind_evidence") or "").strip()
    quoted_kind = bool(kind_quote and evidence_in_text(kind_quote, page))
    if not kind and new_kind and quoted_kind:
        kind = new_kind
        patch["timing_kind"] = kind
        patch["timing_assumed"] = False      # тепер вид стоїть на цитаті, не на здогаді
    elif row.get("timing_assumed") and kind and new_kind == kind and quoted_kind:
        # Здогад підтвердився цитатою — далі це вже факт.
        patch["timing_assumed"] = False
    # Місяці сезону: якщо запис періодичний, а місяців у ньому немає, беремо їх
    # із перевірки (з цитатою). Без них наступна перевірка ставилась «через 30
    # днів» — так Bloomsday із сезоном у червні перевірявся б щомісяця.
    if (kind == "periodic" and not row.get("season_months") and quoted_kind
            and new_kind in (None, "periodic")):
        months = clean_months(out.get("season_months"))
        if months:
            patch["season_months"] = months
    months = patch.get("season_months") or row.get("season_months")

    # Дати: лише ті, що стоять у цитаті, і лише майбутні.
    fresh = {}
    for key in ("deadline", "event_start_date", "event_end_date"):
        val = _valid_date(out.get(key))
        if val and _date_supported_by(val, evidence) and val >= iso_today:
            fresh[key] = val
    if fresh.get("event_start_date") and fresh.get("event_end_date") \
            and fresh["event_start_date"] > fresh["event_end_date"]:
        fresh.pop("event_start_date")
    if fresh.get("deadline") and fresh.get("event_end_date") \
            and fresh["deadline"] > fresh["event_end_date"]:
        fresh = {}                                    # суперечність — не пишемо

    quote = f"«{evidence[:100]}»" if evidence else "без цитати"

    # Закриття — лише на дослівній цитаті зі сторінки й без суперечності з
    # датами запису. 21.09.2026 перевірка закрила бізнес-програму з дедлайном
    # 24.09, а «доказом» записала власний висновок: «Дедлайн: 24 вересня 2026
    # року. Сьогодні 2026-09-21, дедлайн уже минув». Друге речення не зі
    # сторінки й хибне — до дедлайну лишалось три дні. Цитату звіряли лише для
    # виду в часі, для самого закриття — ні.
    if state in ("ended", "gone"):
        why = None
        if not (evidence and evidence_in_text(evidence, page)):
            why = "висновок без дослівної цитати зі сторінки"
        elif state == "ended":
            ahead = [d for d in (row.get("deadline"), row.get("event_start_date"),
                                 row.get("event_end_date")) if d and str(d)[:10] >= iso_today]
            if ahead and not _CLOSED_WORDS.search(evidence):
                why = f"у записі майбутня дата {min(ahead)}, а в цитаті немає слів про завершення"
        if why:
            days = UNKNOWN_RECHECK_DAYS if row.get("status") == "active" else RETRY_DAYS
            patch["recheck_at"] = (today + timedelta(days=days)).isoformat()
            patch["admin_comment"] = _with_trace(
                row, f"lifecycle {iso_today}: не закрито — {why}: {quote}"[:240])
            patch["content_checked_at"] = datetime.now(timezone.utc).isoformat()
            return patch

    if state == "gone":
        patch.update({"status": "closed", "recheck_at": None})
        note = f"програми за адресою більше немає — перевір: {quote}"
    elif state == "open" and (fresh or kind == "permanent"):
        # Цитата, на якій стоять нові дати, — це й доказ поля «дата».
        ev = dict(row.get("evidence")) if isinstance(row.get("evidence"), dict) else {}
        if fresh and evidence and evidence_in_text(evidence, page):
            ev["date"] = evidence[:300]
            patch["evidence"] = ev
        # Повернути на сайт запис, якого там немає (закритий, чернетка), можна
        # тоді ж, коли й будь-який новий: з 03.10.2026 тримає лише брак дати в
        # програми з датами (рішення Марії; до того — цитати на всі пʼять
        # полів, PR #553). Інакше — чернетка з переліком, чого бракує.
        reopening = row.get("status") != "active"
        missing = (missing_required_keys({**row, **fresh, "evidence": ev})
                   if reopening else [])
        # Ті самі ворота, що в кнопок адмінки: без посилання чи з дописом
        # чужого каналу запис на сайт не повертається (09.10.2026).
        bad_source = source_problem(row) if reopening else ""
        if bad_source:
            missing = [*missing, bad_source]
        patch.update({"status": "draft" if missing else "active", **fresh})
        # Нові дати сезону замінюють старі цілком — старі належать минулому циклу.
        for key in ("deadline", "event_start_date", "event_end_date"):
            if fresh and key not in fresh:
                patch[key] = None
        # Здогад про постійність уперше перечитуємо за 30 днів, підтверджений —
        # за 90; далі ритм підлаштовується під те, чи змінюється сторінка.
        assumed = patch.get("timing_assumed", row.get("timing_assumed"))
        if kind == "permanent" and not fresh:
            days = _adaptive_days(row, fingerprint, bool(assumed))
            patch["recheck_at"] = (today + timedelta(days=days)).isoformat()
            if fingerprint:
                patch["page_hash"] = fingerprint
                patch["check_interval_days"] = days
        else:
            patch["recheck_at"] = None
        note = (f"новий сезон, але бракує: {', '.join(missing)} — у чергу людині: {quote}"
                if missing else f"відкрито: {quote}")
    elif state == "upcoming":
        patch.update({"status": "closed", **fresh,
                      "recheck_at": (today + timedelta(days=RETRY_DAYS)).isoformat()})
        note = f"новий сезон оголошено, подача ще не відкрита: {quote}"
    elif state == "ended":
        dates = [row.get("deadline"), row.get("event_start_date"), row.get("event_end_date")]
        recheck = recheck_after_close(kind, months, dates, today)
        patch.update({"status": "closed",
                      "recheck_at": recheck.isoformat() if recheck else None})
        note = f"сезон завершено: {quote}"
    else:
        # unclear, або «open» без жодної майбутньої дати в цитаті.
        days = UNKNOWN_RECHECK_DAYS if row.get("status") == "active" else RETRY_DAYS
        recheck = today + timedelta(days=days)
        review = (row.get("status") == "closed" and state == "open"
                  and just_closed(row, today, REVIEW_AFTER_CLOSE_DAYS))
        if review:
            # Сторінка каже «набір триває», а нової дати не дає. Так буває з
            # постійними програмами, що закрились через одну дату (вистави,
            # заняття з вільним записом): мовчки лишити закритим — загубити
            # живе, відкрити без дати — вигадати. Тому — людині в чергу
            # (Марія, 07.10.2026: «так»; разова перевірка 37 закритих знайшла
            # 15 таких).
            recheck = None
            patch["status"] = "draft"
        elif row.get("status") == "closed" and just_closed(row, today):
            # Перевірка-підтвердження після закриття за датою (plan_close) не
            # знайшла подовження — далі як до неї: одноразова більше не
            # перевіряється, періодична — перед наступним сезоном. Інакше
            # кожен закритий запис із незрозумілою сторінкою крутився б раз на
            # 2 тижні назавжди.
            dates = [row.get("deadline"), row.get("event_start_date"), row.get("event_end_date")]
            recheck = recheck_after_close(kind, months, dates, today)
        patch["recheck_at"] = recheck.isoformat() if recheck else None
        if review:
            note = f"після закриття сторінка каже, що набір триває, а нової дати немає — перевір: {quote}"
        elif recheck:
            note = f"стан не зрозумілий, ще раз {patch['recheck_at']}: {quote}"
        else:
            note = f"стан не зрозумілий, подовження не видно — більше не перевіряємо: {quote}"

    # Дата змістової перевірки — окремо від пінга лінка (last_verified_at):
    # на сторінці можливості «Перевірено» має означати, що хтось справді читав
    # сторінку, а не що адреса відповіла кодом 200.
    patch["content_checked_at"] = datetime.now(timezone.utc).isoformat()
    patch["admin_comment"] = _with_trace(row, f"lifecycle {iso_today}: {note}"[:240])
    return patch


def _verdict(row: dict, patch: dict, state: str, **extra) -> dict:
    """Що знає про запис публікатор у Telegram (scripts/verify-before-post.mjs).

    Крім стану, віддаємо вид у часі й чи є в записі хоч якась дата: вічній
    платформі («Khan Academy», «CS50») нема чого «відкривати», і стан «не
    зрозуміло» для неї не те саме, що для табору з датами.
    """
    dates = ("deadline", "event_start_date", "event_end_date")
    return {
        "state": state,
        "status": patch.get("status", row.get("status")),
        "kind": patch.get("timing_kind", row.get("timing_kind")),
        "assumed": bool(patch.get("timing_assumed", row.get("timing_assumed"))),
        "has_dates": any(patch.get(k, row.get(k)) for k in dates),
        **extra,
    }


# Слова, якими сторінка сама каже, що набір чи подія позаду. Без них «сезон
# завершено» при майбутній даті в записі — суперечність, а не факт.
_CLOSED_WORDS = re.compile(
    r"заверш|закінч|закрит|припинен|скасован|відбул|пройш|минул|архів|"
    r"closed|ended|finished|cancel|over\b|no longer",
    re.IGNORECASE)


UNREADABLE_MARK = "джерело не прочиталось"
MANUAL_MARK = "сайт не пускає автоматичну перевірку"


def plan_unreadable(row: dict, why: str, today: date) -> dict:
    """Джерело не відкрилось. Чиста функція — під тести.

    Частина сайтів (mon.gov.ua, plast.org.ua, usaco.org) відповідає серверам
    GitHub 403, хоча з браузера відкривається. Перший раз — пробуємо ще через
    два тижні. Повторно — позначка людині «перевір вручну» (один раз) і
    перевірка раз на місяць: спроба без тексту не викликає модель, тож
    нічого не коштує, а раптом сайт почне пускати.
    """
    comment = row.get("admin_comment") or ""
    iso = today.isoformat()
    if UNREADABLE_MARK not in comment and MANUAL_MARK not in comment:
        retry = (today + timedelta(days=RETRY_DAYS)).isoformat()
        note = f"lifecycle {iso}: {UNREADABLE_MARK} ({why}), ще раз {retry}"
    else:
        retry = (today + timedelta(days=UNKNOWN_RECHECK_DAYS)).isoformat()
        note = (f"lifecycle {iso}: ⚠️ {MANUAL_MARK} ({why}) — перевір вручну"
                if MANUAL_MARK not in comment else None)
    patch = {"recheck_at": retry}
    if note:
        patch["admin_comment"] = _with_trace(row, note)
    return patch


# Дата в тексті: «20 жовтня», «1–15 листопада», «20.10.2026», «October 20».
# Числа без року («2.5.») не беремо: так нумеруються пункти положень.
_DATE_HINT = re.compile(
    r"\b\d{1,2}[./]\d{1,2}[./](?:20)?\d{2}\b"
    r"|\b\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s+(?:січн|лют|берез|квітн|трав|червн|липн|серпн"
    r"|вересн|жовтн|листопад|грудн)\w*"
    r"|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b",
    re.IGNORECASE)
FOCUS_WINDOW = 220


def focus_text(text: str, limit: int = PAGE_CHARS) -> str:
    """Що віддати моделі з довгої сторінки. Чиста функція — під тести.

    Перші 9 000 символів положення — це часто лише «Загальні засади». У
    Sikorsky Challenge (07.10.2026) строк «до 20 жовтня» стояв на 9 960-му
    символі: перевірка бачила конкурс відкритим, але без жодної дати, і не
    могла повернути його на сайт. Тому з довгої сторінки — початок і всі
    місця з датами далі, у тому ж порядку."""
    if len(text) <= limit:
        return text
    head_len = limit * 2 // 3
    head, rest = text[:head_len], text[head_len:]
    spans: list[list[int]] = []
    for m in _DATE_HINT.finditer(rest):
        a, b = max(0, m.start() - FOCUS_WINDOW), min(len(rest), m.end() + FOCUS_WINDOW)
        if spans and a <= spans[-1][1]:
            spans[-1][1] = max(spans[-1][1], b)
        else:
            spans.append([a, b])
    parts, room = [], limit - head_len
    for a, b in spans:
        piece = rest[a:b]
        if len(piece) + 3 > room:
            break
        parts.append(piece)
        room -= len(piece) + 3
    if not parts:
        return text[:limit]
    return head + "".join(" … " + p for p in parts)


def _source_text(row: dict) -> tuple[str | None, str]:
    url = (row.get("source_url") or "").strip()
    if _TG_POST.match(url):
        text = telegram_text(url)
        if text:
            return text, "telegram"
    if not url.startswith("http"):
        return None, "немає адреси"
    time.sleep(DELAY)
    text, why, kind = fetch_text(url, limit=FETCH_CHARS)
    return (text, "сторінка") if kind == "ok" else (None, why)


def _ask(ai, row: dict, page: str, today: date) -> dict:
    for attempt in range(3):
        try:
            resp = ai.messages.create(
                model=MODEL, max_tokens=900,
                system=SYSTEM.format(today=today.isoformat()),
                tools=[TOOL], tool_choice={"type": "tool", "name": "check_season"},
                messages=[{"role": "user", "content":
                           f"Можливість: «{row.get('title')}» (тип: {row.get('opportunity_type')})\n"
                           f"Адреса: {row.get('source_url')}\n\n"
                           f"Текст джерела:\n{focus_text(clean_text(page))}"}],
            )
            SPEND.add(MODEL, resp)
            block = next((b for b in resp.content if b.type == "tool_use"), None)
            return block.input if block else {}
        except anthropic.APIStatusError as e:
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


# ── C. Перший розклад ───────────────────────────────────────────────────────

def plan_bootstrap(row: dict, today: date) -> str | None:
    """Перша дата перевірки для запису без неї. Чиста функція — під тести."""
    if row.get("recheck_at"):
        return None
    kind = row.get("timing_kind")
    has_dates = any(row.get(k) for k in ("deadline", "event_start_date", "event_end_date"))
    if row.get("status") == "active":
        if kind == "permanent":
            return spread_date(row["id"], today, permanent_recheck_days(row)).isoformat()
        if not has_dates:
            # Без дати запис не закриється сам — подивитись на джерело протягом місяця.
            return spread_date(row["id"], today, UNKNOWN_RECHECK_DAYS).isoformat()
        return None                     # з датою — закриття за датою все зробить
    if row.get("status") == "closed" and kind == "periodic":
        months = row.get("season_months")
        if months:
            return next_season_check(months, [], today).isoformat()
        # Сезон невідомий (так у Всеукраїнських олімпіад) — протягом трьох тижнів.
        return spread_date(row["id"], today, 21).isoformat()
    return None


# ── Прогін ─────────────────────────────────────────────────────────────────

def _load(db, build) -> list[dict]:
    rows, start = [], 0
    while True:
        page = build().order("id").range(start, start + 999).execute().data or []
        rows.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    return rows


def main() -> int:
    # Витрати пишемо в finally: _ask кидає на неповторюваній помилці API, і
    # вже зроблені до того виклики теж мають потрапити в llm_usage.
    try:
        return _main()
    finally:
        SPEND.record()


def _main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    default=os.environ.get("DRY_RUN", "").lower() == "true")
    # Лишений для сумісності з воркфлоу: блок C тепер бігає щодня сам.
    ap.add_argument("--bootstrap", action="store_true",
                    default=os.environ.get("BOOTSTRAP", "").lower() == "true",
                    help="нічого не змінює: розклад для записів без дати ставиться щодня")
    ap.add_argument("--limit", type=int, default=DAILY_LIMIT)
    # Перевірка на вимогу: рівно ці записи, хай коли стоїть їхня планова дата.
    # Так публікатор у Telegram питає про ті кілька можливостей, які збирається
    # надіслати: 20.09.2026 у канал пішла «Літня ІТ-школа», бо перевірка лінка
    # бачила 200, а сторінка джерела вже була про інше.
    ap.add_argument("--ids", default=os.environ.get("LIFECYCLE_IDS", ""),
                    help="id через кому — перевірити саме їх, поза розкладом")
    ap.add_argument("--json-out", default=os.environ.get("LIFECYCLE_JSON_OUT", ""),
                    help="куди записати підсумок перевірки у форматі JSON")
    args = ap.parse_args()
    only_ids = [i.strip() for i in (args.ids or "").split(",") if i.strip()]
    today = date.today()
    db = get_client()
    dry = " (СУХИЙ ПРОГІН)" if args.dry_run else ""
    # «У базу нічого не записано» — і витрат теж: сухий прогін пише їх лише в лог.
    SPEND.dry = args.dry_run

    # Записи зі «Звернень» не чіпаємо взагалі, навіть дедлайном (Марія,
    # 11.10.2026) — див. requests_guard.py.
    protected = protected_ids(db)

    def write(row_id, patch):
        if row_id in protected:
            logger.info("  🔒 %s — зі звернень, не чіпаю", row_id)
            return
        if not args.dry_run:
            db.table("opportunities").update(patch).eq("id", row_id).execute()

    iso = today.isoformat()
    verdicts: dict[str, dict] = {}

    # A ────────────────────────────────────────────────────────────────────
    expired = [] if only_ids else _load(db, lambda: db.table("opportunities").select(SELECT)
                    .eq("status", "active").is_("canonical_slug", "null")
                    .or_(f"deadline.lt.{iso},event_end_date.lt.{iso},event_start_date.lt.{iso},"
                         f"results_date.lt.{iso}"))
    closed = Counter()
    logger.info("%s\nA. Закриття за датою%s", "=" * 70, dry)
    for row in expired:
        patch = plan_close(row, today)
        if not patch:
            continue
        closed[row.get("timing_kind") or "—"] += 1
        logger.info("  ✕ %s · %s · перевірка %s", (row["title"] or "")[:60],
                    LABELS.get(row.get("timing_kind"), "вид невідомий"), patch["recheck_at"] or "—")
        write(row["id"], patch)
    logger.info("  закрито: %d %s", sum(closed.values()), dict(closed))

    # C ────────────────────────────────────────────────────────────────────
    # Інваріант (20.09.2026): активний запис мусить мати або майбутню дату,
    # якою закриється сам, або дату планової перевірки. Інакше він не протухне
    # ніколи — просто висітиме, поки хтось випадково не гляне.
    #
    # Раніше цей блок бігав лише вручну (BOOTSTRAP=true), тож кожен новий шлях
    # — агент, пропозиція з форми, ручне додавання — міг лишити запис без
    # жодної дати. Ревізія 20.09.2026 знайшла такий один («Гуртки Вінницького
    # палацу»): мало, але це лише питання часу. Прохід дешевий — один запит до
    # бази, без мережі й без моделі, — тож робимо його щодня.
    if not only_ids:
        rows = _load(db, lambda: db.table("opportunities").select(SELECT)
                     .in_("status", ["active", "closed"]).is_("canonical_slug", "null")
                     .is_("recheck_at", "null"))
        plan = Counter()
        by_day = Counter()
        logger.info("\nC. Записи без планової перевірки%s", dry)
        for row in rows:
            when = plan_bootstrap(row, today)
            if not when:
                continue
            plan[(row["status"], row.get("timing_kind") or "—")] += 1
            by_day[when] += 1
            write(row["id"], {"recheck_at": when})
        for (status, kind), n in sorted(plan.items()):
            logger.info("  %-7s %-10s %4d", status, kind, n)
        busiest = by_day.most_common(1)
        logger.info("  разом %d, найбільше за день: %s", sum(plan.values()),
                    busiest[0] if busiest else "—")

    # B ────────────────────────────────────────────────────────────────────
    if only_ids:
        due = (db.table("opportunities").select(SELECT)
               .in_("id", only_ids).execute().data or [])
        logger.info("\nB. Перевірка перед публікацією: %d записів%s", len(due), dry)
    else:
        due = (db.table("opportunities").select(SELECT)
               .in_("status", ["active", "closed"]).is_("canonical_slug", "null")
               .lte("recheck_at", iso).order("recheck_at").limit(args.limit)
               .execute().data or [])
        logger.info("\nB. Планова перевірка: %d записів на сьогодні (ліміт %d)%s",
                    len(due), args.limit, dry)
        spare = args.limit - len(due)
        if spare > 0:
            never = (db.table("opportunities").select(SELECT)
                     .eq("status", "active").is_("canonical_slug", "null")
                     .is_("content_checked_at", "null").gt("recheck_at", iso)
                     .order("recheck_at").limit(spare * 3).execute().data or [])
            extra = pick_spare(never, {r["id"] for r in due}, spare)
            if extra:
                logger.info("   + %d ще жодного разу не перечитаних (вільні місця ліміту)", len(extra))
                due += extra
    if due:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            logger.error("Немає ANTHROPIC_API_KEY")
            return 1
        ai = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
        states = Counter()
        manual = []
        for row in due:
            page, whence = _source_text(row)
            if not page:
                patch = plan_unreadable(row, whence, today)
                states["без тексту"] += 1
                if MANUAL_MARK in patch.get("admin_comment", ""):
                    manual.append(row)
                logger.info("  ? %s — %s, ще раз %s", (row["title"] or "")[:60], whence,
                            patch["recheck_at"])
                write(row["id"], patch)
                verdicts[row["id"]] = _verdict(row, patch, "unreadable", why=whence)
                continue
            fingerprint = page_fingerprint(page)
            if unchanged_open(row, fingerprint):
                # Той самий текст, на якому минула перевірка з цитатою сказала
                # «відкрито», — вердикт той самий, модель не кличемо.
                patch = plan_unchanged(row, today)
                states["без змін"] += 1
                logger.info("  = %s — сторінка без змін, наступна %s", (row["title"] or "")[:60],
                            patch["recheck_at"])
                write(row["id"], patch)
                verdicts[row["id"]] = _verdict(row, patch, "open",
                                               evidence="сторінка без змін з минулої перевірки")
                continue
            out = _ask(ai, row, page, today)
            patch = decide_check(row, out, page, today, fingerprint)
            states[out.get("state") or "unclear"] += 1
            changes = {k: v for k, v in patch.items() if k != "admin_comment"}
            logger.info("  • %s [%s → %s] %s", (row["title"] or "")[:55], row["status"],
                        out.get("state"), changes)
            write(row["id"], patch)
            verdicts[row["id"]] = _verdict(
                row, patch,
                out.get("state") if out.get("state") in STATES else "unclear",
                evidence=(out.get("evidence") or "")[:200])
        logger.info("  підсумок: %s", dict(states))
        if manual:
            logger.info("\n  ⚠️ Перевірити вручну — сайт не пускає автоматичну перевірку:")
            for r in manual:
                logger.info("    • %s — %s", (r["title"] or "")[:70], r.get("source_url"))

    if args.json_out:
        # Публікатор читає саме цей файл: запис без вердикту «open» у канал не йде.
        Path(args.json_out).write_text(json.dumps(verdicts, ensure_ascii=False),
                                       encoding="utf-8")
        logger.info("Вердикти записано: %s (%d)", args.json_out, len(verdicts))

    if args.dry_run:
        logger.info("\nСУХИЙ ПРОГІН — у базу нічого не записано.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
