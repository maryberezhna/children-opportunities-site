"""Instagram monitor: підписки акаунта dityam.com.ua.

Джерела визначаються підписками (followees) залогіненого акаунта — щоб
додати чи прибрати джерело, досить підписатися/відписатися у застосунку,
код чіпати не треба. Якщо підписки прочитати не вдалося, працює запасний
курований список ACCOUNTS.

Автентифікація (в порядку пріоритету):
  INSTAGRAM_SESSION_B64 + INSTAGRAM_USERNAME — сесія, згенерована локально
      скриптом gen_instagram_session.py (рекомендовано: логін паролем з IP
      GitHub Actions майже завжди ловить checkpoint від Meta).
  INSTAGRAM_USERNAME + INSTAGRAM_PASSWORD — прямий логін (запасний шлях).

Без креденшелів — тихий no-op: анонімний instaloader з CI-адрес одразу
отримує 429, а на 429 він блокується на ~30 хв і завалює весь пайплайн.
"""
import base64
import logging
import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

SOURCE_NAME = "Instagram"
POSTS_PER_ACCOUNT = 12
LOOKBACK_DAYS = 14
# Скільки акаунтів обходимо за ніч. Вікно щодня зсувається (див. нижче),
# тож за кілька ночей покриваються всі підписки без вибуху запитів.
MAX_ACCOUNTS_PER_RUN = 25
# Закріплені пости можуть бути старими і йдуть першими — терпимо кілька
# поспіль, перш ніж вважати, що дійшли до старої частини стрічки.
OLD_STREAK_LIMIT = 3

# Запасний список на випадок, якщо підписки прочитати не вдалося.
ACCOUNTS: list[str] = [
    "unicef_ukraine",
    "savechildrenukraine",
    "britishcouncil_ukraine",
    "irex.ukraine",
    "house_of_europe.ua",
    "erasmusplus.ukraine",
    "osvitoria_ua",
    "upshift.ukraine",
]

from keywords import is_relevant as _is_relevant

MIN_TEXT_LEN = 100


def _login(instaloader_mod):
    """Повертає залогінений Instaloader або None."""
    username = os.environ.get("INSTAGRAM_USERNAME", "")
    session_b64 = os.environ.get("INSTAGRAM_SESSION_B64", "")
    password = os.environ.get("INSTAGRAM_PASSWORD", "")

    if not username or not (session_b64 or password):
        logger.info("Instagram: креденшели не задано — пропускаємо")
        return None

    L = instaloader_mod.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
        request_timeout=20,
        max_connection_attempts=1,  # fail fast, never sleep-retry on 429
    )

    if session_b64:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                session_file = Path(tmp) / "session"
                session_file.write_bytes(base64.b64decode(session_b64))
                L.load_session_from_file(username, str(session_file))
            logger.info("Instagram: сесію завантажено (@%s)", username)
            return L
        except Exception as e:
            logger.warning("Instagram: сесія не підійшла (%s: %s) — "
                           "перегенеруйте gen_instagram_session.py", type(e).__name__, e)
            # свідомо НЕ падаємо в password-логін з CI: це шлях до checkpoint

    if password:
        try:
            L.login(username, password)
            logger.info("Instagram: login OK (@%s)", username)
            return L
        except Exception as e:
            logger.warning("Instagram login failed: %s — пропускаємо", e)

    return None


def _pick_accounts(L, instaloader_mod, username: str) -> list[str]:
    """Підписки акаунта; при невдачі — курований запасний список."""
    try:
        profile = instaloader_mod.Profile.from_username(L.context, username)
        followees = [f.username for f in profile.get_followees()]
        if followees:
            logger.info("Instagram: %d підписок у @%s", len(followees), username)
            if len(followees) <= MAX_ACCOUNTS_PER_RUN:
                return followees
            # Стабільна ротація вікна по днях — без стану між запусками.
            start = (datetime.utcnow().timetuple().tm_yday
                     * MAX_ACCOUNTS_PER_RUN) % len(followees)
            window = (followees + followees)[start:start + MAX_ACCOUNTS_PER_RUN]
            logger.info("Instagram: беру %d з ротацією (зсув %d)",
                        MAX_ACCOUNTS_PER_RUN, start)
            return window
        logger.warning("Instagram: у @%s нуль підписок — запасний список", username)
    except Exception as e:
        logger.warning("Instagram: не вдалося прочитати підписки (%s: %s) — "
                       "запасний список", type(e).__name__, e)
    return ACCOUNTS


async def fetch_all() -> list[dict]:
    try:
        import instaloader
    except ImportError:
        logger.warning("instaloader не встановлено — пропускаємо Instagram")
        return []

    L = _login(instaloader)
    if L is None:
        return []

    username = os.environ["INSTAGRAM_USERNAME"]
    accounts = _pick_accounts(L, instaloader, username)
    since = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)

    results: list[dict] = []
    for account in accounts:
        try:
            profile = instaloader.Profile.from_username(L.context, account)
            count = 0
            old_streak = 0
            for post in profile.get_posts():
                if count >= POSTS_PER_ACCOUNT or old_streak >= OLD_STREAK_LIMIT:
                    break
                count += 1
                if post.date_utc < since:
                    old_streak += 1
                    continue
                old_streak = 0
                caption = post.caption or ""
                if len(caption) >= MIN_TEXT_LEN and _is_relevant(caption):
                    results.append({
                        "raw_text": caption,
                        "source": f"Instagram @{account}",
                        "source_url": f"https://www.instagram.com/p/{post.shortcode}/",
                        "raw_title": None,
                    })
        except instaloader.exceptions.ProfileNotExistsException:
            logger.debug("@%s — профіль не знайдено, пропускаємо", account)
        except Exception as e:
            logger.warning("Instagram @%s: %s: %s", account, type(e).__name__, e)

    logger.info("Instagram: %d релевантних постів з %d акаунтів",
                len(results), len(accounts))
    return results
