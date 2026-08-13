"""keywords.py — спільний тематичний словник можливостей для дітей 0–18.

12 категорій ключових слів (формат, STEM, арт, спорт, мови, конкурси, табори,
кар'єра, міжнародні, онлайн тощо). Використовується контент-скраперами
(Telegram / Instagram / Facebook) для відбору релевантних дописів через
`is_relevant()`, а `match_categories()` повертає, до яких тем допис належить.

Матчинг — підрядковий, регістронезалежний. Джерела вже курувані (канали й
сторінки про дітей), а фінальну фільтрацію (вік, конкретність, відсів дорослого
контенту й агрегаторів) робить AI-нормалізатор. Тож широкий словник лише
розширює лійку пошуку, майже не додаючи шуму в базу.
"""
from __future__ import annotations

# ── 12 тематичних категорій ───────────────────────────────────────────────────
KEYWORD_CATEGORIES: dict[str, list[str]] = {
    # 1. Формат навчання (базовий каркас)
    "format": [
        "гурток", "студія", "секція", "курс", "майстер-клас", "воркшоп",
        "інтенсив", "буткемп", "факультатив", "спецкурс", "майстерня",
        "лабораторія", "дитяча академія", "освітній проєкт",
        "розвивальні заняття", "ранній розвиток", "підготовка до школи",
    ],
    # 2. Неформальна / позашкільна освіта
    "nonformal": [
        "позашкільна освіта", "неформальна освіта", "додаткова освіта",
        "освіта поза школою", "alternative education", "self-directed learning",
        "проєктне навчання", "освітній хаб", "простір для дітей",
        "дитячий простір",
    ],
    # 3. STEM / наука / технології
    "stem": [
        "stem", "steam", "робототехніка", "програмування для дітей", "coding",
        "scratch", "python для дітей", "дитяче it", "юний технік", "винахідник",
        "наукові пікніки", "наука для дітей", "науковий гурток", "астрономія",
        "біотех", "дрони",
    ],
    # 4. Творчість / арт
    "arts": [
        "арт-студія", "малювання", "живопис", "кераміка", "гончарство",
        "музична школа", "вокал", "хоровий", "гра на", "театральна студія",
        "акторська майстерність", "танці", "хореографія", "дизайн для дітей",
        "анімація", "мультиплікація", "фотошкола", "креативні майстерні",
    ],
    # 5. Спорт / фізичний розвиток
    "sport": [
        "спортивна секція", "спортивна школа", "дюсш", "плавання", "гімнастика",
        "єдиноборства", "скелелазіння", "командні види", "фізична активність",
        "рухливі заняття", "adaptive sport", "інклюзивний спорт",
    ],
    # 6. Мови
    "languages": [
        "мовна школа", "англійська для дітей", "розмовний клуб", "language club",
        "білінгвальн", "підготовка до cambridge", "ielts junior",
        "друга іноземна", "мовний табір",
    ],
    # 7. Soft skills / особистісний розвиток
    "soft_skills": [
        "soft skills", "лідерство", "публічні виступи", "ораторське", "дебати",
        "критичне мислення", "емоційний інтелект", "тайм-менеджмент",
        "фінансова грамотність", "self-development", "особистісний розвиток",
    ],
    # 8. Конкурси / олімпіади / челенджі (швидко зникають — критичні для скрапу)
    "contests": [
        "олімпіада", "конкурс", "турнір", "змагання", "хакатон", "челендж",
        "quest", "вікторина", "кастинг", "open call", "подати заявку",
        "дедлайн", "відбір учасників", "конкурс проєктів", "конкурс есе",
        "конкурс малюнків",
    ],
    # 9. Табори (розвиткові, не оздоровчі)
    "camps": [
        "освітній табір", "stem-camp", "мовний табір", "творчий табір", "кемп",
        "camp", "літня школа", "зимова школа", "day camp", "виїзний інтенсив",
        "збори",
    ],
    # 10. Підлітки: кар'єра / підприємництво
    "career": [
        "профорієнтація", "career guidance", "стажування", "internship",
        "job shadowing", "підприємництво для підлітків", "стартап-школа",
        "teen entrepreneurship", "акселератор", "менторство", "наставництво",
        "mentorship",
    ],
    # 11. Міжнародні / обмінні
    "international": [
        "exchange", "обмін", "flex", "erasmus", "uwc", "issos", "summer school",
        "scholarship", "youth program", "international competition", "mobility",
        "upshift", "irex",
    ],
    # 12. Цифрове / онлайн
    "online": [
        "онлайн-курс", "онлайн-школа", "вебінар для дітей", "дистанційно",
        "освітня платформа", "безкоштовний онлайн", "self-paced",
    ],
}

# ── Регіони пошуку ────────────────────────────────────────────────────────────
# Українські родини після 2022 розсіяні по Європі, і можливості для їхніх дітей
# публікуються місцевими мовами. Регіон — ОКРЕМИЙ вимір від теми: агент щодня
# бере пару (тема дня × регіон дня). Завдяки цьому додавання країн не розріджує
# тематичну ротацію, яка й так триває 151 день.
#
# `hint` — підказка моделі, якими мовами й формулюваннями шукати. Без неї
# пошук іде українською й на місцевих сайтах нічого не знаходить.

HOME_REGION: dict[str, str] = {
    "name": "Україна",
    "audience": "для дітей 0–18 років, які живуть в Україні",
    "hint": "шукай українською",
}

DIASPORA_REGIONS: list[dict[str, str]] = [
    {
        "name": "Польща",
        "audience": "для українських дітей 0–18, які живуть у Польщі",
        "hint": "шукай польською та українською: «dla dzieci z Ukrainy», "
                "«bezpłatne zajęcia», «półkolonie», «stypendia dla uczniów»",
    },
    {
        "name": "Німеччина",
        "audience": "для українських дітей 0–18, які живуть у Німеччині",
        "hint": "шукай німецькою: «für ukrainische Kinder», «kostenlos», "
                "«Ferienfreizeit», «Stipendium», «Willkommensklasse»",
    },
    {
        "name": "Чехія",
        "audience": "для українських дітей 0–18, які живуть у Чехії",
        "hint": "шукай чеською: «pro ukrajinské děti», «zdarma», «tábor», "
                "«stipendium», «kroužky»",
    },
    {
        "name": "Велика Британія",
        "audience": "для українських дітей 0–18, які живуть у Великій Британії",
        "hint": "шукай англійською: «for Ukrainian children», «free», "
                "«holiday club», «bursary», «youth programme»",
    },
    {
        "name": "Іспанія",
        "audience": "для українських дітей 0–18, які живуть в Іспанії",
        "hint": "шукай іспанською: «para niños ucranianos», «gratuito», "
                "«campamento de verano», «beca»",
    },
    {
        "name": "Італія",
        "audience": "для українських дітей 0–18, які живуть в Італії",
        "hint": "шукай італійською: «per bambini ucraini», «gratuito», "
                "«centro estivo», «borsa di studio»",
    },
    {
        "name": "Нідерланди",
        "audience": "для українських дітей 0–18, які живуть у Нідерландах",
        "hint": "шукай нідерландською: «voor Oekraïense kinderen», «gratis», "
                "«vakantiekamp», «beurs»",
    },
    {
        "name": "Румунія",
        "audience": "для українських дітей 0–18, які живуть у Румунії",
        "hint": "шукай румунською: «pentru copii ucraineni», «gratuit», "
                "«tabără», «bursă»",
    },
    {
        "name": "Словаччина",
        "audience": "для українських дітей 0–18, які живуть у Словаччині",
        "hint": "шукай словацькою: «pre ukrajinské deti», «zadarmo», «tábor», "
                "«štipendium», «krúžky»",
    },
    {
        "name": "Ірландія",
        "audience": "для українських дітей 0–18, які живуть в Ірландії",
        "hint": "шукай англійською: «for Ukrainian children Ireland», «free», "
                "«summer camp», «scholarship», «youth club»",
    },
]

# Україна чергується з кожною країною, тож лишається половиною всіх запусків —
# це основний продукт, а діаспора поки що перевірка гіпотези. Повний цикл —
# 20 днів: Україна через день, кожна країна раз на 20 днів.
REGION_ROTATION: list[dict[str, str]] = [
    r for country in DIASPORA_REGIONS for r in (HOME_REGION, country)
]

# Маркери аудиторії — «це про дитину 0–18». Допомагають match_categories/фільтрам
# відсіювати суто дорослий контент за потреби.
AUDIENCE_MARKERS: set[str] = {
    "дітей", "діти", "дитина", "дитячий", "дитяча", "школяр", "школярів",
    "учнів", "учні", "підлітк", "юних", "юний", "юна", "дошкільн", "молодш",
    "старшокласник", "0-18", "0–18", "до 18", "до 17", "від 14", "6-18",
    "7-18", "10-17", "for kids", "for teens", "youth", "teen",
}

# Сильні сигнали-можливості з попередніх наборів скраперів (щоб не втратити
# охоплення після переходу на спільний словник).
_EXTRA_SIGNALS: set[str] = {
    "можливість", "можливості", "стипендія", "грант", "програма", "навчання",
    "набір", "реєстрація", "вступ", "заявк", "безкоштовно", "unicef",
}

# Сигнали іноземними мовами — для діаспорних джерел (Google Alerts, місцеві
# сайти й групи в Польщі, Німеччині, Чехії тощо).
#
# Навіщо окремо, а не в KEYWORD_CATEGORIES: звідти discover_agent бере ТЕМИ
# ДНЯ для веб-пошуку, і пара «Німеччина × bezpłatne zajęcia» була б безглуздою.
# Тут ці слова потрібні лише для is_relevant() — щоб іншомовний допис узагалі
# дійшов до AI-нормалізатора, а не був відкинутий українським словником на вході.
#
# Фрази навмисне багатослівні: одиничне «free» чи «gratis» чіплялося б до
# будь-якого тексту, а підрядковий матчинг цього не розрізняє.
_DIASPORA_SIGNALS: set[str] = {
    # польська
    "dla dzieci", "dla uczniów", "dla młodzieży", "bezpłatne zajęcia",
    "bezpłatne warsztaty", "półkolonie", "kolonie letnie", "stypendium",
    "stypendia", "nabór", "zapisy trwają", "rekrutacja",
    # німецька
    "für kinder", "für schüler", "für jugendliche", "kostenlose angebote",
    "ferienfreizeit", "ferienprogramm", "anmeldung läuft",
    # чеська і словацька
    "pro děti", "pro žáky", "zdarma pro", "letní tábor", "kroužky pro",
    "pre deti", "zadarmo pre", "letný tábor", "krúžky pre", "štipendium",
    # англійська
    "for children", "for pupils", "for teenagers", "free activities",
    "free courses", "summer camp", "holiday club", "youth programme",
    "applications open", "scholarship for",
    # іспанська та італійська
    "para niños", "campamento de verano", "beca para", "talleres gratuitos",
    "per bambini", "centro estivo", "borsa di studio", "laboratori gratuiti",
    # румунська
    "pentru copii", "tabără de vară", "bursă pentru", "ateliere gratuite",
    # спільне — саме те, що шукатиме Alerts
    "ukrainian children", "dzieci z ukrainy", "ukrainische kinder",
    "ukrajinské děti", "copii ucraineni", "niños ucranianos",
}

# Плаский набір усіх слів для швидкого matching у is_relevant().
ALL_KEYWORDS: frozenset[str] = frozenset(
    kw for kws in KEYWORD_CATEGORIES.values() for kw in kws
) | _EXTRA_SIGNALS | _DIASPORA_SIGNALS


def _norm(text: str) -> str:
    return (text or "").lower()


def match_categories(text: str) -> list[str]:
    """Повертає список тематичних категорій (ключі KEYWORD_CATEGORIES), яких
    торкається текст. Порядок — як у KEYWORD_CATEGORIES."""
    low = _norm(text)
    return [cat for cat, kws in KEYWORD_CATEGORIES.items()
            if any(k in low for k in kws)]


def has_audience_marker(text: str) -> bool:
    low = _norm(text)
    return any(m in low for m in AUDIENCE_MARKERS)


def is_relevant(text: str) -> bool:
    """Чи схожий текст на можливість для дитини. True, якщо є будь-яке тематичне
    слово чи сильний сигнал. Остаточну фільтрацію робить AI-нормалізатор."""
    low = _norm(text)
    return any(k in low for k in ALL_KEYWORDS)
