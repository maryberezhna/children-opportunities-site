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

Що саме робить запис зеленим (рішення Марії 03.10.2026, «скасовуємо
обовʼязкові поля для всього… якщо якогось не вистачає, це не має затримувати
чергу»): є дата, якщо це програма з датами; посилання живе; не минуло; не
дубль; джерело — не лише чужий Telegram-канал; механічні перевірки якості
пройдені — і суддя каже «так». Порожні вік, вартість чи формат запис не
тримають, брак цитати теж. Чутливі теми (виплати, психологічна й медична
допомога, статусні діти) з того ж дня теж публікуються самі. До 03.10.2026
зеленим був лише запис із цитатою на кожне з пʼяти полів.

Памʼять судді (04.10.2026, після того як 03.10 закінчився баланс API):
щоночі суддя заново читав кожну чернетку, хоча більшість із них не мінялась
тижнями. Тепер його слово лежить в opportunities.auto_review разом із хешем
того, що він бачив; доки запис той самий, суддю не кличемо (див. review).

Запуск:
    python auto_review.py            # дамп: показує, що куди впало
    python auto_review.py --apply    # реально пише в базу
"""
import argparse
import hashlib
import json
import logging
import os
import re
from datetime import date, datetime, timezone

import anthropic


import api_guard  # відмова через ліміт/оплату робить запуск червоним
import usage
from db import get_client
# Перелік обовʼязкових полів один на весь конвеєр: нормалізатор ставить
# чернетку, коридори не пускають далі, адмінка показує те саме формулювання.
from normalizer import VALID_OPP_TYPES, latin_fields, missing_required, summary_says_over
from proof import PUBLISH_CRITERIA
from timing import is_expired
from first_source import source_problem
from page_signals import action_quote, broken_markup, fetch_page, report_reason

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"

# Скільки зʼїв суддя — у llm_usage (04.10.2026): до того облік був лише в
# нічному скрапі, і на питання «куди пішов баланс» відповіді не було.
SPEND = usage.Spend("auto-review")

# ── Рівень довіри джерела ───────────────────────────────────────────────────
# Підписи й рівень за замовчуванням — теж зі спеки: їх показує і черга
# в адмінці (lib/queue-risk.js), і причина тут.
TRUST_TIER_LABELS = {int(k): v
                     for k, v in PUBLISH_CRITERIA["risk"]["trust_tier_labels"].items()}
DEFAULT_TIER = int(PUBLISH_CRITERIA["risk"]["trust_tier_default"])

# Чим читаємо сторінку перед суддею. Змінна модуля — щоб тести підміняли мережу.
FETCH = fetch_page
# Скільки тексту сторінки бачить суддя: досить, щоб відрізнити звіт від набору,
# і не роздуває запит (Haiku, кожна чернетка, що пройшла механіку).
PAGE_FOR_JUDGE = 6000

MIN_SUMMARY_LEN = 60
MIN_TITLE_LEN = 15

# ── Вік в описі проти поля ──────────────────────────────────────────────────
# Дзеркало lib/age-text.js. Картка конкурсу «Ось як це було…» 30.09.2026:
# поле 8–16 з цитатою з положення, а опис із добірки learning.ua — «14–18
# років». Опис, що ОБІЦЯЄ вік поза полем, не публікується сам: що хибне —
# поле чи опис — видно лише зі сторінки. Опис вужчий за поле не ловимо: у
# записах із кількома групами він часто називає лише одну.
_AGE_PAIR = re.compile(r"(\d{1,2})\s*(?:[–—-]|до)\s*(\d{1,2})")
# Перелік груп «8–10, 11–13 і 14–18 років»: «років» лише в кінці ланцюжка.
_AGE_RUN = re.compile(
    r"(?:від\s*)?((?:\d{1,2}\s*(?:[–—-]|до)\s*\d{1,2})"
    r"(?:\s*(?:,|;|і|та|або)?\s*(?:[^\s\d.;:,]+\s+){0,2}\d{1,2}\s*(?:[–—-]|до)\s*\d{1,2})*)"
    r"\s*(?:рок|р\.)")
_NOT_AGE_BEFORE = re.compile(
    r"(?:(?:навчанн|трива|протягом|курс|програм|досвід|стаж|термін)\S*|на)\s*$", re.I)
SITE_MAX_AGE = 18


def summary_age_range(text: str | None) -> tuple[int, int] | None:
    """Найширший вік, який називає текст, або None."""
    s = text or ""
    lo = hi = None
    for run in _AGE_RUN.finditer(s):
        if _NOT_AGE_BEFORE.search(s[max(0, run.start() - 14):run.start()]):
            continue
        for m in _AGE_PAIR.finditer(run.group(1)):
            a, b = int(m.group(1)), int(m.group(2))
            if a > b:
                continue
            lo = a if lo is None else min(lo, a)
            hi = b if hi is None else max(hi, b)
    return None if lo is None else (lo, hi)


def summary_age_conflict(summary: str | None, age_from, age_to) -> str | None:
    """Опис обіцяє вік поза полем — причина для модератора, інакше None."""
    r = summary_age_range(summary)
    if not r or (age_from is None and age_to is None):
        return None
    text_from = min(r[0], SITE_MAX_AGE)
    text_to = min(r[1], SITE_MAX_AGE)
    wider = ((age_from is not None and text_from < age_from)
             or (age_to is not None and text_to > age_to))
    if not wider:
        return None
    return (f"в описі {r[0]}–{r[1]} років, а в полі "
            f"{'?' if age_from is None else age_from}–{'?' if age_to is None else age_to}")

GREEN = "green"
YELLOW = "yellow"
RED = "red"


def tier_label(trust_tier) -> str:
    """Підпис рівня джерела. Невідомий рівень читаємо як третій."""
    return TRUST_TIER_LABELS.get(trust_tier, TRUST_TIER_LABELS[DEFAULT_TIER])


def _hold(reason: str, trust_tier: int) -> tuple[str, str]:
    """Жовтий, і в причині видно ОБИДВА: чого бракує і звідки запис.

    Рівень джерела більше не тримає запис сам (див. mechanical), але
    модератору він потрібен саме тут: «бракує вартості» з сайту міністерства
    і те саме з перепосту в телеграмі — різна робота.
    """
    return YELLOW, f"{reason} · {tier_label(trust_tier)}"


# ── Чернетки, які свідомо відклали для людини (Марія, 09.10.2026: «так») ──
# auto_review бере ВСІ чернетки, тож публікував і те, що людина чи інший
# крок поклали в чергу навмисно: зняте з сайту, пропозиції («завжди
# чернеткою»), додане через add-draft («публікує людина»), «не для дітей?».
# Позначки — дослівно ті, що пишуть ці кроки в admin_comment.
PARKED_MARKS = (
    ("тип і вік ще не визначено", "заглушка з пропозиції — тип і вік ще не визначено"),
    ("додано вручну через add-draft", "додано вручну — публікує людина"),
    ("💡 пропозиція з форми на сайті", "пропозиція з сайту — завжди через людину"),
    ("💡 принесла Марія", "принесла Марія — публікує людина"),
    ("🔎 з нашого дослідження", "з дослідження — публікує людина"),
    ("учасник — дорослий", "схоже, не для дітей — перевір"),
    ("лише для зарахованих студентів ЗВО", "схоже, лише для студентів — перевір"),
    ("набір триває, а нової дати немає", "lifecycle поклав у чергу людині"),
    ("знято з сайту", "знято з сайту — повертає людина"),
)


def parked_reason(row: dict) -> str:
    """Чому чернетку відклали для людини, або порожній рядок."""
    if row.get("_unpublished"):
        return "знято з сайту — повертає людина"
    comment = (row.get("admin_comment") or "").lower()
    for mark, reason in PARKED_MARKS:
        if mark.lower() in comment:
            return reason
    return ""


def placeholder_reason(row: dict) -> str:
    """Вік чи тип — технічна заглушка, а не слова джерела.

    Вік і тип — фільтри сайту (Марія, 09.10.2026). Без цитати нормалізатор
    ставить 0–18 і «курс», бо база не приймає порожнє: такий запис
    показувався б усім вікам і не в тому розділі.
    """
    evidence = row.get("evidence") if isinstance(row.get("evidence"), dict) else {}
    age_from, age_to = row.get("age_from"), row.get("age_to")
    if age_from is None or age_to is None:
        return "бракує віку"
    if (age_from, age_to) == (0, 18) and not evidence.get("age"):
        return "вік — заглушка 0–18, на сторінці не знайдено"
    kind = row.get("opportunity_type")
    if kind not in VALID_OPP_TYPES:
        return "бракує типу"
    if kind == "course" and not evidence.get("type"):
        return "тип — заглушка «курс», на сторінці не знайдено"
    return ""


def mechanical(row: dict, trust_tier: int = DEFAULT_TIER) -> tuple[str, str] | None:
    """Детермінована частина. Повертає (коридор, причина) або None, якщо
    запис пройшов механіку і йде далі, до судді.

    trust_tier — надійність джерела з реєстру `sources`: 1 держ/офіційні,
    2 звичайні організації, 3 соцмережі й агреговані стрічки. Джерела, якого
    в реєстрі немає, вважаємо третім рівнем: так поводиться discover-агент,
    що приносить сайт, якого ми ще ніколи не бачили.

    Рівень НЕ є воротами (23.09.2026): він лише дописується до причини, коли
    запис і так тримають. Чому — див. коментар біля цитат нижче.
    """
    today = date.today().isoformat()

    # ── Червоний ────────────────────────────────────────────────────────
    # Шматок виклику інструмента в описі («</summary><parameter name=…>») —
    # модель зламалась на цьому записі, і решті полів теж не можна вірити:
    # у «Школі юного дипломата» (11.10.2026) так вік став 0–18.
    if broken_markup(row.get("title"), row.get("summary"), row.get("details")):
        return RED, "зламана розмітка моделі в описі — у брак"
    if row.get("dup_of") or row.get("canonical_slug"):
        return RED, "дубль — на злиття, не в публікацію"
    if (row.get("link_status") or "ok") != "ok":
        return RED, f"лінк не живий ({row.get('link_status')})"
    # Та сама ознака «минуло», що в плановій перевірці (scraper/timing.py):
    # зокрема запис лише з датою початку, який раніше сюди не потрапляв.
    if is_expired(row, date.fromisoformat(today)):
        last = row.get("deadline") or row.get("event_end_date") or row.get("event_start_date")
        return RED, f"дата в минулому ({last})"

    # ── Жовтий: джерело — не сторінка організатора ─────────────────────
    # Марія, 27.09.2026: чужі Telegram-канали ніколи не показуємо, а запис без
    # першоджерела не публікується. Каталог Eurodesk — теж не першоджерело
    # (28.09.2026). Ті самі ворота, що на кнопках адмінки (lib/source-rules.js);
    # до 04.10.2026 тут пускали допис із формою подачі, а форма — не джерело.
    # Досі це ховав брак цитат; після 03.10.2026 суддя пропустив би такі записи.
    problem = source_problem(row)
    if problem:
        return YELLOW, problem

    parked = parked_reason(row)
    if parked:
        return YELLOW, parked

    # Чутливі теми (виплати, психологічна й медична допомога, статусні діти)
    # до 03.10.2026 завжди йшли людині, навіть бездоганні. Марія того дня:
    # «публікувати самим» — тепер вони проходять ті самі ворота, що й решта.

    # ── Жовтий: програмі з датами бракує дати ──────────────────────────
    # Єдине обовʼязкове поле з 03.10.2026 (lib/publish-criteria.json,
    # blocking): без дедлайну чи початку запис не закриється сам. Постійним
    # і виплатам дата не потрібна. Вік, вартість і формат запис не тримають.
    missing = missing_required(row)
    if missing:
        return _hold("бракує: " + ", ".join(missing), trust_tier)
    placeholder = placeholder_reason(row)
    if placeholder:
        return _hold(placeholder, trust_tier)

    # Брак цитати запис більше не тримає (03.10.2026). Цитати лишаються
    # доказом того, що заповнено, і їх далі дозбирує proof_recheck, але
    # ворота — лише дата вище й перевірки якості нижче.

    # ── Жовтий: три перевірки зі спеки (colors.green) ───────────────────
    # Посилання перевірене вище (червоний), актуальність — там само і тут,
    # третя — «українською». Транслітерація («Matematychnyy konkurs-hra…»)
    # українською не є: нормалізатор ловить її на вході, але запис міг
    # прийти в чергу й раніше, а цитати тепер самі по собі відчиняють сайт.
    # Вік тепер може бути порожнім (03.10.2026) — порівнюємо лише заповнений.
    age_from, age_to = row.get("age_from"), row.get("age_to")
    if (age_from is not None and age_from < 0) or (age_to is not None and age_to > 18):
        return _hold(f"вік поза 0–18 ({age_from}–{age_to})", trust_tier)
    summary = row.get("summary") or ""
    if summary_says_over(summary):
        return _hold("в описі сказано, що набір чи сезон уже завершено", trust_tier)
    mismatch = summary_age_conflict(summary, row.get("age_from"), row.get("age_to"))
    if mismatch:
        return _hold(mismatch, trust_tier)
    if len(summary) < MIN_SUMMARY_LEN:
        return _hold(f"опис коротший за {MIN_SUMMARY_LEN} символів", trust_tier)
    if len(row.get("title") or "") < MIN_TITLE_LEN:
        return _hold("назва підозріло коротка", trust_tier)
    latin = latin_fields(row)
    if latin:
        return _hold("не українською: " + ", ".join(latin) + " латиницею", trust_tier)

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

АЛЕ місцева НЕДЕРЖАВНА послуга чужої країни БЕЗ УКРАЇНСЬКОГО ЗМІСТУ —
publish=false навіть тоді, коли вона відкрита для всіх: фонд однієї
голландської громади, клуб при британській бібліотеці, міська музична школа,
майстерня в ірландському містечку. Це для тамтешніх мешканців, а не для
нашої аудиторії. Публікуємо з-за кордону:
- ДЕРЖАВНІ програми країни чи регіону для дітей, на які мають право діти з
  тимчасовим захистом з України, навіть якщо українців у тексті не названо
  (Марія, 28.09.2026): уроки мови, підготовчі класи, державні табори й
  канікулярні програми, державні стипендії, психологічна підтримка — і
  державні виплати на дитину (800+, Kindergeld, Bildung und Teilhabe тощо).
  Умова права (тимчасовий захист, проживання) має стояти в описі;
- події з українським змістом або від української організації, навіть якщо
  відкриті всім (Марія, 28.09.2026): двомовна майстерня в Українському домі,
  конкурс малюнка «Україна очима дітей», студія українського танцю з учнями
  різних національностей, фестиваль Союзу українців у Польщі, табір УГКЦ;
- те, на що можна податися з України: обміни, стипендії, конкурси, табори з
  набором іззовні, онлайн.

ПЛАТНА УКРАЇНСЬКА ШКОЛА, СТУДІЯ ЧИ КОНКУРС ЗА КОРДОНОМ — НЕ РЕКЛАМА. Суботня
чи недільна школа, студія, конкурс для українських дітей публікуються й тоді,
коли вони платні: «Платно» — нормальна вартість (Марія, 28.09.2026).

Запис для дітей, які ВЖЕ ЖИВУТЬ за кордоном, в описі прямо каже, для кого:
«для українських дітей, які живуть у Німеччині». Якщо з опису не зрозуміло,
це для тих, хто вже там, чи поїздка з України, — publish=false.

Виплата місцевого фонду чи НУО іншої країни — publish=false; державна
виплата на дитину для тих, хто там живе, — наша (див. вище).

Кажи publish=true, тільки якщо виконано ВСЕ:
- це КОНКРЕТНА можливість для дитини 0–18 (курс, гурток, конкурс, табір,
  стипендія, обмін), а не опис організації і не агрегатор чужих можливостей;
- назва й опис узгоджені між собою і з типом та віком;
- опис пояснює, ЩО дитина отримає, а не лише рекламує організатора;
- джерело схоже на справжнього організатора, а не на перепост невідомо чого;
- немає ознак, що набір уже закритий або подія минула. Дата «Сьогодні» є в
  даних; «Заявки до» — останній день подачі, «Початок/Кінець події» — коли
  вона відбувається. Це різні дати.

СТАТТЯ — НЕ МОЖЛИВІСТЬ. Поле «Текст сторінки» — сама сторінка джерела, «Опис» —
наш переказ, і переказ може помилятись. Звіряй із текстом сторінки. Якщо
сторінка — звіт про подію, що вже була («ось як проходили зустрічі», «дякуємо
учасникам»), новина про заняття для тих, хто вже ходить («для вихованців
студії»), або стаття без жодного способу потрапити (ні заявки, ні реєстрації,
ні контакту для запису) — publish=false, навіть якщо опис звучить як набір.

Кажи publish=false, якщо:
- це реклама платного сервісу під виглядом можливості (платна українська
  школа чи студія за кордоном — не реклама, див. вище);
- опис загальний і з нього не зрозуміло, що робити дитині;
- текст суперечить сам собі (вік у назві не той, що в полі);
- ти вагаєшся з будь-якої іншої причини.

ПОРОЖНІ ПОЛЯ — НЕ ПРИЧИНА ДЛЯ publish=false. Вік, вартість, формат чи цитати
можуть бути не вказані: публікуємо те, що є (Марія, 03.10.2026). Виплати,
психологічна й медична допомога, програми для дітей ВПО, з інвалідністю,
сиріт — теж публікуються, якщо це конкретна можливість для дитини.

СУМНІВ = publish=false. Пропустити сумнівний запис дорожче, ніж потримати
хороший зайвий день у черзі."""


def judge_payload(row: dict, page: str | None = None) -> dict:
    """Рівно те, що бачить суддя. Одне місце і для запиту, і для хешу памʼяті:
    поле, яке колись допишуть сюди, саме потрапить і в хеш.

    page — текст самої сторінки (з 11.10.2026). До того суддя бачив лише наш
    переказ, і звіт, переказаний як «курс щосереди», виглядав набором."""
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
    if page:
        payload["Текст сторінки"] = page[:PAGE_FOR_JUDGE]
    return payload


# «Сьогодні» в хеш не йде: з ним хеш мінявся б щоночі й памʼять не працювала б.
# Дату суддя бачить, щоб помітити минуле, але минуле й так щоночі ловить
# механіка (is_expired) ще ДО судді, а з памʼяті береться лише «ні» (див.
# remembered) — тож застаріле «ні» нічого не опублікує.
# Текст сторінки теж: на ньому лічильники, банери й «новини поруч», і памʼять
# судді губилась би від кожного перезавантаження. Памʼять береться лише для
# «ні», тож застарілий текст нічого не опублікує.
_NOT_HASHED = ("Сьогодні", "Текст сторінки")


def judge_hash(row: dict) -> str:
    """Відбиток того, що бачить суддя, разом із ним самим: модель, промпт і
    схема відповіді. Зміниться будь-яке поле запису чи промпт — зміниться хеш,
    і суддя подивиться знову."""
    seen = {k: v for k, v in judge_payload(row).items() if k not in _NOT_HASHED}
    blob = json.dumps({"model": MODEL, "prompt": JUDGE_PROMPT, "tool": JUDGE_TOOL,
                       "input": seen}, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def judge(client, row: dict, page: str | None = None) -> dict:
    """Слово судді. Будь-який збій — трактуємо як «не впевнений».

    Збій позначено `failed`: його не запамʼятовуємо, інакше вичерпаний
    баланс (як 03.10.2026) лишив би чернетки жовтими до першої правки."""
    payload = judge_payload(row, page)
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=JUDGE_PROMPT,
            tools=[JUDGE_TOOL],
            tool_choice={"type": "tool", "name": "verdict"},
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
        )
        SPEND.add(MODEL, resp)
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        if not block:
            return {"publish": False, "reason": "суддя не повернув рішення",
                    "confidence": 0.0, "failed": True}
        return block.input
    except Exception as e:
        logger.error("суддя впав на %s: %s", row.get("slug"), e)
        return {"publish": False, "reason": f"збій судді: {e}", "confidence": 0.0,
                "failed": True}


# Нижче цього порогу впевненості зелений коридор закритий, навіть якщо
# суддя сказав «так». Поріг високий свідомо: див. останній абзац промпту.
MIN_CONFIDENCE = 0.8


def verdict_corridor(j: dict) -> tuple[str, str]:
    """Слово судді → коридор. Одне правило і для свіжого слова, і для
    запамʼятованого: поріг MIN_CONFIDENCE діє на обидва однаково."""
    if j.get("publish") and j.get("confidence", 0) >= MIN_CONFIDENCE:
        return GREEN, f"суддя: {j.get('reason', '')}"
    return YELLOW, f"суддя не пропустив: {j.get('reason', '')}"


def remembered(row: dict, h: str) -> dict | None:
    """Збережене слово судді, якщо запис відтоді не змінився, — інакше None.

    Береться лише «ні» (жовтий). Зелений запис і так іде з черги, тож економії
    на ньому немає, а чернеткою він знову стає, лише коли його туди повернули
    (lifecycle, audit_clubs), — таке хай суддя подивиться свіжим оком.
    """
    mem = row.get("auto_review")
    if not isinstance(mem, dict) or mem.get("hash") != h:
        return None
    j = mem.get("verdict")
    if not isinstance(j, dict) or verdict_corridor(j)[0] != YELLOW:
        return None
    return j


def review(row: dict, client, trust: dict | None = None
           ) -> tuple[str, str, str, dict | None]:
    """(коридор, причина, звідки слово, памʼять для запису або None).

    Звідки: "mechanical" — вирішила механіка, "memory" — слово судді з
    минулого прогону, "judge" — суддю питали щойно, "none" — питати нічим.
    Памʼять повертається лише після справжньої відповіді судді."""
    # Джерела немає в реєстрі — це не «нормальне», а «невідоме»: третій рівень.
    tier = (trust or {}).get(row.get("source"), DEFAULT_TIER)
    verdict = mechanical(row, tier)
    if verdict:
        return verdict[0], verdict[1], "mechanical", None

    h = judge_hash(row)
    cached = remembered(row, h)
    if cached is not None:
        return (*verdict_corridor(cached), "memory", None)

    if not client:
        j = {"publish": False, "reason": "суддя не запускався (немає ключа)", "confidence": 0.0}
        return (*verdict_corridor(j), "none", None)

    # ── Сторінка: чи є куди потрапити (11.10.2026) ──────────────────────
    # Механіка дивиться лише на наші поля. Тут — на саму сторінку: стаття
    # про подію, звіт для своїх вихованців чи новина без подачі не
    # публікуються самі, навіть якщо переказ звучить як набір.
    page, why = FETCH(row.get("source_url") or "")
    if not page:
        return (*_hold(f"сторінку не прочитали ({why}) — не видно, чи є набір",
                       tier), "mechanical", None)
    report = report_reason(row.get("source_url"), page)
    if report:
        return (*_hold(report, tier), "mechanical", None)
    if not action_quote(page, row.get("apply_url")):
        return (*_hold("на сторінці не видно, як потрапити: ні заявки, ні реєстрації, "
                       "ні контакту для запису", tier), "mechanical", None)

    j = judge(row=row, client=client, page=page)
    corridor, reason = verdict_corridor(j)
    if j.get("failed"):
        return corridor, reason, "judge", None
    try:
        confidence = float(j.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0         # «впевненість» не числом — у памʼяті це «не впевнений»
    memory = {
        "hash": h,
        "corridor": corridor,
        "reason": reason,
        "verdict": {"publish": bool(j.get("publish")), "confidence": confidence,
                    "reason": j.get("reason", "")},
        "model": MODEL,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    return corridor, reason, "judge", memory


def classify(row: dict, client, trust: dict | None = None) -> tuple[str, str]:
    corridor, reason, _, _ = review(row, client, trust)
    return corridor, reason


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


# Колонку opportunities.auto_review додає міграція 20261004_llm_spend_memory.sql.
# Доки її не застосували, запис памʼяті падає — тоді до кінця прогону більше не
# пробуємо, а суддю питаємо щоразу, як до 04.10.2026. Коридори від цього не
# залежать: памʼять пишеться окремим запитом, уже після рішення.
_memory_off = False


def remember(sb, row: dict, memory: dict) -> bool:
    global _memory_off
    if _memory_off:
        return False
    try:
        sb.table("opportunities").update({"auto_review": memory}).eq("id", row["id"]).execute()
        return True
    except Exception as e:                                   # noqa: BLE001
        _memory_off = True
        logger.warning("Памʼять судді не записалась (%s) — чи застосовано міграцію "
                       "20261004_llm_spend_memory.sql? До кінця прогону не пробую.", e)
        return False


def run(apply: bool = False, limit: int = 500) -> dict:
    sb = get_client()
    key = os.getenv("ANTHROPIC_API_KEY")
    client = api_guard.client(api_key=key) if key else None
    if not client:
        print("⚠️  ANTHROPIC_API_KEY немає — суддя не запуститься, "
              "усе, що пройшло механіку, впаде в жовтий\n")

    rows = (sb.table("opportunities").select("*")
            .eq("status", "draft").limit(limit).execute().data or [])
    # Зняте з сайту лишає слід не в admin_comment, а в moderation_notes
    # (scripts/unpublish.mjs).
    ids = [r["id"] for r in rows]
    gone = set()
    try:
        for i in range(0, len(ids), 100):
            notes = (sb.table("moderation_notes").select("opportunity_id")
                     .in_("opportunity_id", ids[i:i + 100])
                     .ilike("body", "Знято з сайту%").execute().data or [])
            gone.update(n["opportunity_id"] for n in notes)
    except Exception as e:                                   # noqa: BLE001
        # Без цього сліду прогін небезпечний: зняте з сайту повернулось би.
        logger.warning("moderation_notes не прочитались (%s) — нічого не публікую", e)
        apply = False
    for r in rows:
        if r["id"] in gone:
            r["_unpublished"] = True
    print(f"Чернеток у черзі: {len(rows)}\n")

    trust = {r["name"]: r.get("trust_tier") or DEFAULT_TIER
             for r in (sb.table("sources").select("name, trust_tier").execute().data or [])}

    # Дамп не пише в базу нічого — ні рішень, ні памʼяті судді, ні витрат
    # (04.10.2026 «суха» перевірка опублікувала 74 записи, див. #661).
    # Читати памʼять дамп може: це лише економить виклики.
    SPEND.dry = not apply
    buckets = {GREEN: [], YELLOW: [], RED: []}
    asked = {"judge": 0, "memory": 0}
    try:
        for row in rows:
            corridor, reason, whence, memory = review(row, client, trust)
            buckets[corridor].append((row, reason))
            if whence in asked:
                asked[whence] += 1
            if apply:
                apply_decision(sb, row, corridor, reason)
                if memory:
                    remember(sb, row, memory)
    finally:
        SPEND.record(sb)
    print(f"Суддя: питали {asked['judge']}, з памʼяті {asked['memory']} "
          f"(чернетка не змінилась від минулого прогону)\n")

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
