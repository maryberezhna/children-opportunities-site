"""Чи сторінка — можливість, на яку можна потрапити, а не стаття про неї.

Привід (Марія, 11.10.2026): у канал і на сайт сама вийшла «Школа юного
дипломата». Джерело — новина КМАН «Триває курс…» про заняття для наявних
вихованців студії: «Ось як проходили зустрічі… Дякуємо всім учасникам… До
наступних зустрічей щосереди». Набору, віку, контактів на сторінці немає.
Нормалізатор переказав звіт як «курс, заняття щосереди», а суддя бачив лише
цей переказ — і погодився.

Звідси три ворота перед самопублікацією (auto_review):
  • дія — на сторінці є хоч одна ознака, як потрапити: посилання на подачу,
    слова «заявка», «реєстрація», «набір», форма, пошта чи телефон біля слів
    про участь. Немає — запис лишається чернеткою для людини;
  • звіт — адреса новини (/novyny/, /news/, /blog/…) разом із формулами звіту
    («ось як проходили», «дякуємо всім учасникам», «для вихованців студії»);
  • зламана розмітка моделі в описі (`</summary><parameter name="age_from">7`
    у тій самій «Школі») — такий запис у брак.

Модуль чистий: мережа окремо (fetch_page), щоб ознаки тестувались без інтернету.
"""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

# ── Зламана розмітка моделі ────────────────────────────────────────────────
# Модель інколи дописує в текстове поле шматок власного виклику інструмента.
_BROKEN_MARKUP = re.compile(
    r"</?\s*(?:summary|details|title|parameter|invoke|function_calls|antml:[a-z_]+)\b"
    r"|<parameter\s+name=", re.I)


def broken_markup(*texts) -> bool:
    """Чи є в тексті службові теги моделі."""
    return any(_BROKEN_MARKUP.search(t or "") for t in texts)


# ── Дія: як потрапити ──────────────────────────────────────────────────────
# Слова, після яких людина знає, що робити. Корені, щоб ловити відмінки:
# «заявку», «реєстрації», «зареєструватися», «записатися», «подати».
_ACTION_WORDS = re.compile(
    r"заявк|реєстрац|зареєстр|набір\b|набор|оголошу\w* набір|запис(?:ат|уй|ув|ує)|"
    r"\bпода(?:ти|ння|ча|чі|йте)\b|анкет|приймаю\w* (?:заявк|робот|документ)|"
    r"надісла\w* (?:заявк|робот)|долучит\w*|приєдн\w*|розпочати|почати навчання|"
    r"запрошу(?:ємо|є)\b|вступ\w*|прийом (?:дітей|учнів|до)|зарахуванн|"
    # Ціна чи кількість місць — гурток, куди можна прийти й заплатити
    # (Осередок у Лейпцигу: «Вартість на місяць — 30 €, макс. 8 учасників»).
    r"вартість|кількість (?:місць|учасників)|"
    # іноземні сторінки: подача з України чи для дітей за кордоном
    r"\bapply\b|\bapplication|\bregist(?:er|ration)|\bsign[\s-]?up\b|\benrol|\bjoin\b|\bopen to\b|"
    r"zgłosz|rejestrac|zapis(?:y|z)|anmeld|bewerb|přihl|registrace",
    re.I)

# Google-форма, Typeform, Jotform — сама адреса форми і є дією.
_FORM_URL = re.compile(
    r"forms\.gle/|docs\.google\.com/forms|typeform\.com|jotform|tally\.so|"
    r"forms\.office\.com|airtable\.com/(?:shr|app)", re.I)

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?:\+?38)?\s*\(?0\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\+\d{2,3}[\s\d-]{8,}")
# Пошта чи телефон — дія лише поруч зі словами про участь: у підвалі кожного
# сайту стоїть «Телефон приймальні», і він нічого не каже про набір.
_CONTACT_CONTEXT = re.compile(
    r"участ|запис|детал|дізнат|звертай|звертат|телефонуй|пиши|пишіть|питання|"
    r"консультац|інформаці\w* за|контакт\w* для|реєстр|заявк", re.I)
_NEAR = 160


def action_quote(text: str | None, apply_url: str | None = None) -> str | None:
    """Шматок сторінки, з якого видно, як потрапити, або None."""
    if (apply_url or "").strip():
        return f"посилання на подачу: {apply_url.strip()}"
    text = text or ""
    m = _FORM_URL.search(text)
    if m:
        return _around(text, m.start(), m.end())
    m = _ACTION_WORDS.search(text)
    if m:
        return _around(text, m.start(), m.end())
    for rx in (_EMAIL, _PHONE):
        for m in rx.finditer(text):
            lo, hi = max(0, m.start() - _NEAR), m.end() + _NEAR
            if _CONTACT_CONTEXT.search(text[lo:hi]):
                return _around(text, m.start(), m.end())
    return None


# ── Звіт про подію замість можливості ──────────────────────────────────────
_NEWS_URL = re.compile(
    r"/(?:novyny|novyni|novini|novosti|news|blog|blogs|post|posts|statti|stattia|"
    r"article|articles|publications|publikatsii|podii|events-report)(?:/|-|$)", re.I)

# Формули, якими пишуть ЗВІТ: про те, що вже було, і про тих, хто вже
# всередині. «Для вихованців студії» — закрита група: зі сторінки не видно,
# що чужа дитина може прийти.
_REPORT_PHRASES = re.compile(
    r"ось як (?:прохо|минул|це було|відбул)|дякуємо (?:всім|усім) (?:учасник|за участь)|"
    # Лише «відбувся/відбулася…»: «пройшли відбір» чи «завершили 9 клас»
    # стоять і в чесних оголошеннях набору.
    r"відбу(?:вся|лася|лося|лись|лися)\s|"
    r"для (?:наших |своїх )?(?:вихованців|учнів нашо|гуртківців|членів клубу)|"
    r"наші (?:юні )?(?:учасники|вихованці) (?:продовжують|взяли|стали|здобули)|"
    r"до наступних зустрічей|фоторепортаж|фотозвіт|підсумки (?:конкурсу|фестивалю|табору)|"
    r"вітаємо переможц|нагородили переможц",
    re.I)


def report_reason(url: str | None, text: str | None) -> str:
    """Чому сторінка схожа на звіт про подію, або порожній рядок.

    Потрібні обидві ознаки: адреса новини І щонайменше дві різні формули
    звіту. Лише адреса — мало: МОН і МАН оголошують конкурси саме новинами.
    Одна формула — теж: анонс School of Resilience згадує, що минулий заїзд
    «відбувся», і все одно відкриває реєстрацію. У звіті КМАН їх чотири.
    """
    if not _NEWS_URL.search(url or ""):
        return ""
    found = []
    for m in _REPORT_PHRASES.finditer(text or ""):
        frag = m.group(0).strip().lower()
        if frag not in found:
            found.append(frag)
        if len(found) == 2:
            break
    if len(found) < 2:
        return ""
    return "схоже на звіт, а не на набір: " + ", ".join(f"«{f}»" for f in found)


def _around(text: str, start: int, end: int, pad: int = 60) -> str:
    lo, hi = max(0, start - pad), min(len(text), end + pad)
    return " ".join(text[lo:hi].split())


# ── Мережа ─────────────────────────────────────────────────────────────────
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")


def fetch_page(url: str, limit: int = 20000) -> tuple[str | None, str]:
    """(текст сторінки, причина). Текст None — не прочитали: тоді вирішує людина."""
    try:
        with httpx.Client(timeout=20, follow_redirects=True,
                          headers={"User-Agent": UA, "Accept-Language": "uk,en;q=0.8"}) as c:
            r = c.get(url)
    except Exception as e:                                   # noqa: BLE001
        return None, f"не відповів: {type(e).__name__}"
    if r.status_code >= 400:
        return None, f"HTTP {r.status_code}"
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "svg", "noscript"]):
        tag.decompose()
    # Посилання на форму часто лише в href — дописуємо адреси в текст.
    hrefs = " ".join(a.get("href", "") for a in soup.find_all("a") if _FORM_URL.search(a.get("href", "")))
    text = " ".join(soup.get_text(" ").split())
    if len(text) < 200:
        return None, f"порожня сторінка ({len(text)} символів)"
    return (f"{text} {hrefs}".strip())[:limit], f"HTTP {r.status_code}"
