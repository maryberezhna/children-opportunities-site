"""Instagram public profile monitor.

Зчитує останні пости з кураторського списку публічних Instagram-акаунтів
організацій, що публікують можливості для дітей. Потребує:
  INSTAGRAM_USERNAME  — логін (рекомендовано, але опціонально)
  INSTAGRAM_PASSWORD  — пароль

Без login instaloader може повернути порожні результати через обмеження Meta.
Без встановленого instaloader — тихо повертає [].
"""
import logging
import os

logger = logging.getLogger(__name__)

SOURCE_NAME = "Instagram"
POSTS_PER_ACCOUNT = 12

# Публічні Instagram-акаунти організацій, що публікують можливості для дітей.
# Хендли без '@'.
ACCOUNTS: list[str] = [
    "unicef_ukraine",
    "savechildrenukraine",
    "britishcouncil_ukraine",
    "irex.ukraine",
    "house_of_europe.ua",
    "erasmusplus.ukraine",
    "osvitoria_ua",
    "mon.gov.ua",           # верифікувати хендл МОН
    "man.gov.ua",           # МАН
    "upshift.ukraine",
]

# Relevance uses the shared 12-category keyword taxonomy (scraper/keywords.py).
from keywords import is_relevant as _is_relevant

MIN_TEXT_LEN = 100


async def fetch_all() -> list[dict]:
    try:
        import instaloader
    except ImportError:
        logger.warning("instaloader не встановлено — пропускаємо Instagram")
        return []

    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
        request_timeout=20,
    )

    username = os.environ.get("INSTAGRAM_USERNAME", "")
    password = os.environ.get("INSTAGRAM_PASSWORD", "")
    if username and password:
        try:
            L.login(username, password)
            logger.info("Instagram: login OK")
        except Exception as e:
            logger.warning(f"Instagram login failed: {e} — продовжуємо без авторизації")
    else:
        logger.info("Instagram: credentials не задано, спроба без авторизації")

    results: list[dict] = []
    for account in ACCOUNTS:
        try:
            profile = instaloader.Profile.from_username(L.context, account)
            count = 0
            for post in profile.get_posts():
                if count >= POSTS_PER_ACCOUNT:
                    break
                caption = post.caption or ""
                if len(caption) >= MIN_TEXT_LEN and _is_relevant(caption):
                    results.append({
                        "raw_text": caption,
                        "source": f"Instagram @{account}",
                        "source_url": f"https://www.instagram.com/p/{post.shortcode}/",
                        "raw_title": None,
                    })
                count += 1
        except instaloader.exceptions.ProfileNotExistsException:
            logger.debug(f"@{account} — профіль не знайдено, пропускаємо")
        except Exception as e:
            logger.warning(f"Instagram @{account}: {type(e).__name__}: {e}")

    logger.info(f"Instagram: {len(results)} релевантних постів з {len(ACCOUNTS)} акаунтів")
    return results
