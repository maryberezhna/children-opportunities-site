"""Підключення до Supabase."""
import os
import logging
import re
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# Поля, які повторна розмітка не сміє затерти порожнім. Їх заповнюють не лише
# з тексту сторінки: дати й вид ставить планова перевірка (lifecycle.py) і
# перерозмітка (remark.py, classify_timing.py), details і apply_url — remark.
# До 17.09.2026 зміна сторінки джерела перезаписувала запис усіма ключами,
# включно з None, і все це мовчки зникало (аудит «Дедлайн, подія, сезон», С6).
KEEP_IF_KNOWN = (
    "deadline", "event_start_date", "event_end_date", "recurrence",
    "timing_kind", "season_months", "details", "apply_url", "price_note",
)
EXISTING_FIELDS = ("id, verified_at, status, timing_assumed, evidence, age_from, age_to, "
                   + ", ".join(KEEP_IF_KNOWN))


def merge_patch(existing: dict, record: dict) -> dict:
    """Що писати в наявний (не схвалений людиною) запис. Чиста функція — під тести.

    • slug не міняється ніколи: це URL, що вже живе в Telegram і Google;
    • відоме значення не затирається порожнім;
    • статус лише закривається: «закрито» зі сторінки приймаємо, а повертати
      закритий чи чернетку в active розмітка не може. Закритий модератором
      («пропустити» не ставить verified_at) інакше сам ожив би, щойно на
      сторінці змінився текст; повернення сезону — справа планової перевірки.
    """
    patch = {k: v for k, v in record.items() if k != "slug"}
    # Цитати зливаються по ключах: нова перевірка може підтвердити вартість,
    # а про вік мовчати — торішня цитата про вік лишається.
    if "evidence" in patch:
        old_ev = existing.get("evidence") if isinstance(existing.get("evidence"), dict) else {}
        new_ev = patch["evidence"] if isinstance(patch["evidence"], dict) else {}
        patch["evidence"] = {**old_ev, **{k: v for k, v in new_ev.items() if v}}
    for key in KEEP_IF_KNOWN:
        if key in patch and patch[key] in (None, "", []) and existing.get(key) not in (None, "", []):
            patch.pop(key)
    # Технічний 0–18 не затирає вже названий вік. Ворота правди (23.09.2026)
    # знімають вік, на який немає цитати зі сторінки, — і без цього
    # запобіжника перша ж повторна розмітка стерла б вік у сотнях записів,
    # які вже стоять на сайті. Фільтр «скільки років дитині» показав би їх
    # усім підряд. Зняти здогад із тих записів — окрема, видима робота, а не
    # побічний ефект розмітки.
    if patch.get("age_from") == 0 and patch.get("age_to") == 18 \
            and (existing.get("age_from"), existing.get("age_to")) not in ((0, 18), (None, None)):
        patch.pop("age_from", None)
        patch.pop("age_to", None)
    if "status" in patch and patch["status"] != "closed" and existing.get("status"):
        patch.pop("status")
    # Архів (прибрані неперевірні гуртки, 21.09.2026) розмітка не чіпає зовсім:
    # «закрито» зі сторінки зробило б із прихованого запису публічну сторінку.
    if "status" in patch and existing.get("status") == "archived":
        patch.pop("status")
    # Здогад про вид у часі можна лише зняти. Якщо планова перевірка вже
    # підтвердила постійність цитатою, повторна розмітка не сміє знову
    # назвати її припущенням — інакше запис вічно ходив би по колу.
    if patch.get("timing_assumed") and existing.get("timing_assumed") is False \
            and existing.get("timing_kind"):
        patch.pop("timing_assumed")
    return patch


# ── Та сама школа діаспори з двох джерел (28.09.2026) ────────────────────────
#
# Рішення Марії: суботня чи недільна школа за кордоном — ОДНА постійна картка.
# Але ту саму школу приносять різні конвеєри: каталог МІОК (сторінка
# vsesvit.miok.lviv.ua/schools/N) і пряме джерело — сайт чи стрічка самої
# школи. Адреси різні, тож жоден із трьох ключів upsert (content_hash, slug,
# canonical_url + назва) цієї пари не бачить. find_dup_candidates бачить, але
# лише коли ОБИДВА записи вже активні: чернетка МІОК, що чекає вартості, і
# готовий запис із сайту школи мали б дві картки на сайті в момент, коли
# людина схвалить першу.
#
# Ключ школи — країна + власна назва в лапках («Берегиня», "Джерело") + місто.
# Місто обовʼязкове для порівняння: у Нідерландах у каталозі дві різні школи
# «Джерело» — в Амстердамі й в Алмере. Без власної назви («Українська
# суботня школа в Берліні») збігом вважаємо лише однакову назву цілком І
# спільне місто: у Берліні таких шкіл кілька.
SCHOOL_TYPES = ("club", "course", "study_program")
MIOK_SOURCE = "Освітній Всесвіт (МІОК)"
# Реєстр МОН «Осередки за кордоном» (28.09.2026) — теж посередник між
# родиною і школою: сайт самої школи бʼє і його чернетку.
MON_CELLS_SOURCE = "Реєстр осередків за кордоном (МОН, aikom.iea.gov.ua)"
AGGREGATOR_SOURCES = (MIOK_SOURCE, MON_CELLS_SOURCE)
_SCHOOL_WORD = re.compile(r"школ|садоч|центр|студі|академі|гімназі|ліце|простір", re.I)
_QUOTED_NAME = re.compile(r"[«\"„“”]\s*([^«»\"„“”]{3,80}?)\s*[»\"“”]")
_NOT_CITIES = {"онлайн", "вся україна", "міжнародні", "україна"}


def _letters(text) -> str:
    return re.sub(r"[^0-9a-zа-яіїєґ]+", "", (text or "").lower().replace("ʼ", "").replace("'", ""))


def school_key(rec: dict) -> tuple | None:
    """(країна, власна назва, уся назва) для запису-школи за кордоном, або None.

    Лише школи: тип гурток/курс/навчальна програма І слово «школа», «садочок»,
    «центр», «студія» в назві. Конкурс чи табір тієї самої школи — окрема
    можливість, їх не чіпаємо. Чиста функція — під тести.
    """
    if rec.get("opportunity_type") not in SCHOOL_TYPES:
        return None
    title = rec.get("title") or ""
    if not _SCHOOL_WORD.search(title):
        return None
    countries = [str(c).lower() for c in (rec.get("countries") or []) if c and str(c).lower() != "ua"]
    if not countries:
        return None
    m = _QUOTED_NAME.search(title)
    name = _letters(m.group(1)) if m else ""
    if not name and " — " in title:
        # «Berehynia — українська суботня школа в Барселоні»: власна назва до тире.
        head = title.split(" — ", 1)[0]
        if 1 <= len(head.split()) <= 4 and not _SCHOOL_WORD.search(head):
            name = _letters(head)
    return countries[0], (name if len(name) >= 3 else ""), _letters(title)


def _real_cities(rec: dict) -> set:
    return {str(c).strip().lower() for c in (rec.get("cities") or [])
            if c and str(c).strip().lower() not in _NOT_CITIES}


def same_school(a: dict, b: dict) -> bool:
    """Чи два записи — та сама школа діаспори. Чиста функція — під тести."""
    ka, kb = school_key(a), school_key(b)
    if not ka or not kb or ka[0] != kb[0]:
        return False
    ca, cb = _real_cities(a), _real_cities(b)
    if ka[1] and kb[1]:
        if ka[1] != kb[1]:
            return False
        # Одна зі сторін без міста — не заважає; різні міста — різні школи.
        return not (ca and cb) or bool(ca & cb)
    return ka[2] == kb[2] and bool(ca & cb)


def school_twin_resolution(new: dict, twin: dict) -> str:
    """Хто з пари лишається: "new_is_dup" або "twin_is_dup". Чиста функція.

    Лишається той, хто прийшов першим, — крім одного випадку: наявна чернетка
    з каталогу МІОК поступається запису з будь-якого іншого джерела. Каталог —
    посередник («Джерело — сторінка, не допис»: іти до першоджерела), а
    чернетка ще нікому не показана, тож злиття нікого не підводить. Активну
    картку МІОК не чіпаємо: вона вже живе на сайті, а різницю побачить людина.
    """
    if (twin.get("status") == "draft" and twin.get("source") in AGGREGATOR_SOURCES
            and new.get("source") not in AGGREGATOR_SOURCES):
        return "twin_is_dup"
    # Між двома посередниками лишається МІОК (Марія 28.09.2026 лишила
    # поведінку з МІОК як є): чернетка реєстру МОН поступається картці МІОК,
    # хай хто прийшов першим.
    if (twin.get("status") == "draft" and twin.get("source") == MON_CELLS_SOURCE
            and new.get("source") == MIOK_SOURCE):
        return "twin_is_dup"
    return "new_is_dup"


def _school_note(slug: str, source: str) -> str:
    return (f"та сама школа, що й {slug} ({source or 'інше джерело'}) — "
            "одна школа = одна картка (рішення 28.09.2026); злити, не публікувати двічі")


def guard_same_school(client: Client, record: dict) -> None:
    """Перед вставкою НОВОГО запису: чи немає вже картки тієї самої школи.

    Позначає дубль так само, як тригер trg_opportunities_dedup_guard: чернетка
    з dup_of, яку auto_review закриває червоним коридором «дубль — на злиття».
    Збій бази не зупиняє вставку — у гіршому разі пару знайде
    find_dup_candidates, коли обидва записи стануть активними.
    """
    key = school_key(record)
    if not key:
        return
    try:
        rows = (
            client.table("opportunities")
            .select("id, slug, title, cities, countries, opportunity_type, status, source, admin_comment")
            .in_("status", ["active", "draft"])
            .in_("opportunity_type", list(SCHOOL_TYPES))
            .contains("countries", [key[0]])
            .limit(500)
            .execute()
        ).data or []
    except Exception as e:
        logger.error(f"same-school lookup failed: {e}")
        return
    twins = [r for r in rows if r.get("slug") != record.get("slug") and same_school(record, r)]
    if not twins:
        return
    twin = next((r for r in twins if r.get("status") == "active"), twins[0])
    if school_twin_resolution(record, twin) == "twin_is_dup":
        try:
            client.table("opportunities").update({
                "dup_of": record.get("slug"), "dup_score": 1.0,
                "admin_comment": ((twin.get("admin_comment") or "") + " · "
                                  + _school_note(record.get("slug"), record.get("source"))).strip(" ·")[:500],
            }).eq("id", twin["id"]).execute()
        except Exception as e:
            logger.error(f"same-school twin update failed: {e}")
        return
    record["status"] = "draft"
    record["dup_of"] = twin.get("slug")
    record["dup_score"] = 1.0
    record["admin_comment"] = ((record.get("admin_comment") or "") + " · "
                               + _school_note(twin.get("slug"), twin.get("source"))).strip(" ·")


def upsert_opportunity(client: Client, data: dict) -> Optional[dict]:
    from datetime import datetime, timezone
    # Always stamp updated_at so get_processed_today() can find today's activity.
    # created_at is NOT included here — Supabase keeps the original value on conflict.
    now = datetime.now(timezone.utc).isoformat()
    record = {**data, "updated_at": now}
    try:
        # Той самий запис шукаємо за ДВОМА ключами: content_hash (вміст не
        # змінився) АБО slug (та сама назва+джерело, але вміст сторінки трохи
        # інший → інший hash). Без другого ключа повторна екстракція зміненої
        # сторінки падала на unique(slug) і сирець зациклювався в черзі.
        content_hash = record.get("content_hash") or ""
        slug = record.get("slug") or ""
        existing = (
            client.table("opportunities")
            .select(EXISTING_FIELDS)
            .or_(f"content_hash.eq.{content_hash},slug.eq.{slug}")
            .limit(1)
            .execute()
        )
        if not existing.data:
            # Третій ключ — страховка від транслітераційних дублів. Обидва
            # ключі вище історично нестабільні: формула content_hash уже раз
            # змінювалась (записи з квітня мають старий хеш), а slugify
            # транслітерує по-різному залежно від того, яка unidecode-бібліотека
            # стоїть в оточенні («kvity-peremohy» / «kviti-peremogi» — 01.09
            # злито 20 таких пар). canonical_url сам по собі ключем бути не
            # може: на одній сторінці МОН живе 19 різних олімпіад. А от
            # canonical_url + нормалізована назва — може: та сама сторінка
            # плюс та сама назва означає той самий запис, як би не порахувались
            # hash і slug.
            cu = (record.get("canonical_url") or "").strip()
            if cu:
                def _norm_title(t):
                    return re.sub(r"[^0-9a-zа-яіїєґ]+", "", (t or "").lower())
                want = _norm_title(record.get("title"))
                if want:
                    same_page = (
                        client.table("opportunities")
                        .select(EXISTING_FIELDS + ", title")
                        .eq("canonical_url", cu)
                        .limit(50)
                        .execute()
                    )
                    for row in (same_page.data or []):
                        if _norm_title(row.get("title")) == want:
                            existing.data = [row]
                            break
        if existing.data:
            row = existing.data[0]
            if row.get("verified_at"):
                # A moderator has reviewed (and possibly hand-edited) this record.
                # Only bump updated_at as a "source still publishes this" signal —
                # a full update would clobber their edits with re-extracted text.
                patch = {"updated_at": now}
            else:
                patch = merge_patch(row, record)
            try:
                result = (
                    client.table("opportunities")
                    .update(patch)
                    .eq("id", row["id"])
                    .execute()
                )
            except Exception:
                # Рідкісний конфлікт (напр. новий content_hash вже зайнятий
                # іншим рядком) — не втрачаємо сигнал життя джерела.
                result = (
                    client.table("opportunities")
                    .update({"updated_at": now})
                    .eq("id", row["id"])
                    .execute()
                )
            return result.data[0] if result.data else None

        # Четвертий ключ — лише для шкіл діаспори: та сама школа з каталогу
        # МІОК і з власного сайту (див. same_school вище).
        guard_same_school(client, record)
        result = client.table("opportunities").upsert(
            record,
            on_conflict="content_hash"
        ).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Supabase upsert failed: {e}")
        return None


def find_active_by_canonical(client: Client, canonical: str) -> dict | None:
    """Активний запис на цьому канонічному URL, якщо він є.

    Використовується як ворота ПЕРЕД викликом LLM: якщо можливість із цієї
    адреси вже в базі й ще свіжа, екстрагувати сирець немає сенсу — результат
    усе одно склеїться дедуплікацією, але токени вже будуть витрачені.
    Хаб-сторінки сюди не потрапляють: там на одному URL багато різних
    можливостей, і пропуск з'їдав би нові (перевірку робить викликач).
    """
    if not canonical:
        return None
    try:
        rows = (
            client.table("opportunities")
            .select("id, title, opportunity_type, updated_at, recheck_at, deadline, "
                    "event_start_date, event_end_date, admin_comment")
            .eq("canonical_url", canonical)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        return rows.data[0] if rows.data else None
    except Exception as e:
        # Недоступна база — не блокуємо конвеєр, просто не економимо цього разу.
        logger.error(f"find_active_by_canonical failed: {e}")
        return None


def get_new_today(client: Client) -> list[dict]:
    """Return all opportunities processed (inserted or updated) today (UTC).

    Uses updated_at rather than created_at so that recurring upserts of
    existing records (e.g. daily MAN contests refresh) are included.
    `created_at` їде разом із рядком: звіт ділить список на справді нові й
    просто оновлені, інакше квітневий запис показувався як «🆕 Нове».
    """
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        result = (
            client.table("opportunities")
            .select("title, source, source_url, opportunity_type, age_from, "
                    "age_to, deadline, cost_type, created_at")
            .gte("updated_at", today)
            .eq("status", "active")
            .order("source")
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"get_new_today failed: {e}")
        return []


# A missing deadline is only a real gap for one-off, time-bound opportunities.
# Two groups legitimately lack one and are excluded from the health metric:
#   • ongoing/rolling — courses, clubs, state payments (no deadline ever)
#   • annual/recurring — olympiads, competitions, camps… shown as «щорічно»
#     on the site; the next cycle's date missing isn't a data defect.
ONGOING_TYPES = [
    "course", "club", "allowance", "humanitarian", "medical_aid", "volunteer",
    "psychology", "rehabilitation", "mentorship", "shelter", "educational_material",
    "olympiad", "competition", "exchange", "scholarship", "festival", "camp",
    "grant", "study_abroad",
]


def get_health_stats(client: Client) -> dict:
    """Return aggregate health statistics for the opportunities table.

    `no_deadline` counts only deadline-bearing types (competitions, olympiads,
    grants, camps…) missing a deadline. Ongoing types (courses, clubs, state
    payments) are excluded — they legitimately have no deadline, so counting
    them just inflated the number and cried wolf.
    """
    try:
        active = client.table("opportunities").select("id", count="exact").eq("status", "active").execute()
        # The status CHECK constraint allows active|closed|draft — expired records
        # are marked 'closed' by scripts/check-deadlines.mjs ('archived' doesn't exist).
        archived = client.table("opportunities").select("id", count="exact").eq("status", "closed").execute()
        deadline_bearing = (
            client.table("opportunities")
            .select("id", count="exact")
            .eq("status", "active")
            .not_.in_("opportunity_type", ONGOING_TYPES)
            .execute()
        )
        no_dl = (
            client.table("opportunities")
            .select("id", count="exact")
            .eq("status", "active")
            .is_("deadline", "null")
            .not_.in_("opportunity_type", ONGOING_TYPES)
            .execute()
        )
        return {
            "total_active": active.count or 0,
            "total_archived": archived.count or 0,
            "no_deadline": no_dl.count or 0,
            "deadline_bearing": deadline_bearing.count or 0,
        }
    except Exception as e:
        logger.error(f"get_health_stats failed: {e}")
        return {"total_active": 0, "total_archived": 0, "no_deadline": 0, "deadline_bearing": 0}


def get_source_registry(client: Client, pipeline: str) -> dict:
    """Реєстр джерел: name → рядок sources. Порожній словник = таблиці ще
    немає або збій — тоді всі джерела вважаються увімкненими (fail-open
    свідомо: реєстр не сміє зупинити скрапінг через власну недоступність)."""
    try:
        result = (
            client.table("sources")
            .select("name, enabled, consecutive_failures, next_crawl_at, "
                    "crawl_interval_days, last_crawled_at, categories, pin_interval, "
                    "config")
            .eq("pipeline", pipeline)
            .execute()
        )
        return {row["name"]: row for row in (result.data or [])}
    except Exception as e:
        logger.error(f"get_source_registry failed: {e}")
        return {}


_season_cache: dict = {}


def _season_multiplier(client: Client, categories: list) -> float:
    """Максимальний сезонний множник серед категорій джерела на поточний
    місяць. 1.0 — без сезону. Помилка → 1.0 (сезонність не критична)."""
    if not categories:
        return 1.0
    from datetime import datetime, timezone
    month = datetime.now(timezone.utc).month
    key = (month, tuple(sorted(categories)))
    if key in _season_cache:
        return _season_cache[key]
    try:
        rows = (
            client.table("category_seasons")
            .select("multiplier")
            .in_("category", categories)
            .eq("month", month)
            .execute()
            .data
        )
        value = max((r["multiplier"] for r in rows), default=1.0) if rows else 1.0
        _season_cache[key] = value
        return value
    except Exception:
        return 1.0


def get_source_configs(client: Client) -> dict:
    """name → config джерела. Окремо від get_source_registry: той фільтрує за
    pipeline, а екстракція обробляє чергу з усіх пайплайнів разом.
    Помилка → порожньо: налаштування не сміють зупинити екстракцію."""
    try:
        rows = client.table("sources").select("name, config").execute().data or []
        return {r["name"]: (r.get("config") or {}) for r in rows}
    except Exception as e:
        logger.error(f"get_source_configs failed: {e}")
        return {}


def due_at(client: Client, row: dict):
    """Коли джерело справді має обходитись, з поправкою на поточний сезон.

    next_crawl_at рахується В МОМЕНТ ЗАПИСУ, множником того місяця. Через це
    джерело, обійдене 24 серпня й відкладене на 1 вересня, не відчуває
    вересневого підсилення (konkursy ×3) до самого 1 вересня — тобто МОН і
    МАН мовчать цілий тиждень якраз тоді, коли починається навчальний рік.

    Тут перераховуємо дату від останнього обходу з множником ПОТОЧНОГО місяця
    і беремо ранішу з двох. Сезон може лише наблизити обхід, ніколи не
    відсунути: інакше зміна місяця могла б випадково приспати джерело.
    """
    from datetime import datetime, timedelta, timezone

    def _parse(v):
        if not v:
            return None
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except ValueError:
            return None

    stored = _parse(row.get("next_crawl_at"))
    if row.get("pin_interval"):
        return stored

    last = _parse(row.get("last_crawled_at"))
    base = row.get("crawl_interval_days") or 1
    if last is None:
        return stored

    season = _season_multiplier(client, row.get("categories") or [])
    effective = max(1, round(base / season))
    recomputed = last + timedelta(days=effective)
    if stored is None:
        return recomputed
    return min(stored, recomputed)


def record_crawl_result(client: Client, name: str, ok: bool, new_items: int) -> None:
    """Здоров'я + адаптивний розклад джерела після запуску.

    Інтервал: нові знахідки → ÷2 (частіше, до 1 дня); нічого нового → ×2
    (рідше, до 30 днів); збій інтервал не змінює (полагодиться — надолужить).
    Сезон ділить ефективний інтервал: табори навесні скрапляться втричі
    частіше за свій базовий ритм. pin_interval — закріплений ритм
    crawl_interval_days: щодня для соцмереж і RSS (пости зникають зі стрічки,
    розтягувати не можна), щотижня для сайтів діаспори."""
    from datetime import datetime, timedelta, timezone
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    try:
        current = (
            client.table("sources")
            .select("consecutive_failures, checks_count, changes_count, "
                    "crawl_interval_days, pin_interval, categories")
            .eq("name", name).limit(1).execute()
        )
        if not current.data:
            return
        row = current.data[0]
        patch = {
            "last_crawled_at": now,
            "checks_count": (row.get("checks_count") or 0) + 1,
        }
        if ok:
            patch["last_success_at"] = now
            patch["consecutive_failures"] = 0
            if new_items > 0:
                patch["changes_count"] = (row.get("changes_count") or 0) + 1
        else:
            patch["consecutive_failures"] = (row.get("consecutive_failures") or 0) + 1

        base = row.get("crawl_interval_days") or 1
        if row.get("pin_interval"):
            # Закріплений ритм: інтервал не рухається ні від знахідок, ні від
            # сезону. Соцмережі й RSS закріплені на 1 дні, сайти діаспори — на
            # 7 (28.09.2026: оновлюються рідко). Збій — повтор завтра.
            interval, effective = base, (base if ok else 1)
        elif not ok:
            interval, effective = base, 1  # зламане перевіряємо щодня, поки не оживе
        else:
            interval = max(1, base // 2) if new_items > 0 else min(30, base * 2)
            season = _season_multiplier(client, row.get("categories") or [])
            effective = max(1, round(interval / season))
        patch["crawl_interval_days"] = interval
        patch["next_crawl_at"] = (now_dt + timedelta(days=effective)).isoformat()

        client.table("sources").update(patch).eq("name", name).execute()
    except Exception as e:
        logger.error(f"record_crawl_result failed for {name}: {e}")


# Expiry is owned solely by scripts/check-deadlines.mjs (daily cron): annual types
# get their stale deadline nulled, one-off types go to status='closed'. The old
# archive_expired() here wrote status='archived' — a value the CHECK constraint
# rejects — so it silently failed on every run and always reported 0.
