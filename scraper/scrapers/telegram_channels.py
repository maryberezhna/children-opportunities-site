"""Telegram public channel monitor.

Читає повідомлення з кураторського списку публічних українських каналів за
останні LOOKBACK_DAYS днів. Потребує:
  TELEGRAM_API_ID          — числовий ID застосунку (my.telegram.org)
  TELEGRAM_API_HASH        — рядковий хеш застосунку
  TELEGRAM_SESSION_STRING  — рядок сесії Telethon (генерується один раз
                             за допомогою scraper/gen_telegram_session.py)

Без цих змінних скрапер тихо повертає порожній список.
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

SOURCE_NAME = "Telegram"
LOOKBACK_DAYS = 3
MIN_TEXT_LEN = 120
MESSAGES_PER_CHANNEL = 40

# Публічні україномовні канали, що публікують можливості для дітей/молоді.
# Хендли без '@'. Якщо канал недоступний — просто пропускаємо, не падаємо.
CHANNELS: list[str] = [
    # Державні
    "mon_gov_ua",            # Міністерство освіти і науки України
    "man_gov_ua",            # Мала академія наук
    "osvita_diia",           # Дія.Освіта
    "mms_gov_ua",            # Мінмолодьспорту
    # Міжнародні організації в Україні
    "unicef_ukraine",
    "savechildrenua",
    "britishcouncil_ukraine",
    "house_of_europe_ua",
    "ErasmusPlusUkraine",
    "irex_ukraine",
    # Освітні та молодіжні
    "osvitoria",
    "EdCampUkraine",
    "scholarships_ua",       # агрегатор стипендій
    "grants_ukraine",        # агрегатор грантів
    "youth_ukraine",
    "kids_opp_ua",           # агрегатор для дітей
]

# Relevance uses the shared 12-category keyword taxonomy (scraper/keywords.py).
from keywords import is_relevant as _is_relevant


async def fetch_all() -> list[dict]:
    try:
        from telethon import TelegramClient, errors
        from telethon.sessions import StringSession
    except ImportError:
        logger.warning("telethon не встановлено — пропускаємо Telegram-канали")
        return []

    api_id = os.environ.get("TELEGRAM_API_ID", "")
    api_hash = os.environ.get("TELEGRAM_API_HASH", "")
    session_str = os.environ.get("TELEGRAM_SESSION_STRING", "")

    if not api_id or not api_hash:
        logger.warning("TELEGRAM_API_ID / TELEGRAM_API_HASH не задано — пропускаємо")
        return []

    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    results: list[dict] = []

    async with TelegramClient(StringSession(session_str), int(api_id), api_hash) as client:
        for channel in CHANNELS:
            try:
                entity = await client.get_entity(f"@{channel}")
                async for msg in client.iter_messages(entity, limit=MESSAGES_PER_CHANNEL):
                    if not msg.text:
                        continue
                    msg_date = msg.date.replace(tzinfo=timezone.utc) if msg.date.tzinfo is None else msg.date
                    if msg_date < since:
                        break
                    if len(msg.text) < MIN_TEXT_LEN or not _is_relevant(msg.text):
                        continue
                    results.append({
                        "raw_text": msg.text,
                        "source": f"Telegram @{channel}",
                        "source_url": f"https://t.me/{channel}/{msg.id}",
                        "raw_title": None,
                    })
                    await asyncio.sleep(0.1)
            except errors.ChannelPrivateError:
                logger.debug(f"@{channel} — приватний або не існує, пропускаємо")
            except Exception as e:
                logger.warning(f"@{channel}: {type(e).__name__}: {e}")
            await asyncio.sleep(1.5)

    logger.info(f"Telegram: {len(results)} релевантних повідомлень з {len(CHANNELS)} каналів")
    return results
