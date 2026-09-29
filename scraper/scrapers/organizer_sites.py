"""Сайти організаторів конкурсів і програм для підлітків: одне джерело — один сайт, щотижня.

Навіщо (Марія, 28.09.2026: «нічого нового не знаходиться»). Автоматичний
пошук майже не приносив нового: Telegram-агрегатори першоджерелом більше не
бувають (див. first_source.py), а розвідник бере 5 кандидатів на день.
Надійніше дивитись туди, де оголошення зʼявляються вперше, — на сторінки
самих організаторів. Тоді в запису одразу є першоджерело.

Відбір 29.09.2026: перевірено ~70 доменів. Лишились ті, що віддають сторінки
без JavaScript і за 60 днів мали хоч щось для дітей. Відкинуто: захищені
Cloudflare (ucf.in.ua, goethe.de, gen.tech — 403), сторінки на JavaScript
(mms.gov.ua, uyf.gov.ua), мертві (eyp.org.ua, kolosok.org.ua), добірки
(euneighbourseast.eu — правило «добірки не джерело») і програми лише для
студентів ЗВО (DAAD). Уже покриті власними скраперами (НЕНЦ, JA, EdEra,
man.gov.ua/contests, МОН, American Councils, UWC) тут не дублюються.

Механіка — та сама, що в diaspora_sites.py (links / rss / pages + хеш-гейт
raw_items: незмінна сторінка до моделі не йде). Різниця лише в списку сайтів
і тегу: це не діаспора, а всеукраїнське й міжнародне.

Запуск без бази й без моделі — лише що зібрали б:
    python scrapers/organizer_sites.py --dry-run [--only man]
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

if __name__ == "__main__":  # запуск файлом: імпорти як із scraper/
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scrapers.diaspora_sites import fetch_site  # noqa: E402

TAG = "thematic"  # фільтр --thematic у main.py

# name — назва джерела на картці («Джерело: …») і ключ рядка в sources
# (міграція 20260929_organizer_sites.sql).
SITES: list[dict] = [
    {
        "key": "man-news",
        "name": "Мала академія наук — новини (man.gov.ua)",
        "country": "ua",
        # Старти сезонів GENIUS Olympiad, ISEF Ukraine, спільні програми зі
        # школами — зʼявляються тут раніше, ніж у /contests (man_contests.py).
        "links": {
            "lists": ["https://man.gov.ua/about/news"],
            "follow": r"man\.gov\.ua/about/news/[a-z0-9-]+/?$",
        },
        # «Учитель року», співпраця з музеями, котильйони для захисників —
        # новини МАН про дорослих і саму МАН.
        "skip_title": r"учител|вчител|педагог|співпрац|котильйон|переможц|як минув",
    },
    {
        "key": "man-events",
        "name": "Мала академія наук — події (man.gov.ua)",
        "country": "ua",
        # Сторінка /events посилань у сирому HTML не має — вони є на головній.
        "links": {
            "lists": ["https://man.gov.ua/"],
            "follow": r"man\.gov\.ua/events/[a-z0-9-]+/?$",
        },
        # Більшість подій МАН — для вчителів і наставників.
        # Головна тримає й торішні події (Brain Bee 2024) — минуле відсіє
        # модель, а хеш-гейт не пустить ту саму сторінку вдруге.
        "skip_title": (r"педагог|вчител|учител|тренер|наставник|методист|освітянськ|"
                       r"конференці|семінар|вебінар|круглий стіл|форум|практикум|"
                       r"лекці|телеміст|день відкритих|ReFormEd|кваліфікац"),
    },
    {
        "key": "kman",
        "name": "Київська Мала академія наук (kman.kyiv.ua)",
        "country": "ua",
        # Частина новин — лише для Києва; місце визначає модель з тексту,
        # міста за замовчуванням свідомо немає.
        "links": {
            "lists": ["https://kman.kyiv.ua/ua/novyny/"],
            "follow": r"kman\.kyiv\.ua/ua/novyny/[A-Za-z0-9-]+/?$",
        },
        "skip_title": r"педагог|вчител|взяли участь|представники|партнерство|флешмоб|до .{0,20}дня",
    },
    {
        "key": "klitschko",
        "name": "Klitschko Foundation (klitschkofoundation.org)",
        "country": "ua",
        # WP REST закритий (401), стрічка мертва — лише перелік новин.
        # Програми для підлітків: Kyiv Youth Climate Hub, InterExchange
        # Academy, School of Resilience (14–16).
        "links": {
            "lists": ["https://klitschkofoundation.org/news/"],
            "follow": r"klitschkofoundation\.org/news/[a-z0-9-]+/?$",
        },
        # Звіти про програми, що вже йдуть або минули; обладнання, преса.
        "skip_title": r"завершено|підсумк|стартував|обладнання|у фокусі|масштабуват",
    },
    {
        "key": "udcnpv",
        "name": "Український державний центр національно-патріотичного виховання (udcnpvctum.kyiv.ua)",
        "country": "ua",
        # Сезонне: «Джура», конкурс екскурсоводів шкільних музеїв, учнівські
        # історичні конференції — березень–травень. Поза сезоном стрічка
        # мовчить, і це нічого не коштує.
        "rss": ["https://udcnpvctum.kyiv.ua/feed/"],
        "lookback_days": 30,
    },
]

SITES_BY_KEY = {s["key"]: s for s in SITES}


class _SiteScraper:
    """Те, що main.py запускає як «модуль»: один сайт — одне джерело."""

    def __init__(self, site: dict):
        self.site = site
        self.SOURCE_NAME = site["name"]

    async def fetch_all(self) -> list[dict]:
        return await fetch_site(self.site)


def scrapers() -> list[tuple[str, _SiteScraper, str]]:
    """Рядки для main.SCRAPERS: (назва джерела, скрапер, тег)."""
    return [(s["name"], _SiteScraper(s), TAG) for s in SITES]


async def _dry_run(only: str | None) -> None:
    for site in [s for s in SITES if not only or only in s["key"]]:
        stats: dict = {}
        items = await fetch_site(site, stats=stats)
        print(f"\n=== {site['name']} — {len(items)} у чергу; відсів: {stats}")
        for it in items:
            head = it["raw_text"][:200].replace("\n", " ")
            print(f"  • {it['raw_title'][:90]}\n    {it['source_url'][:110]}\n    {head}…")


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    p = argparse.ArgumentParser(description="Сайти організаторів — що зібрали б")
    p.add_argument("--dry-run", action="store_true", help="лише показати, без бази")
    p.add_argument("--only", help="ключ сайту (man-news, kman, klitschko…)")
    args = p.parse_args()
    asyncio.run(_dry_run(args.only))
