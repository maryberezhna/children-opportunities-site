"""AI-нормалізація через Claude Haiku."""
import os
import hashlib
import re
import logging
from datetime import datetime
from typing import Optional
import anthropic
from slugify import slugify

import hubs
from canonical import canonical_url

logger = logging.getLogger(__name__)


class NormalizeError(Exception):
    """Тимчасовий збій екстракції (API, мережа) — сирець лишається в черзі
    й буде повторений. НЕ плутати з reject (return None): то остаточне
    «це не можливість», повторювати нема сенсу."""

# Сторінки, де на ОДНІЙ адресі живе багато різних можливостей, живуть тепер у
# `hubs` — єдиному джерелі правди, що читає таблицю `dedup_hub_urls`. Раніше
# список був захардкоджений тут і розійшовся з базою: два центри творчості
# були в таблиці, але не в коді.

# Values the DB will accept (mirrors the CHECK constraints on `opportunities`).
# The AI occasionally returns something off-list (e.g. deadline "квітень",
# cost_type "unknown") — those rows used to fail the whole upsert and get lost.
# We sanitise here so the opportunity still saves, just without the bad field.
VALID_COST_TYPES = {
    "free", "partially_free", "paid_affordable", "paid_premium", "subsidized",
}
VALID_OPP_TYPES = {
    "course", "workshop", "summer_school", "mentorship", "club", "camp",
    "study_program", "olympiad", "competition", "hackathon", "sport_tournament",
    "festival", "award", "exchange", "excursion", "residency", "scholarship",
    "grant", "allowance", "support_payment", "internship", "volunteer",
    "conference", "medical_aid", "psychology", "rehabilitation", "humanitarian",
    "legal_aid", "shelter", "educational_material",
}


def _sanitize(data: dict) -> dict:
    """Coerce AI output to values the DB accepts, so a bad field never sinks
    the whole record."""
    for key in ("deadline", "event_end_date"):
        val = data.get(key)
        if val:
            try:
                # Accepts "2026-4-5" too, normalises to "2026-04-05"; rejects word
                # dates like "квітень" / "abril 2024".
                data[key] = datetime.strptime(str(val).strip(), "%Y-%m-%d").date().isoformat()
            except ValueError:
                data[key] = None
    # Вік: у базі CHECK 0..18, а LLM іноді віддає верхню межу самої програми
    # («13–19 років» → age_to=19). Раніше такий запис падав на констрейнті і
    # ЗНИКАВ (так загубився набір WonderStage) — тепер просто підрізаємо до
    # нашого діапазону: програма для 13–19 лишається валідною для 13–18.
    for key, default in (("age_from", 0), ("age_to", 18)):
        try:
            val = int(data.get(key, default))
        except (TypeError, ValueError):
            val = default
        data[key] = max(0, min(18, val))
    if data["age_from"] > data["age_to"]:
        data["age_from"], data["age_to"] = data["age_to"], data["age_from"]

    # cost_type & deadline are nullable — drop unknown values to null.
    if data.get("cost_type") not in VALID_COST_TYPES:
        data["cost_type"] = None

    # Країни: лишаємо тільки відомі коди, решту мовчки викидаємо. Порожньо —
    # тоді None, а не «ua» за замовчуванням: діаспорний запис із невизначеною
    # країною краще побачити порожнім, ніж помилково приписаним Україні.
    raw_countries = data.get("countries") or []
    if isinstance(raw_countries, str):
        raw_countries = [raw_countries]
    countries = []
    for c in raw_countries:
        code = str(c).strip().lower()[:2]
        if code in VALID_COUNTRIES and code not in countries:
            countries.append(code)
    data["countries"] = countries or None
    # opportunity_type is NOT NULL, тож значення поза словником мусить чимось
    # стати — але НЕ мовчки: раніше невідомий тип тихо ставав «course» і
    # місклассифікація була невидимою. Тепер такий запис іде чернеткою в чергу
    # модерації з поміткою, а не в живий каталог.
    if data.get("opportunity_type") not in VALID_OPP_TYPES:
        data["opportunity_type"] = "course"
        data["status"] = "draft"
        data["admin_comment"] = (
            "auto: LLM віддав невідомий тип можливості — перевір тип перед публікацією"
        )
    return data


# Країни, де реально живуть українські родини — і куди їздять на програми.
# Коди ISO 3166-1 alpha-2 у нижньому регістрі. Список закритий НАВМИСНО:
# поле `categories` показало, що буде з вільним текстом від LLM — 200 значень
# чотирма мовами. Тут краще втратити рідкісну країну, ніж вокабуляр.
VALID_COUNTRIES = {
    "ua", "pl", "de", "cz", "sk", "hu", "ro", "md", "at", "ch",
    "it", "es", "fr", "nl", "be", "gb", "ie", "se", "no", "dk",
    "fi", "ee", "lv", "lt", "pt", "gr", "hr", "si", "bg", "tr",
    "ca", "us", "il", "jp", "au",
}

SYSTEM_PROMPT = """Ти аналізуєш тексти про можливості для УКРАЇНСЬКИХ ДІТЕЙ 0-18 років —
в Україні та за кордоном (Польща, Німеччина, Чехія та інші країни, де живуть
українські родини). Можливість за кордоном приймай, якщо вона доступна
українській дитині: для дітей з України/біженців або відкрита для всіх.

ТВОЇ ЗАВДАННЯ:
1. Визначити чи це КОНКРЕТНА можливість для дитини 0-18 (НЕ агрегатор і НЕ платформа)
2. Витягнути ТОЧНИЙ вік (age_from, age_to) з тексту
3. Класифікувати opportunity_type
4. Визначити cost_type
5. Витягнути child_needs якщо є (ВПО, сироти, інвалідність тощо)
6. Визначити countries — де саме можливість доступна дитині, кодами
   ISO alpha-2: Україна → ua, Польща → pl, Німеччина → de, Чехія → cz.
   Онлайн без прив'язки до місця → країна організатора. Країни в тексті
   немає і джерело українське → ["ua"]. НЕ вигадуй країну з назви мови.

ВІДХИЛЯЙ (confidence=0.0) якщо текст описує:
- АГРЕГАТОР або ПЛАТФОРМУ що збирає/показує інші можливості:
  ("куратована стрічка", "дайджест можливостей", "пошук можливостей",
   "індекс програм", "база можливостей", "curated opportunities",
   "opportunity finder", "digest", "newsletter", Studway, Idealist,
   Osvitoria, Osvita.ua як платформа, будь-який "пошук по базі")
- ЗАГАЛЬНУ ПРОГРАМУ без конкретних умов участі (просто опис організації)
- Можливість тільки для дорослих 18+ або тільки для студентів університетів

ПРАВИЛА:
- "для школярів" → age_from=7, age_to=17
- "старшокласники" → age_from=15, age_to=17
- "8-10 класи" → age_from=14, age_to=16
- "дошкільнята" → age_from=3, age_to=6
- Якщо для дорослих/студентів університету → confidence=0.1

deadline — ОСТАННІЙ ДЕНЬ ПОДАЧІ ЗАЯВКИ, формат YYYY-MM-DD:
- Є прямий дедлайн подачі («заявки до 5 серпня», «реєстрація триває до…»,
  «подати можна до…») → бери саме його.
- Є ЛИШЕ дати проведення діапазоном («13–16 серпня 2026», «з 3 по 20 липня»,
  «13-16 August») → бери ПЕРШУ дату діапазону, НІКОЛИ не останню. Подати
  заявку після того, як подія почалась, вже не можна, тож кінець діапазону
  як дедлайн — завжди помилка.
- Одна дата проведення («15 вересня») → бери її.
- Дедлайну немає, програма постійна або набір триває цілий рік → null.
- Рік не вказано → найближчий майбутній.

event_end_date — ОСТАННІЙ ДЕНЬ ПРОВЕДЕННЯ датованої події (табір, фестиваль,
табірна зміна, фінал конкурсу, обмін), формат YYYY-MM-DD:
- Діапазон дат проведення («13–16 серпня 2026») → ОСТАННЯ дата діапазону.
- Одна дата проведення → вона ж.
- Постійна програма, гурток, курс без конкретних дат → null.
Дата «сьогодні» вказана в повідомленні. Якщо подія вже ЗАВЕРШИЛАСЬ або дедлайн
у минулому — це НЕ актуальна можливість: enrollment_status=expired.

Типи opportunity_type:
course, olympiad, competition, club, exchange, camp, scholarship,
allowance, grant, festival, medical_aid, psychology, rehabilitation,
humanitarian, internship, volunteer

Типи cost_type:
free, partially_free, paid_affordable, paid_premium, subsidized

child_needs — познач УСІ групи, яким адресована або яких прямо стосується
програма (не лише коли це єдина цільова група):
- idp — ВПО, внутрішньо переміщені, переселенці
- disability — інвалідність, ООП, інклюзія, ДЦП, порушення слуху/зору
- orphan — сироти, під опікою, позбавлені батьківського піклування
- veteran_family — діти ветеранів, загиблих/полеглих захисників, «Діти Героїв»
- oncology — онкозахворювання, лейкоз, пухлини
- low_income — малозабезпечені, незаможні, соціально незахищені
- gifted — обдаровані, талановиті
Якщо в тексті перелік пільгових категорій (напр. «ВПО, діти військових,
малозабезпечені, сироти») — постав ВСІ відповідні теги.

aid_type — ЛИШЕ для ДЕРЖАВНОЇ допомоги (держоргани: ПФУ, Мінсоцполітики,
Мінмолодьспорту, Держслужба зайнятості, easy.gov.ua, обласні/міські
адміністрації, програми за постановами КМУ). Обери РІВНО ОДИН:
- cash — грошова виплата/допомога родині (народження, усиновлення, ВПО,
  багатодітним, на дитину)
- scholarship — соціальна стипендія від держави
- recreation — безкоштовне державне оздоровлення / путівки до таборів
- free_activities — безкоштовні державні секції, гуртки, спортклуби
  (Мінмолодьспорту, «Активні Парки»)
- vocational — державне проф. навчання / профорієнтація / зайнятість молоді
Якщо це НЕ державна програма (приватна, NGO, міжнародна, бізнес) →
aid_type = null.

enrollment_status — стан набору за текстом: якщо на сторінці «реєстрацію
завершено», «набір закрито», «прийом заявок припинено» чи дедлайн у минулому —
closed/expired. Це головний сигнал актуальності: сторінка може бути жива,
а набір — ні.

Поверни JSON через extract_opportunity."""


EXTRACT_TOOL = {
    "name": "extract_opportunity",
    "description": "Витягує дані про можливість для дитини",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "summary": {"type": "string", "maxLength": 400},
            "age_from": {"type": "integer", "minimum": 0, "maximum": 18},
            "age_to": {"type": "integer", "minimum": 0, "maximum": 18},
            "opportunity_type": {"type": "string"},
            "categories": {"type": "array", "items": {"type": "string"}},
            "child_needs": {"type": "array", "items": {"type": "string"}},
            "aid_type": {
                "type": ["string", "null"],
                "enum": ["cash", "scholarship", "recreation",
                         "free_activities", "vocational", None],
                "description": "Вид державної допомоги (лише для держпрограм), "
                               "інакше null",
            },
            "countries": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Країни, де можливість доступна дитині. Коди "
                               "ISO 3166-1 alpha-2 у нижньому регістрі: ua, pl, "
                               "de, cz… Якщо в тексті країна не названа і "
                               "джерело українське — [\"ua\"].",
            },
            "format": {"type": "string"},
            "cost_type": {"type": "string"},
            "deadline": {
                "type": ["string", "null"],
                "description": "Останній день подачі заявки, YYYY-MM-DD. "
                               "Для діапазону дат проведення — ПЕРША дата, "
                               "не остання. Немає дедлайну → null.",
            },
            "event_end_date": {
                "type": ["string", "null"],
                "description": "Останній день ПРОВЕДЕННЯ датованої події, "
                               "YYYY-MM-DD. Для діапазону — ОСТАННЯ дата. "
                               "Постійна програма без дат → null.",
            },
            "enrollment_status": {
                "type": "string",
                "enum": ["open", "closed", "expired", "unknown"],
                "description": "Стан набору ЗА ТЕКСТОМ сторінки: open — подача "
                               "триває або нема ознак закриття; closed — «набір "
                               "завершено», «реєстрацію закрито», зникла форма; "
                               "expired — дедлайн у тексті вже минув; "
                               "unknown — не зрозуміло.",
            },
            "confidence": {"type": "number"},
        },
        "required": ["title", "summary", "age_from", "age_to",
                     "opportunity_type", "cost_type", "enrollment_status",
                     "confidence"],
    },
}


class Normalizer:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = "claude-haiku-4-5-20251001"
        # Помилки API збираємо, щоб денний звіт показав їх окремим блоком.
        # Без цього «0 збережено» два тижні виглядало як норма, поки насправді
        # кожен виклик падав із «credit balance too low».
        self.api_failures = 0
        self.last_api_error = None

    def normalize(self, raw_text: str, source: str, source_url: str,
                  raw_title: Optional[str] = None) -> Optional[dict]:
        try:
            today_iso = datetime.utcnow().date().isoformat()
            user_msg = f"""Сьогодні: {today_iso}
Джерело: {source}
URL: {source_url}
Заголовок: {raw_title or '(немає)'}

ТЕКСТ:
{raw_text[:6000]}

Витягни дані через extract_opportunity."""

            response = self._call_api(user_msg)

            tool_use = next(
                (b for b in response.content
                 if b.type == "tool_use" and b.name == "extract_opportunity"),
                None
            )
            if not tool_use:
                return None

            data = tool_use.input
            if data.get("confidence", 0) < 0.5:
                logger.info(f"Low confidence, skipping: {source_url}")
                return None

            data = _sanitize(dict(data))
            title = data["title"]
            data["slug"] = self._make_slug(title, source)
            data["content_hash"] = self._make_hash(title, source_url)
            data["source"] = source
            data["source_url"] = source_url
            data["canonical_url"] = canonical_url(source_url)
            data.pop("confidence", None)

            # Стан набору за текстом сторінки: закрито/протерміновано → запис
            # одразу closed, а не «активний до ручної перевірки». Колонки
            # enrollment_status в базі немає — сигнал мапиться на status.
            enrollment = data.pop("enrollment_status", "unknown")
            if enrollment in ("closed", "expired") and data.get("status") != "draft":
                data["status"] = "closed"

            # Дати в минулому — запобіжник, незалежний від LLM: подія, що вже
            # відбулась, або дедлайн, що минув, не сміють дати active-запис
            # (кейс «ATLAS Weekend висів активним через місяць після події»).
            for key in ("deadline", "event_end_date"):
                v = data.get(key)
                if v and v < today_iso and data.get("status") != "draft":
                    data["status"] = "closed"

            # Симетрія: відкритий набір без минулих дат ОЖИВЛЯЄ авто-закритий
            # запис — так сезонна перевірка (recheck_at через ~11 місяців)
            # повертає торішні фестивалі/табори з новою програмою. Модераторські
            # записи захищає verified_at у db.upsert_opportunity.
            if enrollment == "open" and "status" not in data:
                data["status"] = "active"

            return data

        except Exception as e:
            logger.error(f"Normalize failed for {source_url}: {e}")
            self.api_failures += 1
            self.last_api_error = str(e)[:300]
            raise NormalizeError(str(e)[:300]) from e

    def _call_api(self, user_msg: str):
        """Виклик Haiku з retry: 429/5xx/таймаути — тимчасові, пробуємо ще
        двічі з паузою. Помилки біллінгу і 4xx не ретраяться — це не лікується
        повтором, лише палить час усього нічного запуску."""
        import time as _time
        last_exc = None
        for attempt in range(3):
            try:
                return self.client.messages.create(
                    model=self.model,
                    max_tokens=1500,
                    system=SYSTEM_PROMPT,
                    tools=[EXTRACT_TOOL],
                    tool_choice={"type": "tool", "name": "extract_opportunity"},
                    messages=[{"role": "user", "content": user_msg}],
                )
            except anthropic.APIStatusError as e:
                if e.status_code not in (429, 500, 502, 503, 529):
                    raise
                last_exc = e
            except (anthropic.APIConnectionError, anthropic.APITimeoutError) as e:
                last_exc = e
            _time.sleep(2 * (attempt + 1))
        raise last_exc

    @staticmethod
    def _make_slug(title: str, source: str) -> str:
        base = slugify(title, max_length=80, word_boundary=True)
        short_hash = hashlib.md5(f"{title}{source}".encode()).hexdigest()[:6]
        return f"{base}-{short_hash}"

    @staticmethod
    def _make_hash(title: str, url: str) -> str:
        """Ключ дедуплікації (upsert on_conflict=content_hash).

        Раніше ключ був title+url — і не працював: назву генерує LLM, тож для
        того самого джерела вона щоразу інша («uBoost Career», «uBoost Career —
        державна програма профорієнтації та навичок для молоді», «uBoost Career
        — державна програма для молоді»). Кожен варіант давав новий хеш і новий
        рядок. У базі назбиралось 8 копій uBoost і 7 українсько-польських
        обмінів.

        Поріг за схожістю назв тут не рятує — виміряно на реальних даних:
            справжні дублі   0.32 – 0.87
            різні можливості 0.42 – 0.94
        «олімпіада з біології» vs «з екології» дає 0.94 і це РІЗНЕ, а
        «uBoost Career» vs його ж довга назва — 0.32 і це ОДНЕ. Діапазони
        перекриваються, отже жоден поріг не розділить.

        Тому ключ — сам URL: він стабільний. Виняток — сторінки-хаби, де на
        одній адресі справді живе багато різних можливостей (перелік олімпіад
        МОН, каталог послуг Дії). Для них лишаємо title+url.
        """
        if hubs.is_hub(url):
            normalized = re.sub(r"[^\w\s]", "", title.lower())
            normalized = re.sub(r"\s+", " ", normalized).strip()
            return hashlib.sha256(f"{normalized}|{url}".encode()).hexdigest()[:16]
        return hashlib.sha256(url.encode()).hexdigest()[:16]
