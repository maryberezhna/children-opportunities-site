"""plus_launch.py — повідомлення про запуск Dityam+ усім зі списку очікування.

Запускати ЛИШЕ за рішенням Марії й разом із PLUS_SALES_OPEN = true у lib/plus.js
(14.09.2026: «підготувати, старт скажу я»). Воркфлоу plus-launch.yml за
замовчуванням нічого не шле — лише показує, кому й що пішло б; по-справжньому
надсилає тільки з confirm = SEND.

Кому й як: кожному — від того бота, якого людина сама запускала, бо інший бот
написати їй першим не може. З 15.09.2026 у список записуються в @DityamPlusBot
(source 'plus_bot:…') — їм пише він. Хто записався раніше через основний бот
@DityamComUABot (source 'telegram_post'), тим пише основний. Кнопка веде в
@DityamPlusBot.

Хто записався імейлом на сайті до 15.09.2026, повідомлення не отримає: листів
Dityam+ більше не шле (рішення Марії 15.09.2026). Скрипт лише рахує таких людей.

Знижка (рішення Марії 14.09.2026): перший місяць за 89 грн, далі 179 грн/міс.
Її рахує сам бот (isEarlyBird у app/api/telegram/plus/route.js) за наявністю
людини в plus_waitlist — тут лише повідомляємо.

Повторний запуск надішле ще раз: у plus_waitlist немає позначки «вже писали».
Тому це ручний воркфлоу з підтвердженням, а не розклад.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_PLUS_BOT_TOKEN.
"""
import argparse
import logging
import os
import sys
import time

import httpx

logger = logging.getLogger("plus_launch")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MAIN_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PLUS_BOT_TOKEN = os.environ.get("TELEGRAM_PLUS_BOT_TOKEN", "")
PLUS_BOT = "DityamPlusBot"
EARLY_PRICE = 89
PRICE = 179

WHAT = (
    "Dityam+ щодня добирає можливості окремо для кожної вашої дитини — за віком, "
    "вподобаннями, форматом і містом — і нагадує про дедлайни завчасно: за 4 і 2 "
    "тижні для стипендій, грантів і обмінів, за 2 тижні для конкурсів і таборів."
)


def telegram_text() -> str:
    return (
        "🧡 <b>Dityam+ запустився</b>\n\n"
        f"Ви були в списку перших — дякуємо, що чекали. Як обіцяли, для вас перший "
        f"місяць за <b>{EARLY_PRICE} грн</b> замість {PRICE}, далі {PRICE} грн/міс.\n\n"
        f"{WHAT}\n\n"
        "Скасувати можна командою /stop у боті."
    )


def via_plus_bot(row: dict) -> bool:
    """Записалась у @DityamPlusBot (з 15.09.2026) — писати треба ним."""
    return str(row.get("source") or "").startswith("plus_bot")


def send_telegram_launch(chat_id: str, token: str) -> bool:
    r = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json={
        "chat_id": chat_id,
        "text": telegram_text(),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {"inline_keyboard": [[
            {"text": f"🚀 Оформити за {EARLY_PRICE} грн", "url": f"https://t.me/{PLUS_BOT}?start=launch"},
        ]]},
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("ok")
    if not ok:
        logger.warning("TG launch failed for %s: %s", chat_id, r.text[:200])
    return bool(ok)


def load_waitlist(client) -> list:
    rows = []
    for start in range(0, 20000, 1000):
        page = (client.table("plus_waitlist").select("id, email, telegram_chat_id, source")
                .order("created_at").range(start, start + 999).execute().data or [])
        rows.extend(page)
        if len(page) < 1000:
            break
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", action="store_true",
                    help="надіслати по-справжньому; без прапорця — лише показати, кому й що")
    args = ap.parse_args()

    from db import get_client
    rows = load_waitlist(get_client())
    tg = [r for r in rows if r.get("telegram_chat_id")]
    logger.info("У списку очікування: %d (Telegram %d: через Dityam+ %d, через основний бот %d)",
                len(rows), len(tg), sum(via_plus_bot(r) for r in tg), sum(not via_plus_bot(r) for r in tg))
    if len(rows) > len(tg):
        # Записались імейлом до 15.09.2026. Листів Dityam+ не шле — адреси
        # видно в адмінці (/admin/plus), написати можна вручну.
        logger.info("Без Telegram (записались імейлом до 15.09.2026): %d — їм повідомлення не піде",
                    len(rows) - len(tg))

    if not args.send:
        logger.info("[dry] Telegram-текст:\n%s", telegram_text())
        logger.info("[dry] Нічого не надіслано. Щоб надіслати — confirm = SEND.")
        return 0

    if any(not via_plus_bot(r) for r in tg) and not MAIN_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задано")
        return 1
    if any(via_plus_bot(r) for r in tg) and not PLUS_BOT_TOKEN:
        logger.error("TELEGRAM_PLUS_BOT_TOKEN не задано")
        return 1

    sent_tg = 0
    for r in tg:
        token = PLUS_BOT_TOKEN if via_plus_bot(r) else MAIN_BOT_TOKEN
        sent_tg += send_telegram_launch(r["telegram_chat_id"], token)
        time.sleep(0.05)          # ліміт Telegram — ~30 повідомлень на секунду
    logger.info("Готово. Telegram: %d/%d", sent_tg, len(tg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
