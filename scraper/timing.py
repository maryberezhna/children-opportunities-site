"""Вид можливості за часом: одноразова, періодична, постійна.

Рішення Марії 17.09.2026 (аудит «Дедлайн, подія, сезон»):
  one_time  — вебінар, когортний курс («UF Startup School 2026»), конкретний конкурс;
  periodic  — олімпіада, стипендія, щорічний конкурс, щорічна літня школа,
              гурток із набором у вересні;
  permanent — виплата, допомога, гурток із постійним набором, платформи з
              вільним записом (Coursera, Prometheus, Дія.Освіта).

Тут лише детерміновані правила — те, що можна сказати без моделі й без
жодного токена. Решту вирішує модель за текстом (classify_timing.py,
normalizer.py). Модуль чистий: без бази й мережі, тож повністю під тестами.
"""
from __future__ import annotations

import re

KINDS = ("one_time", "periodic", "permanent")

LABELS = {"one_time": "одноразова", "periodic": "періодична", "permanent": "постійна"}

# Платформи, куди записуються будь-коли й навчаються у власному темпі.
PLATFORM_SOURCES = {"Coursera", "Prometheus", "Дія.Освіта"}

# Виплати й допомога: прийом документів не має сезону, якщо в записі немає строку.
AID_TYPES = {"allowance", "support_payment", "humanitarian", "medical_aid",
             "legal_aid", "shelter"}

# Слід масової дії 11.09.2026: recurrence='ongoing' проставлено за типом, а не
# прочитано з тексту. Такому значенню не віримо.
TYPE_STAMP = "за типом"

# Скрапери гуртків (gurtok, shkolyar, cprs_kyiv, palats_dp, firstpalace_kharkiv,
# gordiy_zp, ocnttum_if, pum_lutsk) самі дописують цю фразу в сирий текст.
# Вона потрапляє в опис і виглядає як факт зі сторінки — хоча це не так.
_INJECTED = re.compile(r"набір\s+постійний,?\s*дедлайну\s+немає\.?", re.IGNORECASE)

# Джерела, скрапери яких дописують «набір постійний» самі. Опис таких записів
# написаний моделлю за цим текстом, тож фраза живе в ньому у різних варіантах
# («Набір постійний», «набір постійний, умови уточнюються…»). Сухий прогін
# 17.09.2026: «Літні мовні курси» отримали «постійна» з доказом «Набір
# постійний» — словами збирача, а не джерела.
_INJECTING_SOURCES = ("gurtok.org", "shkolyar", "cprs.kiev", "palats", "firstpalace",
                      "gordiy", "ocnttum", "pum.lutsk", "pum_lutsk")

# Ознака повторення циклами: без неї «періодична» — вгадування з типу.
_REPEATS = re.compile(
    r"щороку|щорічн|кожного\s+року|традиційн|черговий|новий\s+сезон"
    r"|\b[IVXLCІХ]{1,7}\s+(?:всеукраїнськ|міжнародн|регіональн|обласн|міськ|відкрит)"
    r"|\b\d{1,2}-?(?:й|ий|ій)\s+(?:всеукраїнськ|міжнародн|регіональн|обласн|сезон)"
    r"|навчальн\w*\s+р(?:ік|оку)|annual|every\s+year|each\s+year|yearly",
    re.IGNORECASE,
)

# Олімпіаду Марія прямо назвала періодичною (17.09.2026).
PERIODIC_BY_DEFINITION = {"olympiad"}

# Ознаки сезонного набору в гуртка: «набір у вересні», «з початку навчального року».
_SEASONAL_ENROLLMENT = re.compile(
    r"(?:набір|запис)[^.]{0,40}(?:вересн|серпн|жовтн)"
    r"|(?:\bу|\bз)\s+вересн"
    r"|навчальн\w*\s+р(?:ік|оку)",
    re.IGNORECASE,
)


def from_injecting_source(row: dict) -> bool:
    where = f"{row.get('source') or ''} {row.get('source_url') or ''}".lower()
    return any(k in where for k in _INJECTING_SOURCES)


def clean_text(*parts, drop_permanent_claims: bool = False) -> str:
    """Текст запису без фраз, які дописав скрапер, а не джерело.

    drop_permanent_claims — для джерел, чиї скрапери дописують «набір
    постійний»: викидаємо кожне речення зі словом «постійн», бо в описі воно
    переказує слова збирача.
    """
    text = " ".join(p for p in parts if p)
    text = _INJECTED.sub(" ", text)
    if drop_permanent_claims:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        text = " ".join(s for s in sentences if not re.search(r"постійн", s, re.IGNORECASE))
    return re.sub(r"\s+", " ", text).strip()


def has_repeat_signal(text: str) -> bool:
    return bool(_REPEATS.search(text or ""))


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[«»\"“”„'’ʼ`]", "", s)
    s = re.sub(r"[–—−]", "-", s)
    return re.sub(r"\s+", " ", s).strip()


def evidence_in_text(evidence: str, text: str) -> bool:
    """Доказ — справжня цитата з тексту або дати із самого запису.

    Модель інколи замість цитати пише міркування («олімпіада як формат
    зазвичай щорічна») — це вгадування з типу, і такий висновок не приймаємо.
    """
    ev = _norm(evidence)
    if ev.startswith("дати в записі"):
        return True
    hay = _norm(text)
    for frag in re.split(r"[;…]|\.\.\.|\s-\s", ev):
        frag = frag.strip(" .,:")
        if len(frag) >= 12 and frag[:40] in hay:
            return True
    return False


def accept_model_kind(row: dict, kind: str, evidence: str, text: str) -> bool:
    """Чи приймаємо вид, який назвала модель. Чиста функція — під тести."""
    if kind not in KINDS or not evidence_in_text(evidence, text):
        return False
    if kind == "periodic":
        return (row.get("opportunity_type") in PERIODIC_BY_DEFINITION
                or has_repeat_signal(text) or has_repeat_signal(evidence))
    if kind == "one_time":
        # Щорічна програма теж має дати — дат самих по собі мало, якщо текст
        # прямо каже, що це повторюється.
        return not has_repeat_signal(text)
    if kind == "permanent":
        # «постійна» лише з цитати, не з дат.
        return not _norm(evidence).startswith("дати в записі")
    return False


def recurrence_from_text(row: dict) -> str | None:
    """recurrence, якому можна вірити: не проставлений масово за типом."""
    if TYPE_STAMP in (row.get("admin_comment") or ""):
        return None
    rec = row.get("recurrence")
    return rec if rec in ("annual", "ongoing") else None


def months_from_dates(row: dict) -> list[int]:
    """Місяці з дат, які вже є в записі (дедлайн, початок і кінець події)."""
    months = set()
    for key in ("deadline", "event_start_date", "event_end_date"):
        m = re.match(r"^\d{4}-(\d{2})-\d{2}", str(row.get(key) or ""))
        if m:
            months.add(int(m.group(1)))
    return sorted(months)


def clean_months(value) -> list[int] | None:
    """Місяці 1–12 без повторів, за зростанням; порожньо → None."""
    if not isinstance(value, (list, tuple)):
        return None
    out = set()
    for v in value:
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 12:
            out.add(n)
    return sorted(out) or None


def clean_kind(value) -> str | None:
    return value if value in KINDS else None


def rule_kind(row: dict) -> tuple[str, list[int] | None, str] | None:
    """Вид за правилами, без моделі. None — правила не вирішують, питати модель.

    Повертає (вид, місяці сезону, пояснення для модератора).
    """
    kind_hint = row.get("opportunity_type")
    text = clean_text(row.get("summary"), row.get("details"))
    has_dates = any(row.get(k) for k in ("deadline", "event_start_date", "event_end_date"))

    if kind_hint in PERIODIC_BY_DEFINITION:
        return ("periodic", (months_from_dates(row) or None),
                "олімпіада — періодична за визначенням (рішення 17.09.2026)")

    if row.get("source") in PLATFORM_SOURCES:
        return "permanent", None, "платформа з вільним записом (рішення 17.09.2026)"

    if kind_hint == "club":
        if _SEASONAL_ENROLLMENT.search(text):
            return None  # текст каже про сезон набору — хай вирішує модель
        return ("permanent", None,
                "гурток: текст не каже про сезон набору — постійний за "
                "замовчуванням (рішення 17.09.2026), перевірити")

    if kind_hint in AID_TYPES and not has_dates:
        return "permanent", None, "виплата чи допомога без строку в записі"

    if recurrence_from_text(row) == "annual":
        return "periodic", (months_from_dates(row) or None), "у тексті — повторюється щороку"

    return None


# ── Час життя запису (планова перевірка, scraper/lifecycle.py) ──────────────
# Принцип Марії 17.09.2026: «ціль не скрапити нон-стоп, а мати базу і
# періодично її продивлятися». У кожного запису — дата наступної перевірки,
# що залежить від виду; щоденний процес бере лише ті, чия дата настала.

from datetime import date as _date, timedelta as _timedelta  # noqa: E402
import hashlib as _hashlib  # noqa: E402

PERMANENT_RECHECK_DAYS = 120     # постійна: переконатись, що сторінка жива й набір той самий
ASSUMED_RECHECK_DAYS = 30        # «постійна» за замовчуванням — це здогад, а не факт
UNKNOWN_RECHECK_DAYS = 30        # вид невідомий: подивитись на джерело найближчим часом
RETRY_DAYS = 14                  # сторінка не відкрилась / сезон ще не відкрито


def permanent_recheck_days(row: dict) -> int:
    """За скільки днів перечитати постійний запис.

    120 днів — для тих, де постійність прочитана в тексті. Для здогаду
    (timing_assumed) — 30: саме такі записи й живуть на сайті вічно, бо
    «завершитись» їм нема як. 610 гуртків станом на 20.09.2026 тримаються
    рівно на цьому припущенні.
    """
    return ASSUMED_RECHECK_DAYS if row.get("timing_assumed") else PERMANENT_RECHECK_DAYS


def _iso(value) -> _date | None:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(value or ""))
    if not m:
        return None
    try:
        return _date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def is_expired(row: dict, today: _date) -> bool:
    """Чи минула можливість: подати вже не можна або подія вже відбулась.

    Дата початку закриває запис лише тоді, коли ні дедлайну, ні кінця події
    немає: запис лише з початком раніше не закривався ніколи (аудит, С4).
    """
    deadline = _iso(row.get("deadline"))
    end = _iso(row.get("event_end_date"))
    start = _iso(row.get("event_start_date"))
    results = _iso(row.get("results_date"))
    if deadline and deadline < today:
        return True
    if end and end < today:
        return True
    if not deadline and not end and start and start < today:
        return True
    # Лише дата результатів (розіграш, оголошення переможців): після неї подати
    # вже точно не можна.
    if not deadline and not end and not start and results and results < today:
        return True
    return False


def season_start_month(months) -> int | None:
    """Перший місяць сезону з урахуванням переходу через Новий рік.

    [9, 10, 11, 12, 1, 2, 3, 4, 5] (навчальний рік) → 9, а не 1: початок
    циклу — місяць одразу після найбільшої перерви.
    """
    months = clean_months(months)
    if not months or len(months) == 12:
        return None
    best_gap, start = -1, months[0]
    for i, m in enumerate(months):
        prev = months[i - 1]
        gap = (m - prev - 1) % 12
        if gap > best_gap:
            best_gap, start = gap, m
    return start


def next_season_check(season_months, dates, today: _date,
                      skip_current: bool = False) -> _date:
    """Коли періодичну програму варто перевірити наступного разу.

    skip_current=False — сезон, що попереду або йде просто зараз, теж рахується:
    олімпіада з сезоном у жовтні 17 вересня перевіряється вже скоро, а не у
    вересні наступного року. skip_current=True — сезон щойно завершився
    (запис закрився за датою або сторінка каже «завершено»), тож чекаємо
    наступного циклу.

    Є місяці сезону → 1-ше число місяця перед його початком. Немає, але є
    остання відома дата → та сама пора наступного циклу мінус два місяці.
    Нічого немає → за UNKNOWN_RECHECK_DAYS днів.
    """
    soon = today + _timedelta(days=3)
    start = season_start_month(season_months)
    if start:
        running = today.month in (clean_months(season_months) or [])
        if running and not skip_current:
            return soon
        # Щойно завершений сезон не може початись знову за кілька тижнів:
        # якщо дедлайн вересневий, а подія жовтнева, жовтень цього року — той
        # самий цикл. Наступний — не раніше ніж за три місяці.
        horizon = today + _timedelta(days=90) if skip_current else today
        season = _date(today.year, start, 1)
        while season <= horizon:
            season = _date(season.year + 1, start, 1)
        check = (_date(season.year, start - 1, 1) if start > 1
                 else _date(season.year - 1, 12, 1))
        return check if check > today else soon
    known = [d for d in (_iso(x) for x in (dates or [])) if d]
    if known:
        anchor = max(known) - _timedelta(days=60)
        while anchor <= today:
            try:
                anchor = anchor.replace(year=anchor.year + 1)
            except ValueError:            # 29 лютого
                anchor = anchor.replace(year=anchor.year + 1, day=28)
        return anchor
    return today + _timedelta(days=UNKNOWN_RECHECK_DAYS)


def recheck_after_close(kind, season_months, dates, today: _date) -> _date | None:
    """Дата перевірки для запису, що щойно закрився за датою."""
    if kind == "one_time":
        return None                                   # не повториться
    if kind == "periodic":
        return next_season_check(season_months, dates, today, skip_current=True)
    if kind == "permanent":
        # Постійна з датою, що минула, — суперечність: подивитись скоро.
        return today + _timedelta(days=7)
    return today + _timedelta(days=UNKNOWN_RECHECK_DAYS)


def spread_date(row_id, today: _date, within_days: int) -> _date:
    """Детерміновано розкладає перші перевірки по днях, без піку в один день."""
    h = int(_hashlib.md5(str(row_id).encode()).hexdigest()[:8], 16)
    return today + _timedelta(days=1 + h % max(within_days, 1))
