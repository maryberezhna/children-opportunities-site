"""Одноразовий скрипт для генерації Telethon StringSession.

Запустіть локально ОДИН РАЗ:
    pip install telethon
    python gen_telegram_session.py

Введіть свій номер телефону та код підтвердження.
Скрипт надрукує рядок TELEGRAM_SESSION_STRING — збережіть його як
GitHub Secret і в .env.local (ніколи не комітьте у git!).

Отримати API_ID і API_HASH: https://my.telegram.org → API development tools
"""
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID   = input("TELEGRAM_API_ID (число): ").strip()
API_HASH = input("TELEGRAM_API_HASH: ").strip()


async def main():
    async with TelegramClient(StringSession(), int(API_ID), API_HASH) as client:
        session_str = client.session.save()
        print("\n✅ Збережіть цей рядок як GitHub Secret TELEGRAM_SESSION_STRING:\n")
        print(session_str)
        print()


asyncio.run(main())
