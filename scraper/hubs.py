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
import hashlib
import logging
import re

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


def _host(url: str) -> str:
    from urllib.parse import urlparse
    netloc = urlparse(url or "").netloc.lower()
    return netloc[4:] if netloc.startswith("www.") else netloc


def is_site_root(url: str) -> bool:
    """Адреса — це сам сайт, а не сторінка на ньому: шлях порожній або «/»."""
    from urllib.parse import urlparse
    return bool(url) and urlparse(url).path.strip("/") == ""


def site_root_domains(urls) -> set[str]:
    """Домени, які вже є в базі ЯК ОДНА МОЖЛИВІСТЬ ЦІЛКОМ (запис указує на
    корінь сайту). Лише такий домен означає «цей сайт уже є».

    Навіщо. Розвідник відкидав кандидата, якщо в базі був будь-який запис із
    того самого домену. На порталі це вбиває нові можливості: 11.09.2026 з
    восьми знахідок у Кривому Розі п'ять — музичні школи №12 і №14, програми
    Музею Захисників — пішли в смітник лише тому, що лежать на
    spilkuisia.kr.gov.ua. Нова сторінка на знайомому порталі тепер іде далі, на
    звичайний дедуп за назвою."""
    return {_host(u) for u in urls if u and is_site_root(u)}


def hub_domains(prefixes_: tuple[str, ...] | None = None) -> set[str]:
    """Домени з переліку хабів — для них правило «сайт уже є» не діє взагалі."""
    return {_host(p) for p in (prefixes_ if prefixes_ is not None else prefixes()) if p}

# Ключ дедуплікації — один на всі конвеєри (20.09.2026).
#
# Формул було дві: нормалізатор рахував хеш від самого URL (а для хабів —
# «назва|URL»), discover-агент завжди від «назва|URL». Та сама сторінка з двох
# шляхів давала різні ключі, і запис лягав двічі — саме так у базі з'явилось
# 8 копій uBoost і 7 українсько-польських обмінів.
#
# Назву генерує модель, і для того самого джерела вона щоразу інша, тож
# ключем служить URL. Виняток — сторінки-хаби, де на одній адресі справді
# живе багато різних можливостей: там у ключ додається нормалізована назва.
def content_hash(title: str, url: str) -> str:
    if is_hub(url):
        normalized = re.sub(r"[^\w\s]", "", (title or "").lower())
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return hashlib.sha256(f"{normalized}|{url}".encode()).hexdigest()[:16]
    return hashlib.sha256((url or "").encode()).hexdigest()[:16]
