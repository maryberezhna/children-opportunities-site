"""Шар сирих знахідок (raw_items) — між скрапером і LLM-екстракцією.

Навіщо. Раніше знахідки йшли зі скрапера прямо в Haiku, і будь-який збій
(429, вичерпані кредити, таймаут) означав мовчазну втрату: пост у каналі чи
RSS-вікно вже не повернуться. Тепер усе знайдене спершу лягає в raw_items,
а екстракція читає чергу pending — включно з учорашніми невдахами.

Другий ефект — хеш-гейт: та сама сторінка з незмінним вмістом має той самий
content_hash і вставляється лише раз (on_conflict do nothing), тож LLM більше
не переекстрагує весь каталог щодня. Платимо лише за нове і змінене.
"""
import re
import hashlib
import logging

from canonical import canonical_url

logger = logging.getLogger(__name__)

# Скільки спроб екстракції дати одному сирцю, перш ніж чесно здатись.
MAX_ATTEMPTS = 5


def is_usage_limit(error) -> bool:
    """Чи це вичерпаний ліміт витрат API, а не проблема самого сирця.

    14.09.2026 API відповів «You have reached your specified API usage limits.
    You will regain access on 2026-10-01». Екстракція зупинялась після п'яти
    збоїв поспіль, але кожного разу списувала спробу п'яти найстарішим сирцям:
    за два з половиною тижні близько 60 знахідок стали б failed назавжди —
    хоча з ними все гаразд, просто API був недоступний."""
    return "usage limit" in str(error).lower()


def _clean(value):
    """Прибирає символи, яких Postgres не приймає в text.

    Нульовий байт трапляється в сирому HTML — і вставка падає цілком:
    «22P05: \u0000 cannot be converted to text». Знахідка при цьому просто
    зникала (30.08 так загубився «Smile Fest»), причому мовчки: помилка
    писалась у лог, а скрапер рахував себе успішним. Чистимо вміст, а не
    відкидаємо запис — текст від цього не страждає, бо NUL там і так сміття.
    """
    if not isinstance(value, str):
        return value
    return value.replace("\x00", "")


PUBLISHED_PREFIX = "Дата публікації: "


def with_published(text: str, published) -> str:
    """Перший рядок сирця — дата публікації допису, якщо джерело її знає.

    До 17.09.2026 скрапери Telegram, RSS та Instagram читали дату допису лише
    щоб відсіяти старе, а в текст для моделі вона не потрапляла. Модель брала
    «сьогодні» за день розмітки, і «до 20 серпня» в пості від 15 серпня, який
    розмітили в вересні, отримувало не той рік (аудит «Дедлайн, подія, сезон», С5).
    """
    if not published:
        return text
    return f"{PUBLISHED_PREFIX}{published.date().isoformat()}\n\n{text}"


def raw_hash(source_url: str, raw_text: str) -> str:
    return hashlib.sha256(f"{source_url}|{raw_text}".encode()).hexdigest()[:32]


def store_raw_items(client, source_name: str, raw_items: list[dict]) -> int:
    """Записує знахідки скрапера в raw_items. Повертає кількість НОВИХ
    (раніше не бачених) — це і є сигнал «джерело змінилось» для реєстру."""
    new_count = 0
    for raw in raw_items:
        text = _clean(raw.get("raw_text") or "").strip()
        url = _clean(raw.get("source_url") or "").strip()
        if not text:
            continue
        row = {
            "source_name": _clean(raw.get("source", source_name)),
            "source_url": url or None,
            "canonical_url": canonical_url(url),
            "raw_title": _clean(raw.get("raw_title")),
            "raw_text": text,
            "content_hash": raw_hash(url, text),
        }
        try:
            result = (
                client.table("raw_items")
                .upsert(row, on_conflict="content_hash", ignore_duplicates=True)
                .execute()
            )
            if result.data:
                new_count += 1
        except Exception as e:
            logger.error(f"raw_items insert failed ({source_name}): {e}")
    return new_count


def fetch_pending(client, limit: int = 300) -> list[dict]:
    """Черга на екстракцію: найстаріші перші, з обмеженням спроб.
    Ліміт тримає вартість одного запуску передбачуваною — хвіст дочекається
    наступного запуску."""
    try:
        result = (
            client.table("raw_items")
            .select("id, source_name, source_url, raw_title, raw_text, attempts, review_verdict")
            .eq("status", "pending")
            .lt("attempts", MAX_ATTEMPTS)
            .order("fetched_at")
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"fetch_pending failed: {e}")
        return []


# Тендер чи вакансія в ЗАГОЛОВКУ — не можливість для дитини. Такий сирець
# ішов у модель лише для того, щоб вона відповіла «ні»: за весь час 80 таких
# заголовків, прийнятих 0 (21.09.2026, звірено з raw_items). Дивимось лише на
# заголовок: у тексті справжнього гранту «кошти можна використати на
# закупівлю обладнання» — це мета витрат, а не тендер.
_NOT_AN_OPPORTUNITY_TITLE = re.compile(r"закупівл|тендер|ваканс|цінових пропозиц", re.IGNORECASE)


def not_an_opportunity(raw_title: str) -> bool:
    return bool(_NOT_AN_OPPORTUNITY_TITLE.search(raw_title or ""))


# ── Головна сторінка, яка вже показала, що нічого не дає ────────────────────
# Заміри 24.09.2026 по всій історії raw_items:
#   сторінка зі шляхом   2 483 → 1 337 записів (54%), 2 444 тис. знаків
#   URL без шляху          321 →    21 (6.5%),        1 057 тис. знаків
# Тобто головні сторінки — 30% усього, що ми віддали моделі, і 1.5% користі.
# Причина видна в одному рядку: kmstudio.com.ua прочитано 23 рази за 30 днів,
# ureport.in — 24, mms.gov.ua — 24, і щоразу з новим хешем (головна щодня
# інша), тож хеш-гейт їх не спиняв. Жодна не дала запису.
#
# Але ЗАБОРОНЯТИ головні сторінки не можна: ProCamp, Docudays, Atlas Weekend,
# Гоголь-fest, English Camp Ukraine прийшли саме так — з першого читання
# головної. Тому правило про повтор, а не про адресу: перше читання
# пропускаємо завжди, друге й наступні — лише якщо перше щось дало.
_HOMEPAGE = re.compile(r"^https?://[^/]+/?$", re.IGNORECASE)


def is_homepage(url: str) -> bool:
    return bool(_HOMEPAGE.match((url or "").strip()))


def homepage_wasted(rows: list) -> bool:
    """Чи цю головну вже читали намарно. Чиста функція — під тести.

    `rows` — попередні raw_items із тією самою канонічною адресою. Хоч один
    із них став записом — сторінка робоча, читаємо далі.
    """
    return bool(rows) and not any(r.get("opportunity_id") for r in rows)


def homepage_already_failed(client, item: dict) -> int:
    """Скільки разів головну цього домену вже читали намарно (0 = читаємо).

    Помилка запиту → 0: ворота не сміють зупинити екстракцію власним збоєм.
    """
    url = (item.get("canonical_url") or item.get("source_url") or "").strip()
    if not is_homepage(url):
        return 0
    try:
        rows = (
            client.table("raw_items")
            .select("id, opportunity_id")
            .eq("canonical_url", url)
            .neq("id", item["id"])
            .limit(50)
            .execute()
            .data
        ) or []
    except Exception as e:
        logger.error(f"homepage_already_failed failed: {e}")
        return 0
    return len(rows) if homepage_wasted(rows) else 0


def mark(client, raw_id: str, status: str, *, error: str = None,
         opportunity_id: str = None, attempts: int = None,
         confidence: float = None, reason_code: str = None) -> None:
    """`confidence` і `reason_code` — машинні поля відбору (20.09.2026).

    Доти обидва жили текстом усередині last_error, і тому відбір неможливо
    було виміряти: ні порахувати accept-rate по джерелу, ні побачити, де
    класифікатор вагається. Тепер це колонки, а last_error лишається людським
    поясненням.
    """
    from datetime import datetime, timezone
    patch = {"status": status}
    if confidence is not None:
        patch["confidence"] = confidence
    if reason_code is not None:
        patch["reject_reason"] = reason_code
    if status in ("processed", "rejected", "failed"):
        patch["processed_at"] = datetime.now(timezone.utc).isoformat()
    if error is not None:
        patch["last_error"] = error[:500]
    if opportunity_id is not None:
        patch["opportunity_id"] = opportunity_id
    if attempts is not None:
        patch["attempts"] = attempts
    try:
        client.table("raw_items").update(patch).eq("id", raw_id).execute()
    except Exception as e:
        logger.error(f"raw_items mark failed ({raw_id} → {status}): {e}")


def bump_attempt(client, raw_item: dict, error: str) -> None:
    """Невдала екстракція: +1 спроба. Вичерпали MAX_ATTEMPTS → failed
    (потрапить у денний звіт), інакше лишається pending на наступний запуск."""
    attempts = (raw_item.get("attempts") or 0) + 1
    status = "failed" if attempts >= MAX_ATTEMPTS else "pending"
    mark(client, raw_item["id"], status, error=error, attempts=attempts)


# Сіра смуга класифікатора: не «ні», а «не впевнений».
#
# Межі 0.25–0.55 (20.09.2026): нижче — переважно справжній шум (анонси
# організацій, архіви), вище — модель і так пропускає. За місяць під це
# підпадає близько 70 записів, тобто ~2 на добу — стільки людина розбере.
#
# Сенс не в числах, а в тому, що рідкісне закордонне часто описане скупо, і
# саме на ньому модель вагається. Раніше такі записи зникали мовчки.
GREY_LOW = 0.25
GREY_HIGH = 0.55


# Слово про того, для кого можливість. Карантин — черга ЛЮДИНИ, і в ній має
# лежати лише те, що бодай може виявитись дитячим.
#
# 23.09.2026 Марія відкрила чергу й побачила «Дякуємо, що пройшли цей квіз»,
# «#освіта», «Київ», «Yoga with an American» і Erasmus+ для студентів: «нас
# приходить якийсь смітник». Модель на такому вагається (0,25–0,55), і сіра
# смуга чесно клала все це їй на стіл.
#
# Перевірка стоїть ЛИШЕ на сумнівній купі — на тому, що екстракція вже не
# пропустила. Усе, що модель витягла впевнено, її не бачить: на 1 339 уже
# опублікованих записів це правило не впливає (перевірено на базі 23.09.2026,
# зокрема гуртки ЦПР і Eurodesk, де слова «діти» в сирому тексті немає).
CHILD_MARKER = re.compile(
    r"дітей|дитин|дитяч|підліт|школяр|школи|школа|учн|юнац|клас|"
    r"молод|teen|kid|child|pupil|student|youth|"
    r"\d{1,2}\s*[–—-]\s*\d{1,2}\s*рок",
    re.IGNORECASE)

NOT_FOR_CHILDREN = "у тексті нічого про дітей, підлітків, школу чи вік"


def triage_status(reason_code: str | None, confidence: float | None,
                  text: str = None) -> str:
    """'review' для сірої смуги, інакше 'rejected'. Чиста функція — під тест.

    `text` — сирий текст сторінки. Якщо в ньому немає жодного слова про
    дитину, вік чи школу, запис не потрапляє в чергу людини навіть із сірої
    смуги: розбирати там нічого. Без тексту (старі виклики) поводиться як досі.
    """
    if reason_code != "low_confidence" or confidence is None:
        return "rejected"
    if not (GREY_LOW <= confidence < GREY_HIGH):
        return "rejected"
    if text is not None and not CHILD_MARKER.search(text):
        return "rejected"
    return "review"
