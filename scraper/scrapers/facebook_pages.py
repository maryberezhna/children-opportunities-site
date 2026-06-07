"""Facebook public page monitor via Graph API.

Зчитує останні пости публічних Facebook-сторінок через офіційний Graph API.

Потребує (GitHub Secrets):
  FB_APP_ID     — числовий ID застосунку (developers.facebook.com → My Apps)
  FB_APP_SECRET — секрет застосунку (Settings → Basic → App Secret)

App Access Token = {APP_ID}|{APP_SECRET} — автоматично формується тут.
В режимі Development (до App Review) читає будь-які публічні сторінки.
Для Production App потрібна permission: pages_read_engagement.

Без змінних — повертає [] і логує warning.
"""
import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

SOURCE_NAME = "Facebook"
GRAPH_API = "https://graph.facebook.com/v20.0"
POSTS_PER_PAGE = 12

# Публічні Facebook-сторінки організацій, що публікують можливості для дітей.
PAGES: list[dict] = [
    {"name": "UNICEF Ukraine",          "slug": "UNICEFUkraine"},
    {"name": "British Council Ukraine", "slug": "BritishCouncilUkraine"},
    {"name": "Save the Children UA",    "slug": "savethechildrenukraine"},
    {"name": "IREX Ukraine",            "slug": "IREXinUkraine"},
    {"name": "МАН",                     "slug": "man.gov.ua"},
    {"name": "Erasmus+ Ukraine",        "slug": "erasmusplusukraine"},
    {"name": "House of Europe",         "slug": "houseofeurope.eu"},
    {"name": "МОН України",            "slug": "mon.gov.ua"},
    {"name": "UPSHIFT Ukraine",         "slug": "upshift.ukraine"},
    {"name": "Освіторія",               "slug": "osvitoria"},
]

_KEYWORDS = {
    "дітей", "діти", "дитина", "школярів", "учнів", "підлітків",
    "конкурс", "олімпіада", "стипендія", "табір", "грант",
    "програма", "обмін", "навчання", "курс",
    "до 18", "до 17", "від 14", "flex", "upshift", "erasmus",
}
MIN_TEXT_LEN = 100


def _is_relevant(text: str) -> bool:
    return any(kw in text.lower() for kw in _KEYWORDS)


async def _fetch_page(
    client: httpx.AsyncClient, page: dict, token: str
) -> list[dict]:
    results = []
    try:
        resp = await client.get(
            f"{GRAPH_API}/{page['slug']}/posts",
            params={
                "access_token": token,
                "fields": "message,story,permalink_url,created_time",
                "limit": POSTS_PER_PAGE,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            err = resp.json().get("error", {}).get("message", resp.text[:120])
            logger.debug(f"Facebook {page['name']}: {resp.status_code} — {err}")
            return []
        for post in resp.json().get("data", []):
            text = post.get("message") or post.get("story") or ""
            if len(text) < MIN_TEXT_LEN or not _is_relevant(text):
                continue
            results.append({
                "raw_text": text,
                "source": f"Facebook {page['name']}",
                "source_url": post.get("permalink_url",
                                       f"https://www.facebook.com/{page['slug']}"),
                "raw_title": None,
            })
    except Exception as e:
        logger.warning(f"Facebook {page['name']}: {type(e).__name__}: {e}")
    return results


async def fetch_all() -> list[dict]:
    app_id = os.environ.get("FB_APP_ID", "")
    app_secret = os.environ.get("FB_APP_SECRET", "")
    if not app_id or not app_secret:
        logger.warning(
            "FB_APP_ID / FB_APP_SECRET не задано — пропускаємо Facebook. "
            "Створіть застосунок на developers.facebook.com і додайте secrets."
        )
        return []

    token = f"{app_id}|{app_secret}"
    results: list[dict] = []
    async with httpx.AsyncClient() as client:
        for page_results in await asyncio.gather(
            *[_fetch_page(client, page, token) for page in PAGES]
        ):
            results.extend(page_results)

    logger.info(f"Facebook: {len(results)} релевантних постів з {len(PAGES)} сторінок")
    return results
