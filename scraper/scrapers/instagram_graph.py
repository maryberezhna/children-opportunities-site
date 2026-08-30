"""Instagram через офіційний Graph API (business_discovery).

Навіщо замість instaloader. Той скрапить сайт, і Meta ріже датацентрові
адреси GitHub Actions на кожному запиті: 429 приходив навіть на читання
власних підписок, тож із Instagram у базу не потрапило жодного запису за весь
час. Сесія тут не рятує — справа в адресі, а не в автентифікації.

Чого офіційний шлях НЕ вміє. У Graph API немає ендпоінта «мої підписки» —
Meta його свідомо не дає. Тож джерела більше не визначаються тим, на кого
підписаний акаунт: список акаунтів живе тут, у ACCOUNTS.

Обмеження business_discovery: цільовий акаунт має бути Business або Creator і
публічним. Особистий акаунт віддає помилку — ми її логуємо поіменно, щоб було
видно, кого саме не видно, а не «щось не працює».

Env:
  IG_USER_ID       — ID твого Instagram-акаунта (Business/Creator),
                     звʼязаного з Facebook-сторінкою.
  IG_ACCESS_TOKEN  — токен із дозволами instagram_basic, pages_show_list,
                     pages_read_engagement. Довгий токен живе 60 днів;
                     токен системного користувача — безстроковий.

Без змінних — тихий no-op, як і решта опціональних джерел.
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

from keywords import is_relevant as _is_relevant

logger = logging.getLogger(__name__)

GRAPH_API = "https://graph.facebook.com/v20.0"
SOURCE_NAME = "Instagram"

# Кого читаємо. Раніше цей список був запасним для підписок — тепер він
# основний і єдиний. Додати джерело = додати рядок сюди.
ACCOUNTS = [
    "unicef_ukraine",
    "savechildrenukraine",
    "britishcouncil_ukraine",
    "irex.ukraine",
    "house_of_europe.ua",
    "erasmusplus.ukraine",
    "osvitoria_ua",
    "upshift.ukraine",
]

POSTS_PER_ACCOUNT = 12
LOOKBACK_DAYS = 14
MIN_TEXT_LEN = 100

# Скільки днів лишилось до кінця токена, щоб почати попереджати. 60-денний
# токен інакше тихо помирає посеред ночі, і Instagram знову зникає — цього
# разу вже непомітно, бо помилка виглядатиме як звичайний 400.
TOKEN_WARN_DAYS = 10


async def _check_token(client: httpx.AsyncClient, token: str) -> None:
    """Пише в лог, коли токен добігає кінця. Не валить прогін."""
    try:
        resp = await client.get(
            f"{GRAPH_API}/debug_token",
            params={"input_token": token, "access_token": token},
            timeout=15,
        )
        data = resp.json().get("data", {})
        expires = data.get("expires_at")
        if not expires:  # 0 або відсутнє = безстроковий (системний користувач)
            logger.info("Instagram: токен безстроковий")
            return
        left = datetime.fromtimestamp(expires, timezone.utc) - datetime.now(timezone.utc)
        if left.days <= TOKEN_WARN_DAYS:
            logger.warning(
                "⚠️ Instagram: токен спливає через %d дн. (%s) — треба оновити, "
                "інакше джерело тихо зникне",
                left.days, datetime.fromtimestamp(expires, timezone.utc).date(),
            )
        else:
            logger.info("Instagram: токен дійсний ще %d дн.", left.days)
    except Exception as e:
        logger.debug("Instagram: не вдалося перевірити токен: %s", e)


async def _fetch_account(
    client: httpx.AsyncClient, ig_user_id: str, token: str, account: str, since,
) -> list[dict]:
    fields = (
        f"business_discovery.username({account})"
        "{username,media.limit(" + str(POSTS_PER_ACCOUNT) + ")"
        "{caption,permalink,timestamp}}"
    )
    try:
        resp = await client.get(
            f"{GRAPH_API}/{ig_user_id}",
            params={"fields": fields, "access_token": token},
            timeout=20,
        )
    except Exception as e:
        logger.warning("Instagram @%s: %s: %s", account, type(e).__name__, e)
        return []

    if resp.status_code != 200:
        err = resp.json().get("error", {})
        msg = err.get("message", resp.text[:150])
        # Найчастіша причина — цільовий акаунт не Business/Creator. Кажемо
        # прямо, кого саме не видно: інакше список акаунтів мовчки гниє.
        logger.warning("Instagram @%s: %s — %s", account, resp.status_code, msg)
        return []

    media = (resp.json().get("business_discovery") or {}).get("media", {}).get("data", [])
    results = []
    for post in media:
        text = (post.get("caption") or "").strip()
        ts = post.get("timestamp")
        if ts:
            try:
                if datetime.fromisoformat(ts.replace("+0000", "+00:00")) < since:
                    continue
            except ValueError:
                pass
        if len(text) < MIN_TEXT_LEN or not _is_relevant(text):
            continue
        results.append({
            "raw_text": text,
            "source": f"Instagram @{account}",
            "source_url": post.get("permalink") or f"https://www.instagram.com/{account}/",
            "raw_title": None,
        })
    return results


async def fetch_all() -> list[dict]:
    ig_user_id = os.environ.get("IG_USER_ID", "").strip()
    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not ig_user_id or not token:
        logger.warning(
            "IG_USER_ID / IG_ACCESS_TOKEN не задано — пропускаємо Instagram. "
            "Налаштування: developers.facebook.com, дозволи instagram_basic, "
            "pages_show_list, pages_read_engagement."
        )
        return []

    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    async with httpx.AsyncClient() as client:
        await _check_token(client, token)
        batches = await asyncio.gather(*[
            _fetch_account(client, ig_user_id, token, a, since) for a in ACCOUNTS
        ])

    results = [item for batch in batches for item in batch]
    reached = sum(1 for b in batches if b)
    logger.info(
        "Instagram: %d релевантних постів; акаунтів із відповіддю %d із %d",
        len(results), reached, len(ACCOUNTS),
    )
    return results
