"""plus_sorry.py — разове вибачення тим, кому бот 21.10.2026 писав про оплату.

Що сталося. 21.10.2026 Dityam+ став безкоштовним (#982), але CHECK у базі не
знав billing_period='free': бот писав «увімкнено», а підписка лишалась pending,
кнопка анкети казала «далі до оплати», а cron nudge-stuck за годину дописував
«лишився один крок — оплата». Міграція й код виправлені (#993); підписки
ввімкнено вручну. Марія: «напиши всім вибачення, хто дійшов і побачив цей крок».

Кому — лише через @DityamPlusBot:
  1. усі, кого cron «застряг» зачепив 21.10 після 13:18 UTC (stuck_notice_at);
  2. усі, кому підписку ввімкнено безкоштовно (status active, billing_period free).
Два тексти: підписка вже є / анкету не завершено. Марію (lib/own.js) не чіпаємо.

Без --send нічого не шле — лише показує, кому й що. --preview <chat_id>
надсилає обидва тексти в один чат (показати Марії).

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN.
"""
import argparse
import logging
import os
import sys
import time

import httpx

logger = logging.getLogger("plus_sorry")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

PLUS_BOT_TOKEN = os.environ.get("TELEGRAM_PLUS_BOT_TOKEN", "")
OWN_CHAT_IDS = {"388954322"}
SINCE = "2026-10-21T13:18:00+00:00"


def active_text() -> str:
    """Тим, у кого підписка вже ввімкнена."""
    return (
        "🙏 <b>Вибачте за плутанину з оплатою</b>\n\n"
        "Сьогодні Dityam+ став безкоштовним, але бот ще кілька годин писав «далі до оплати» "
        "і «лишився один крок — оплата». Це наша помилка, платити нічого не треба.\n\n"
        "Ваша підписка вже ввімкнена: добірки за вашою анкетою приходитимуть сюди, "
        "а про дедлайни нагадаємо завчасно.\n\n"
        "Якщо щось не так або лишились питання — просто напишіть у відповідь, я читаю все.\n\n"
        "Марія, Dityam.com.ua"
    )


def pending_text() -> str:
    """Тим, хто відкрив бот, але анкету не завершив."""
    return (
        "🙏 <b>Вибачте за плутанину з оплатою</b>\n\n"
        "Сьогодні Dityam+ став безкоштовним, але бот ще кілька годин писав про оплату. "
        "Це наша помилка, платити нічого не треба.\n\n"
        "Щоб отримувати добірки можливостей і нагадування про дедлайни, лишилось "
        "відповісти на кілька коротких питань — напишіть /start.\n\n"
        "Якщо щось не так — просто напишіть у відповідь, я читаю все.\n\n"
        "Марія, Dityam.com.ua"
    )


def pick_recipients(subs: list) -> list:
    """[(chat_id, 'active'|'pending', підпис)] — чиста функція під тест."""
    out, seen = [], set()
    for s in subs:
        chat = str(s.get("telegram_chat_id") or "")
        if not chat or chat in seen or chat in OWN_CHAT_IDS:
            continue
        nudged = bool(s.get("stuck_notice_at")) and str(s.get("stuck_notice_at")) >= SINCE
        free_active = s.get("status") == "active" and s.get("billing_period") == "free"
        if not (nudged or free_active):
            continue
        if s.get("status") in ("unsubscribed", "cancelled"):
            continue
        seen.add(chat)
        out.append((chat, "active" if s.get("status") == "active" else "pending", s.get("telegram_handle") or chat))
    return out


def send(chat_id: str, text: str) -> bool:
    r = httpx.post(f"https://api.telegram.org/bot{PLUS_BOT_TOKEN}/sendMessage", json={
        "chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True,
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("ok")
    if not ok:
        logger.warning("TG failed for %s: %s", chat_id, r.text[:200])
    return bool(ok)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", action="store_true", help="надіслати по-справжньому")
    ap.add_argument("--preview", default="", help="chat_id: надіслати обидва тексти лише сюди")
    args = ap.parse_args()

    if args.preview:
        if not PLUS_BOT_TOKEN:
            logger.error("TELEGRAM_PLUS_BOT_TOKEN не задано")
            return 1
        ok = send(args.preview, active_text()) + send(args.preview, pending_text())
        logger.info("Превʼю надіслано: %d/2", ok)
        return 0 if ok == 2 else 1

    from db import get_client
    client = get_client()
    subs = (client.table("digest_subscribers")
            .select("telegram_chat_id, telegram_handle, status, billing_period, stuck_notice_at")
            .limit(2000).execute().data or [])
    people = pick_recipients(subs)
    active = sum(1 for p in people if p[1] == "active")
    logger.info("Кому: %d (підписка є %d, анкету не завершили %d)", len(people), active, len(people) - active)
    for chat, kind, who in people:
        logger.info("  %s · %s", who, kind)

    if not args.send:
        logger.info("[dry] Текст тим, у кого підписка є:\n%s", active_text())
        logger.info("[dry] Текст тим, хто не завершив анкету:\n%s", pending_text())
        logger.info("[dry] Нічого не надіслано. Щоб надіслати — confirm = SEND.")
        return 0
    if not PLUS_BOT_TOKEN:
        logger.error("TELEGRAM_PLUS_BOT_TOKEN не задано")
        return 1

    ok = 0
    for chat, kind, _ in people:
        ok += send(chat, active_text() if kind == "active" else pending_text())
        time.sleep(0.05)
    logger.info("Готово. Telegram: %d/%d", ok, len(people))
    return 0


if __name__ == "__main__":
    sys.exit(main())
