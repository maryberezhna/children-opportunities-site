"""deficit.py — куди дивитись агенту-розвіднику: попит ÷ надходження.

Навіщо (рішення Марії 23.09.2026: «якщо буде низький показник — то ми будемо
шукати так»). Досі розвідник брав слово дня сліпою ротацією по
keywords.DISCOVER_KEYWORDS: черга не знала ні того, чого шукають родини, ні
того, що вже й так приходить саме. Заміряно 23.09.2026:

  ПОПИТ (перегляди сторінок-підбірок у GA4 за 28 днів):
    обміни    /prohramy-obminu 638 + /za-kordon 49            = 687
    конкурси  /konkursy 429 + /mizhnarodni-olimpiady 137      = 566
    табори    /bezkoshtovni-tabory 179                        = 179
    захисники /dity-zakhysnykiv 137                           = 137
    гуртки    /bezkoshtovni-hurtky 136                        = 136

  НАДХОДЖЕННЯ (нових активних записів на тиждень, 8 тижнів, жива база):
    гуртки й курси           27,6
    виплати й підтримка       3,8
    обміни, стипендії, гранти 2,9
    конкурси й олімпіади      1,6
    табори й літні школи      1,4

Тобто найбільше хочуть конкурсів і обмінів, а приходять переважно гуртки.
Клітинка з найбільшим дефіцитом і стає темою дня.

КЛІТИНКА — це родина типів × віковий діапазон, і ніколи не місто. Пряме
правило Марії (22.09.2026): «ми не гарантуємо можливостей саме з міста»,
«ти думаєш ми можемо покрити 1000 міст». Тому в надходження клітинки
рахуються ЛИШЕ записи, що доходять до всіх: онлайн/гібрид, «Вся Україна»,
міжнародні або закордонні. Запис, привʼязаний до конкретного міста, доходить
лише до свого міста — він не закриває дефіцит країни.

ДЕФІЦИТ = попит ÷ (надходження + 1). Одиниця в знаменнику — щоб порожня
клітинка (0 надходжень) не давала ділення на нуль і не вигравала нескінченно
в тієї, куди щось таки приходить.

ЗАПОБІЖНИКИ (кожен лише ЗНИЖУЄ пріоритет, жоден не піднімає):
  а) вісь пошуку — вік і тема, ніколи місто (див. вище);
  б) клітинка, де вже шукали й нічого не дійшло до бази, ділиться на число
     марних спроб; клітинка, де шукали днями, чекає своєї черги — інакше
     агент щодня довбав би те саме;
  в) клітинка з нульовим попитом не шукається взагалі, хай яка порожня:
     витрачати на неї день означає не витратити його на те, чого хочуть.

Памʼять прогонів — таблиця discover_deficit_runs (міграція
supabase/migrations/20260923_discover_deficit.sql). Без таблиці модуль працює,
просто без штрафу за марні спроби.

Запуск у воркфлоу: `python deficit.py >> "$GITHUB_ENV"` — друкує DISCOVER_*
для наступного кроку. `python deficit.py --print` — таблиця для людини.
"""
from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from plus_profile import AGE_RANGES, FORMAT_TYPES

logger = logging.getLogger(__name__)

# Родини типів і вікові діапазони беремо з plus_profile.py — ті самі, що й у
# профілі Dityam+. Інакше «дефіцит» і «що ми пропонуємо родині» рахувались би
# різними лінійками, і жодну цифру не можна було б звірити з іншою.
FAMILIES: tuple[str, ...] = tuple(FORMAT_TYPES)
BANDS: tuple[str, ...] = tuple(AGE_RANGES)

TYPE_TO_FAMILY: dict[str, str] = {
    t: family for family, types in FORMAT_TYPES.items() for t in types
}

# ── Попит ───────────────────────────────────────────────────────────────────
#
# ОДНЕ МІСЦЕ, де це оновлюється, і дата поруч. Джерело — GA4, перегляди
# сторінок за 28 днів. Щоб оновити: взяти свіжі перегляди тих самих сторінок,
# замінити числа й поставити нову дату в DEMAND_MEASURED_ON.
DEMAND_MEASURED_ON = date(2026, 9, 23)
DEMAND_WINDOW_DAYS = 28
DEMAND_SOURCE = "GA4, перегляди сторінок-підбірок за 28 днів"

# (сторінка, родина, перегляди). Список, а не словник: /dity-zakhysnykiv
# віддає свої перегляди двом родинам.
#
# /dity-zakhysnykiv (137) — сторінка не про формат, а про авдиторію: там і
# виплати громад, і психологічна підтримка, і табори, і стипендії. Розбивки
# всередині сторінки GA4 не дає, а вигадувати її не будемо. Табори й
# стипендії свої сторінки вже мають, тож ці перегляди ділимо порівну між
# двома родинами, які власної сторінки не мають узагалі: support і family_aid.
#
# volunteering у списку немає свідомо: сторінки під волонтерство й стажування
# на сайті немає, тож попит на нього не виміряний. Невиміряний попит — це нуль,
# а не здогад: клітинка з нулем не шукається (запобіжник «в»), поки не буде
# чим його заповнити. Нічого не вигадуємо.
DEMAND_PAGEVIEWS: tuple[tuple[str, str, float], ...] = (
    ("/prohramy-obminu", "grants", 638),
    ("/za-kordon", "grants", 49),
    ("/konkursy", "contests", 429),
    ("/mizhnarodni-olimpiady", "contests", 137),
    ("/bezkoshtovni-tabory", "camps", 179),
    ("/bezkoshtovni-hurtky", "clubs", 136),
    ("/dity-zakhysnykiv", "support", 68.5),
    ("/dity-zakhysnykiv", "family_aid", 68.5),
)


def _demand_by_family() -> dict[str, float]:
    out = {f: 0.0 for f in FAMILIES}
    for _page, family, views in DEMAND_PAGEVIEWS:
        out[family] = out.get(family, 0.0) + float(views)
    return out


DEMAND: dict[str, float] = _demand_by_family()


def demand_of(family: str, band: str) -> float:
    """Попит клітинки.

    Вік розподіляємо РІВНОМІРНО між пʼятьма діапазонами, і це чесно найслабше
    місце розрахунку: GA4 не знає, скільки років дитині того, хто відкрив
    /konkursy, а власних даних про вік у нас немає — 23.09.2026 у
    plus_children і digest_subscribers жодного заповненого age_bands. Щойно
    вони зʼявляться, міняти треба саме цю функцію, а не решту модуля.
    """
    if band not in AGE_RANGES:
        return 0.0
    return DEMAND.get(family, 0.0) / len(BANDS)


# ── Надходження ─────────────────────────────────────────────────────────────
INTAKE_WEEKS = 8

# «Доходить до всіх» — те саме, що бачить кожна родина в Dityam+ незалежно від
# міста (plus_profile.place_ok з 22.09.2026): онлайн, «Вся Україна», міжнародне
# й закордонне. Місто в cities без цих ознак означає, що запис доходить лише
# до свого міста.
NATIONWIDE = "Вся Україна"
ONLINE_CITY = "Онлайн"
INTERNATIONAL_CITY = "Міжнародні"


def family_of(opportunity_type: str | None) -> str | None:
    return TYPE_TO_FAMILY.get(opportunity_type or "")


def bands_of(age_from, age_to) -> list[str]:
    """Усі діапазони, які перекриває запис. Програма 6–14 належить і «4-6»,
    і «7-10», і «11-14»: дитина будь-якого з цих віків нею скористається."""
    try:
        lo = int(age_from) if age_from is not None else 0
    except (TypeError, ValueError):
        lo = 0
    try:
        hi = int(age_to) if age_to is not None else 18
    except (TypeError, ValueError):
        hi = 18
    if lo > hi:
        lo, hi = 0, 18
    return [b for b in BANDS if lo <= AGE_RANGES[b][1] and hi >= AGE_RANGES[b][0]]


def reaches_everyone(row: dict) -> bool:
    """Чи доходить запис до родини в будь-якому місті."""
    cities = row.get("cities") or []
    if row.get("format") in ("online", "hybrid"):
        return True
    if ONLINE_CITY in cities or NATIONWIDE in cities or INTERNATIONAL_CITY in cities:
        return True
    if row.get("is_international"):
        return True
    return any(c and c != "ua" for c in (row.get("countries") or []))


def intake_per_week(rows, weeks: int = INTAKE_WEEKS) -> dict[tuple[str, str], float]:
    """Скільки нових записів на тиждень приходить у кожну клітинку.

    rows — нові активні записи за `weeks` тижнів (вже відфільтровані за датою
    викликачем). Записи, привʼязані до міста, не рахуються.
    """
    counts: dict[tuple[str, str], int] = {}
    for row in rows or []:
        if not reaches_everyone(row):
            continue
        family = family_of(row.get("opportunity_type"))
        if not family:
            continue
        for band in bands_of(row.get("age_from"), row.get("age_to")):
            counts[(family, band)] = counts.get((family, band), 0) + 1
    return {cell: n / weeks for cell, n in counts.items()}


# ── Штраф за марні спроби ───────────────────────────────────────────────────
#
# Скільки днів назад дивимось памʼять прогонів. Далі — вже інша база і інші
# джерела: клітинка, порожня в липні, у грудні може ожити (сезонність).
RUNS_WINDOW_DAYS = 90
# Скільки днів клітинка чекає після свого прогону. Один запуск на день, 35
# клітинок: сім днів — це можливість обійти найгостріші, не довбавши одну.
COOLDOWN_DAYS = 7


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        return None


@dataclass(frozen=True)
class Cell:
    family: str
    band: str
    demand: float
    intake: float      # нових записів на тиждень
    deficit: float     # попит ÷ (надходження + 1)
    score: float       # дефіцит після запобіжників
    empty_tries: int
    days_since_run: int | None

    @property
    def key(self) -> str:
        return f"{self.family}:{self.band}"


def _memory(runs, today: date) -> dict[tuple[str, str], tuple[int, int | None]]:
    """(марні спроби, днів від останнього прогону) по клітинках."""
    out: dict[tuple[str, str], tuple[int, int | None]] = {}
    for run in runs or []:
        cell = (run.get("family"), run.get("age_band"))
        when = _as_date(run.get("ran_at"))
        if cell[0] not in DEMAND or cell[1] not in AGE_RANGES or when is None:
            continue
        ago = (today - when).days
        if ago < 0 or ago > RUNS_WINDOW_DAYS:
            continue
        empty, last = out.get(cell, (0, None))
        # Марна спроба — та, після якої в базі не зʼявилось НІЧОГО. Знайдені,
        # але відкинуті дедупом чи перевіркою кандидати — теж марна спроба:
        # для родини різниці немає.
        if not (run.get("saved") or 0):
            empty += 1
        out[cell] = (empty, ago if last is None else min(last, ago))
    return out


def rank(intake: dict[tuple[str, str], float], runs=None, today: date | None = None) -> list[Cell]:
    """Клітинки від найдефіцитнішої. Нульовий попит у список не потрапляє."""
    today = today or date.today()
    mem = _memory(runs, today)
    cells: list[Cell] = []
    for family in FAMILIES:
        for band in BANDS:
            demand = demand_of(family, band)
            if demand <= 0:          # запобіжник «в»
                continue
            got = intake.get((family, band), 0.0)
            deficit = demand / (got + 1)
            empty, ago = mem.get((family, band), (0, None))
            score = deficit / (1 + empty)                       # запобіжник «б»
            if ago is not None and ago < COOLDOWN_DAYS:
                score /= (COOLDOWN_DAYS - ago + 1)
            cells.append(Cell(family, band, demand, got, deficit, score, empty, ago))
    # Сортування детерміноване: за рахунком, далі за порядком родин і віків у
    # plus_profile. Рівні клітинки (конкурси 0–3, 4–6 і 7–10 мають однаковий
    # рахунок, бо надходжень у них порівну нуль) розводить день року — інакше
    # без памʼяті прогонів агент довіку тримався б першої за абеткою.
    cells.sort(key=lambda c: (-c.score, FAMILIES.index(c.family), BANDS.index(c.band)))
    return cells


def pick(intake, runs=None, today: date | None = None) -> Cell | None:
    """Клітинка дня. None — якщо шукати немає де (весь попит нульовий)."""
    cells = rank(intake, runs, today)
    if not cells:
        return None
    top = [c for c in cells if round(c.score, 6) == round(cells[0].score, 6)]
    doy = (today or date.today()).timetuple().tm_yday
    return top[doy % len(top)]


# ── Слово дня ───────────────────────────────────────────────────────────────
#
# Формулювання родини — те, що людина справді вписала б у пошук. Міста тут
# немає й бути не може: вісь пошуку — вік і тема.
FAMILY_QUERY: dict[str, str] = {
    "clubs": "безкоштовні гуртки, курси й майстер-класи",
    "camps": "безкоштовні табори та літні школи",
    "contests": "конкурси, олімпіади й турніри",
    "grants": "стипендії, гранти та програми обміну",
    "support": "психологічна підтримка й реабілітація",
    "family_aid": "виплати та допомога родинам",
    "volunteering": "волонтерство й стажування для підлітків",
}


def band_label(band: str) -> str:
    lo, hi = AGE_RANGES[band]
    return f"{lo}–{hi} років"


def keyword_for(cell: Cell) -> str:
    return f"{FAMILY_QUERY[cell.family]} для дітей {band_label(cell.band)}"


# ── База ────────────────────────────────────────────────────────────────────
RUNS_TABLE = "discover_deficit_runs"


def load_rows(client, weeks: int = INTAKE_WEEKS) -> list[dict]:
    """Нові активні записи за `weeks` тижнів. Дублі (canonical_slug) не
    рахуються: вони віддають 301 на оригінал і новим надходженням не є."""
    since = (datetime.now(timezone.utc) - timedelta(weeks=weeks)).isoformat()
    out, start = [], 0
    while True:
        page = (client.table("opportunities")
                .select("id, opportunity_type, age_from, age_to, cities, countries, "
                        "format, is_international")
                .eq("status", "active").is_("canonical_slug", "null")
                .gte("created_at", since)
                .order("id").range(start, start + 999).execute().data or [])
        out.extend(page)
        if len(page) < 1000:
            return out
        start += 1000


def load_runs(client) -> list[dict]:
    """Памʼять прогонів. Немає таблиці — порожня памʼять: модуль працює,
    просто без штрафу за марні спроби."""
    since = (datetime.now(timezone.utc) - timedelta(days=RUNS_WINDOW_DAYS)).isoformat()
    try:
        return (client.table(RUNS_TABLE)
                .select("family, age_band, ran_at, candidates_found, saved")
                .gte("ran_at", since).execute().data or [])
    except Exception as e:
        logger.warning("Памʼять прогонів недоступна (%s) — рахую без штрафу.", e)
        return []


def record_run(client, family: str, band: str, keyword: str,
               found: int, saved: int) -> None:
    """Записати прогін. Збій не має валити розвідника: він свою роботу зробив."""
    try:
        client.table(RUNS_TABLE).insert({
            "family": family, "age_band": band, "keyword": keyword,
            "candidates_found": int(found), "saved": int(saved),
        }).execute()
    except Exception as e:
        logger.warning("Не вдалось записати прогін у %s: %s", RUNS_TABLE, e)


def cell_from_env(value: str | None) -> tuple[str, str] | None:
    """«contests:7-10» → ('contests', '7-10'). Чуже значення — None."""
    family, _, band = (value or "").partition(":")
    if family in DEMAND and band in AGE_RANGES:
        return family, band
    return None


# ── Запуск ──────────────────────────────────────────────────────────────────
def _table(cells: list[Cell]) -> str:
    head = f"{'клітинка':<24}{'попит':>8}{'/тижд':>8}{'дефіцит':>10}{'рахунок':>10}  памʼять"
    lines = [head, "-" * len(head)]
    for c in cells[:12]:
        mem = []
        if c.empty_tries:
            mem.append(f"марних спроб: {c.empty_tries}")
        if c.days_since_run is not None:
            mem.append(f"шукали {c.days_since_run} дн. тому")
        lines.append(f"{c.key:<24}{c.demand:>8.1f}{c.intake:>8.2f}"
                     f"{c.deficit:>10.1f}{c.score:>10.1f}  {', '.join(mem)}")
    return "\n".join(lines)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stderr)
    show = "--print" in sys.argv

    # Ручне слово людини перебиває дефіцит — як і було досі: кампанія має
    # дату, а розрахунок ні. Клітинку при цьому не виставляємо: прогін за
    # чужою темою нічого не каже про дефіцит клітинки й памʼять не псує.
    manual = (os.environ.get("DISCOVER_KEYWORD") or "").strip()
    if manual:
        logger.info("Слово задано людиною — дефіцит не рахую: «%s»", manual)
        print(f"DISCOVER_KEYWORD={manual}")
        return 0

    # Збій розрахунку не сміє зупинити розвідника: без слова від дефіциту
    # агент візьме своє слово дня зі старої ротації й попрацює як раніше.
    try:
        from db import get_client
        client = get_client()
        intake = intake_per_week(load_rows(client))
        runs = load_runs(client)
    except Exception as e:
        logger.warning("Дефіцит не порахувався (%s) — лишаю ротацію слів.", e)
        return 0

    if show:
        logger.info(_table(rank(intake, runs)))
    cell = pick(intake, runs)
    if cell is None:
        logger.warning("Жодної клітинки з ненульовим попитом — лишаю ротацію слів.")
        return 0

    kw = keyword_for(cell)
    logger.info("🎯 Дефіцит: %s · попит %.1f ÷ (%.2f + 1) = %.1f → «%s»",
                cell.key, cell.demand, cell.intake, cell.deficit, kw)
    print(f"DISCOVER_KEYWORD={kw}")
    print(f"DISCOVER_AGE_BAND={cell.band}")
    print(f"DISCOVER_DEFICIT_CELL={cell.key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
