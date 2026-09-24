"""backfill_source_link.py — замінити адресу допису на сторінку можливості.

Скрапер каналів іде за посиланням із допису з 24.09.2026 (first_source), але
записи, зроблені раніше, лишились із адресою t.me: 169 у базі, 47 із них
активні. Людина тисне «відкрити джерело» і потрапляє в канал — де того допису
може вже й не бути, бо /s/ віддає лише останні.

Що робить: читає допис через ?embed=1, бере з нього посилання тими самими
правилами, що й скрапер (форми, картинки ботів, теки Drive — не джерело),
за потреби йде глибше по ланцюгу переказів і оновлює source_url,
canonical_url та позначку в admin_comment.

Чого НЕ робить: не чіпає опис, вік, дати й статус. Адреса джерела — це
виправлення, а не привід перезаписати те, що людина вже бачила.

    python scraper/backfill_source_link.py                 # показати, не писати
    python scraper/backfill_source_link.py --apply         # записати
    python scraper/backfill_source_link.py --limit 10      # перші 10
    python scraper/backfill_source_link.py --status draft  # інший статус
"""
from __future__ import annotations

import argparse
import logging
import sys

import httpx
from bs4 import BeautifulSoup

import first_source
from db import get_client
from canonical import canonical_url

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("backfill_source_link")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
NOTE = "24.09: джерелом був допис у каналі, замінено на сторінку, куди він веде"


def embed_url(post_url: str) -> str:
    """Допис у вигляді, який віддає текст і посилання без JS.

    t.me/<канал>/<номер> у браузері — сторінка-заглушка з кнопкою «View in
    Telegram»; ?embed=1 віддає сам допис.
    """
    url = (post_url or "").split("?")[0].rstrip("/")
    return f"{url}?embed=1"


def post_links(html: str) -> list[str]:
    """Посилання з тіла допису (не з шапки каналу й не з підвалу віджета)."""
    soup = BeautifulSoup(html, "lxml")
    body = soup.select_one(".tgme_widget_message_text")
    if not body:
        return []
    return [a.get("href") for a in body.select("a[href]")]


def read_page(client: httpx.Client, url: str):
    """(кінцева адреса, текст, посилання) або None — як у скрапері каналів."""
    try:
        r = client.get(url)
        r.raise_for_status()
    except Exception as e:                                   # noqa: BLE001
        logger.info("      не відкрилось: %s", type(e).__name__)
        return None
    if not first_source.usable_destination(str(r.url)):
        logger.info("      редирект привів не туди: %s", r.url)
        return None
    soup = BeautifulSoup(r.text, "lxml")
    links = [a.get("href") for a in soup.select("a[href]")]
    for tag in soup(["script", "style", "nav", "footer", "header", "svg"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())[:8000]
    if not first_source.looks_like_page(text):
        return None
    return first_source.strip_tracking(str(r.url)), text, links


def resolve(client: httpx.Client, post_url: str) -> str | None:
    """Куди насправді веде допис. None — лишаємо як є."""
    try:
        r = client.get(embed_url(post_url))
        r.raise_for_status()
    except Exception as e:                                   # noqa: BLE001
        logger.info("      допис не читається: %s", type(e).__name__)
        return None
    target = first_source.pick(post_links(r.text))
    if not target:
        return None
    visited: tuple = ()
    best = None
    for _ in range(first_source.MAX_HOPS + 1):
        got = read_page(client, target)
        if not got:
            break
        url, text, links = got
        best = url
        visited += (first_source.host_of(url),)
        deeper = first_source.deeper_link(text, links, visited)
        if not deeper:
            break
        logger.info("      %s переказує — глибше: %s", url, deeper)
        target = deeper
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="записати в базу")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--status", default="active", help="active, draft або all")
    args = ap.parse_args()

    client = get_client()
    q = (client.table("opportunities")
         .select("id, slug, title, source, source_url, admin_comment")
         .ilike("source_url", "%t.me/%")
         .limit(args.limit))
    if args.status != "all":
        q = q.eq("status", args.status)
    rows = q.execute().data or []
    logger.info("Записів з адресою допису: %d (статус %s)\n", len(rows), args.status)

    fixed = kept = 0
    with httpx.Client(timeout=25, follow_redirects=True,
                      headers={"User-Agent": UA, "Accept-Language": "uk,en;q=0.8"}) as http:
        for row in rows:
            logger.info("• %s", (row.get("title") or "")[:70])
            logger.info("      було: %s", row["source_url"])
            found = resolve(http, row["source_url"])
            if not found:
                kept += 1
                logger.info("      лишаю допис (сторінки не знайшлось)\n")
                continue
            fixed += 1
            logger.info("      стало: %s\n", found)
            if args.apply:
                note = ((row.get("admin_comment") or "") + " · " + NOTE).strip(" ·")[:1000]
                client.table("opportunities").update({
                    "source_url": found,
                    "canonical_url": canonical_url(found),
                    "admin_comment": note,
                }).eq("id", row["id"]).execute()

    logger.info("Підсумок: %d замінено, %d лишились із дописом%s",
                fixed, kept, "" if args.apply else " (сухий прогін, нічого не записано)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
