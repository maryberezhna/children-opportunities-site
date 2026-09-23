"""Докази на обовʼязкові поля: дослівні цитати зі сторінки джерела.

Світлофор (рішення Марії 22.09.2026): запис зелений, тобто публікується сам,
лише коли на кожне з пʼяти обовʼязкових полів є дослівна цитата зі сторінки.
Поле, яке заповнене здогадом чи дефолтом (вік 0–18 «технічно», тип «course»
замість типу, «набір постійний» у гуртка), цитати не має і зеленим бути не
може — такий запис жовтий, до людини, з переліком, на що бракує цитати.

Це єдине місце, де конвеєр читає lib/publish-criteria.json: normalizer і
auto_review беруть визначення звідси. JS-дзеркало — lib/required.js
(missingProof).
"""
import json
import re
from pathlib import Path

# Нормалізація тексту та сама, що й у планової перевірки (timing._norm):
# лапки, тире й пробіли моделі й сторінки збігаються не завжди.
from timing import _norm

_CRITERIA_PATH = Path(__file__).resolve().parents[1] / "lib" / "publish-criteria.json"
with open(_CRITERIA_PATH, encoding="utf-8") as _f:
    PUBLISH_CRITERIA = json.load(_f)

# Рядки, які в сирий текст дописуємо МИ, а не джерело. Скрапери складають
# raw_text із заголовка, полів зі сторінки і власних пояснювальних речень —
# і ось ці речення цитатою зі сторінки не є. Без цього ворота правди
# приймали б наш же здогад за слова джерела: «Набір відкритий на момент
# збору» від Eurodesk ставало б доказом дати, а весь текст олімпіад МОН —
# доказом чого завгодно, бо mon.gov.ua віддає 403 і текст складає скрапер
# зі статичної таблиці (22.09.2026).
#
# Поля, ЗЧИТАНІ зі сторінки й лише переформатовані («Місто: Львів»,
# «Вік: 6–16 років», «Вартість: безкоштовно» у gurtok.org), сюди НЕ входять:
# це слова джерела, просто в іншому порядку.
#
# Перелік стереже scraper/tests/test_proof_not_ours.py: змінить скрапер
# формулювання — тест упаде, і його не забудуть оновити тут.
OUR_LINES = (
    r"Європейська програма з переліку Eurodesk Opportunity Finder\.?",
    r"Набір відкритий на момент збору\.?",
    r"Гурток із переліку gurtok\.org\.\s*Умови й контакти уточнюються\s*в організації\.?",
    r"Розклад і умови уточнюються в центрі\.?",
    r"Участь безкоштовна, потрібна реєстрація\.?",
    r"Місто: Вся Україна",
    r"Організатор: Фонд Президента України[^\n]*",
    # МОН: увесь запис синтетичний, цитувати нічого.
    r"Всеукраїнська олімпіада з [^\n]*? для учнів [^\n]*",
    r"Щорічне змагання МОН України[^\n]*",
    r"Участь безкоштовна\.\s*Реєстрація через школу\.?",
    r"Вік учасників: \d+[-–]\d+ років[^\n]*",
)
_OURS_RE = re.compile("|".join(OUR_LINES), re.IGNORECASE)


def source_text(text) -> str:
    """Текст сторінки без наших дописок — саме з ним звіряємо цитати."""
    return _OURS_RE.sub(" ", text or "")


PROOF_KEYS = tuple(PUBLISH_CRITERIA["order"])
PROOF_LABELS = {k: PUBLISH_CRITERIA["required"][k]["label"] for k in PROOF_KEYS}
MAX_QUOTE = 240


def quote_in_text(quote, text) -> bool:
    """Чи цитата справді стоїть у тексті. Коротка цитата («онлайн», «м. Львів»)
    має збігтися цілком; довгу приймаємо, якщо в тексті є хоч один її
    фрагмент від 12 знаків — модель інколи склеює два речення крапкою."""
    q = _norm(quote) if isinstance(quote, str) else ""
    if len(q) < 4:
        return False
    # Звіряємо зі словами ДЖЕРЕЛА: наші власні дописки не доказ.
    hay = _norm(source_text(text))
    if q[:60] in hay:
        return True
    for frag in re.split(r"[;…]|\.\.\.|\s-\s|[.!?]\s", q):
        frag = frag.strip(" .,:")
        if len(frag) >= 12 and frag[:40] in hay:
            return True
    return False


# ── Формат, який слово називає саме ────────────────────────────────────────
# Жанри, що не бувають офлайн: вебінар не має адреси, Zoom-зустріч теж.
# 23.09.2026 Марія побачила в карантині вебінар «Як жити в кайф і сьогодні, і
# потім» із причиною «без цитати: формат або місце» — і він протермінувався в
# черзі, хоча слово «вебінар» стояло і в тексті, і в цитаті на тип. Машина
# вимагала окремої фрази про «онлайн», якої джерело не писало, бо й так
# зрозуміло.
ONLINE_GENRE = re.compile(
    r"вебінар\w*|webinar\w*|вебконференц\w*|\bzoom\b|google\s?meet|"
    r"microsoft\s?teams|\bms\s?teams\b",
    re.IGNORECASE)

# «Онлайн» як формат САМОЇ участі. Слова після нього — те, що людина робить:
# школа, курс, заняття, табір. «Онлайн-реєстрація», «онлайн-заявка», «подати
# онлайн» сюди не потрапляють навмисно: це спосіб подати документи, а не
# формат можливості — табір, куди записуються онлайн, лишається табором наживо.
_ONLINE_WHAT = (r"школ|курс|урок|занятт|навчанн|формат|режим|марафон|табір|табор|"
                r"клуб|гурт|лекці|програм|олімпіад|конкурс|інтенсив|вебінар|майстер|"
                r"челендж|хакатон|консультац|студі|академі")
ONLINE_IN_TEXT = re.compile(
    rf"онлайн[-‑\s]?(?:{_ONLINE_WHAT})"
    rf"|(?:у|в)\s+форматі\s+онлайн"
    rf"|дистанційн\w*\s+(?:{_ONLINE_WHAT})"
    rf"|\bonline[-\s]?(?:school|course|class|lesson|program|camp)"
    rf"|{ONLINE_GENRE.pattern}",
    re.IGNORECASE)
ONLINE_TITLE = re.compile(r"^\W*(?:online|онлайн)\b", re.IGNORECASE)
OFFLINE_IN_TEXT = re.compile(r"\bочн(?:о|ий|і|а|их)\b|офлайн|offline|наживо", re.IGNORECASE)


def place_quote(text) -> str | None:
    """Шматок сторінки, який сам називає формат участі, — цитата на «де».

    Беремо дослівно зі сторінки (без наших дописок) і звіряємо тією ж
    quote_in_text, що й цитати від моделі: вигадати тут нічого не можна.
    Повертає None, якщо слова про формат на сторінці немає.
    """
    src = source_text(text)
    m = ONLINE_IN_TEXT.search(src)
    if not m:
        return None
    # Речення навколо збігу, але не довше за вікно: довга цитата ніколи не
    # буває кориснішою за фразу, у якій стоїть саме слово.
    left = max(src.rfind(".", 0, m.start()), src.rfind("\n", 0, m.start()),
               m.start() - 90) + 1
    right = min(len(src), m.end() + 90)
    for stop in (".", "\n"):
        pos = src.find(stop, m.end())
        if pos != -1:
            right = min(right, pos)
    quote = re.sub(r"\s+", " ", src[left:right]).strip(" .,:;«»–—-")[:MAX_QUOTE]
    return quote if quote_in_text(quote, text) else None


def verify_evidence(evidence, text) -> dict:
    """Лишає тільки цитати, які є в тексті ДЖЕРЕЛА; решту відкидає мовчки —
    модель інколи замість цитати пише власний висновок («табір зазвичай
    платний») або цитує рядок, який дописав наш же скрапер."""
    out = {}
    if not isinstance(evidence, dict):
        return out
    for key in PROOF_KEYS:
        quote = evidence.get(key)
        if isinstance(quote, str) and quote_in_text(quote, text):
            out[key] = re.sub(r"\s+", " ", quote).strip()[:MAX_QUOTE]
    return out


def missing_proof(data: dict) -> list:
    """Ключі обовʼязкових полів без цитати, у сталому порядку. Виняток для
    виплат (дата не обовʼязкова) той самий, що й у missing_required."""
    ev = data.get("evidence") or {}
    if not isinstance(ev, dict):
        ev = {}
    otype = data.get("opportunity_type")
    missing = []
    for key in PROOF_KEYS:
        crit = PUBLISH_CRITERIA["required"][key]
        if otype in crit.get("except_types", ()):
            continue
        if not (isinstance(ev.get(key), str) and ev[key].strip()):
            missing.append(key)
    return missing


def drop_proof(data: dict, key: str) -> None:
    """Поле поставлено не з тексту (дефолт, здогад, заглушка) — цитата на
    нього більше не доказ."""
    ev = data.get("evidence")
    if isinstance(ev, dict):
        ev.pop(key, None)
