"""plus_uah1.py — разове повідомлення: перший місяць Dityam+ тепер 1 грн.

Марія, 08.10.2026: «давай 1 грн перший місяць роби і повідомляй про це, але
покажеш меседж». Ціна діє з PR #782 для всіх, хто ще не платив.

Кому — лише через @DityamPlusBot:
  1. ті, хто почав оформлення й зупинився (digest_subscribers: pending або
     paused, є chat_id, не подарунок за олімпіаду);
  2. список очікування, що записався в @DityamPlusBot і після запуску в бот
     так і не зайшов.
Кому НЕ пишемо: активним і тим, хто сам відписався (/stop); тим, хто
записувався через службовий бот @DityamComUABot, — 28.09.2026 ми пообіцяли
«більше сюди не напишемо»; тим, хто лишив лише пошту (листів Dityam+ немає).

Без --send нічого не шле — лише показує, кому й що. Позначки «вже писали»
немає, тож повторний запуск із SEND напише всім ще раз: це ручний воркфлоу з
підтвердженням, а не розклад.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN.
"""
import argparse
import logging
import os
import sys
import time

import httpx

logger = logging.getLogger("plus_uah1")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

PLUS_BOT_TOKEN = os.environ.get("TELEGRAM_PLUS_BOT_TOKEN", "")
PLUS_BOT = "DityamPlusBot"
PRICE_FIRST = 1
PRICE = 119
# Мітка `from_uah1`: хто прийде з кнопки вперше, у /admin/plus матиме джерело
# «Розсилка · перший місяць 1 грн» (lib/plusSources.js).
BUTTON_URL = f"https://t.me/{PLUS_BOT}?start=from_uah1"

WHAT = ("Dityam+ щодня добирає можливості окремо для кожної вашої дитини "
        "й завчасно нагадує про дедлайни.")


def started_text() -> str:
    """Тим, хто почав оформлення в боті й зупинився."""
    return (
        f"🧡 <b>Перший місяць у Dityam+ за {PRICE_FIRST} грн</b>\n\n"
        f"Ви починали оформлювати Dityam+. Тепер перший місяць коштує {PRICE_FIRST} грн — "
        f"для всіх, без промокоду. Далі {PRICE} грн/міс, скасувати можна будь-коли "
        "командою /stop.\n\n"
        f"{WHAT}"
    )


def waitlist_text() -> str:
    """Списку очікування, що після запуску в бот не заходив."""
    return (
        f"🧡 <b>Перший місяць у Dityam+ за {PRICE_FIRST} грн</b>\n\n"
        f"Ви записувались у список очікування Dityam+. Підписка вже працює: {WHAT[len('Dityam+ '):]}\n\n"
        f"Перший місяць — {PRICE_FIRST} грн, далі {PRICE} грн/міс. Скасувати можна "
        "будь-коли командою /stop."
    )


BUTTON = {"inline_keyboard": [[{"text": f"Спробувати за {PRICE_FIRST} грн", "url": BUTTON_URL}]]}


def pick_recipients(subs: list, waitlist: list) -> list:
    """[(chat_id, вид, підпис)] — чиста функція, щоб правило відбору перевіряв тест."""
    out, seen = [], set()
    for s in subs:
        chat = str(s.get("telegram_chat_id") or "")
        if not chat or chat in seen:
            continue
        seen.add(chat)
        if s.get("status") not in ("pending", "paused") or s.get("billing_period") == "gift":
            continue
        out.append((chat, "started", s.get("telegram_handle") or chat))
    for w in waitlist:
        chat = str(w.get("telegram_chat_id") or "")
        if not chat or chat in seen:
            continue
        if not str(w.get("source") or "").startswith("plus_bot"):
            continue
        seen.add(chat)
        out.append((chat, "waitlist", w.get("telegram_username") or chat))
    return out


def send(chat_id: str, text: str) -> bool:
    r = httpx.post(f"https://api.telegram.org/bot{PLUS_BOT_TOKEN}/sendMessage", json={
        "chat_id": chat_id, "text": text, "parse_mode": "HTML",
        "disable_web_page_preview": True, "reply_markup": BUTTON,
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("ok")
    if not ok:
        logger.warning("TG failed for %s: %s", chat_id, r.text[:200])
    return bool(ok)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", action="store_true", help="надіслати по-справжньому")
    args = ap.parse_args()

    from db import get_client
    client = get_client()
    subs = (client.table("digest_subscribers")
            .select("telegram_chat_id, telegram_handle, status, billing_period")
            .limit(2000).execute().data or [])
    waitlist = (client.table("plus_waitlist")
                .select("telegram_chat_id, telegram_username, source")
                .limit(2000).execute().data or [])
    people = pick_recipients(subs, waitlist)
    started = sum(1 for p in people if p[1] == "started")
    logger.info("Кому: %d (почали в боті %d, список очікування %d)", len(people), started, len(people) - started)

    if not args.send:
        logger.info("[dry] Текст тим, хто почав:\n%s", started_text())
        logger.info("[dry] Текст списку очікування:\n%s", waitlist_text())
        logger.info("[dry] Нічого не надіслано. Щоб надіслати — confirm = SEND.")
        return 0
    if not PLUS_BOT_TOKEN:
        logger.error("TELEGRAM_PLUS_BOT_TOKEN не задано")
        return 1

    ok = 0
    for chat, kind, _ in people:
        ok += send(chat, started_text() if kind == "started" else waitlist_text())
        time.sleep(0.05)
    logger.info("Готово. Telegram: %d/%d", ok, len(people))
    return 0


if __name__ == "__main__":
    sys.exit(main())
