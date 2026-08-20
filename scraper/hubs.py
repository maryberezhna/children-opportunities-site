"""Єдиний список хаб-сторінок.

Хаб — адреса, де на ОДНОМУ URL живе багато різних можливостей: перелік
олімпіад МОН, каталог послуг Дії, розклад гуртків центру творчості. Для них
не можна дедуплікувати за URL — інакше 24 предметні олімпіади злипнуться в
одну.

Навіщо окремий модуль. Список існував у двох місцях і вони розійшлись:
таблиця `dedup_hub_urls` у Postgres (нею користується тригер дедуплікації)
знала про ctdu-kiev.com.ua та oman.lviv.ua, а константа в normalizer.py — ні.
Через це Python-пайплайн рахував різні гуртки одного центру за дублі одне
одного. Тепер джерело правди одне — таблиця; список нижче лишається тільки
фолбеком на випадок, коли база недоступна.
"""
import logging

logger = logging.getLogger(__name__)

# Фолбек: використовується, ЛИШЕ якщо `dedup_hub_urls` не прочиталась.
# Додавати нові хаби треба в базу, а не сюди.
FALLBACK_HUB_PREFIXES = (
    "https://mon.gov.ua/osvita-2/zagalna-serednya-osvita/olimpiadi-ta-konkursi",
    "https://diia.gov.ua/services",
    "https://mms.gov.ua",
    "https://mincult.gov.ua",
    "https://constellation.org.ua",
    "https://fest-portal.com/meropriyatiya",
    "https://klitschkofoundation.org/projects",
    "https://artarsenal.in.ua",
    "https://ukraine.uwc.org/apply",
    "https://man.gov.ua/contests/olympiad",
    "https://osvita.diia.gov.ua/courses",
    "https://ctdu-kiev.com.ua",
    "https://oman.lviv.ua",
)

_cache: tuple[str, ...] | None = None


def prime(client) -> tuple[str, ...]:
    """Прочитати список із бази один раз за запуск. Ніколи не кидає виняток:
    недоступна база не має зупиняти нічний скрап."""
    global _cache
    try:
        rows = (
            client.table("dedup_hub_urls").select("url_prefix").execute().data
            or []
        )
        prefixes = tuple(
            (r.get("url_prefix") or "").rstrip("/")
            for r in rows
            if (r.get("url_prefix") or "").strip()
        )
        if prefixes:
            _cache = prefixes
            return _cache
        logger.warning("dedup_hub_urls порожня — беру фолбек із коду")
    except Exception as e:
        logger.error("dedup_hub_urls не прочиталась (%s) — беру фолбек із коду", e)
    _cache = tuple(u.rstrip("/") for u in FALLBACK_HUB_PREFIXES)
    return _cache


def prefixes() -> tuple[str, ...]:
    if _cache is not None:
        return _cache
    return tuple(u.rstrip("/") for u in FALLBACK_HUB_PREFIXES)


def is_hub(url: str) -> bool:
    if not url:
        return False
    trimmed = url.rstrip("/")
    return any(trimmed.startswith(p) for p in prefixes())
