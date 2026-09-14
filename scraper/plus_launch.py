"""plus_launch.py — повідомлення про запуск Dityam+ усім зі списку очікування.

Запускати ЛИШЕ за рішенням Марії й разом із PLUS_SALES_OPEN = true у lib/plus.js
(14.09.2026: «підготувати, старт скажу я»). Воркфлоу plus-launch.yml за
замовчуванням нічого не шле — лише показує, кому й що пішло б; по-справжньому
надсилає тільки з confirm = SEND.

Кому й як:
  • записались через Telegram (@DityamComUABot ?start=plus) — повідомлення від
    основного бота, бо саме його людина запускала; платний бот написати їй
    першим не може. Кнопка веде в @DityamPlusBot.
  • записались імейлом — лист із посиланням t.me/DityamPlusBot?start=w_<id>:
    платний бот привʼяже чат до рядка списку, і за цим рядком дасть знижку.

Знижка (рішення Марії 14.09.2026): перший місяць за 89 грн, далі 179 грн/міс.
Її рахує сам бот (isEarlyBird у app/api/telegram/plus/route.js) за наявністю
людини в plus_waitlist — тут лише повідомляємо.

Повторний запуск надішле ще раз: у plus_waitlist немає позначки «вже писали».
Тому це ручний воркфлоу з підтвердженням, а не розклад.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN,
     GMAIL_FROM, GMAIL_APP_PASSWORD, SITE_URL (опційно).
"""
import argparse
import html
import logging
import os
import sys
import time

import httpx

from personal_digest import send_email

logger = logging.getLogger("plus_launch")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SITE_URL = os.environ.get("SITE_URL", "https://dityam.com.ua")
MAIN_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
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


def email_html(link: str) -> str:
    return (
        '<div style="max-width:560px;margin:0 auto;font-family:system-ui,Arial,sans-serif;color:#131b28">'
        '<div style="font-size:12px;color:#db5a1e;font-weight:700;letter-spacing:.04em">DITYAM+</div>'
        '<h1 style="font-size:22px;margin:6px 0 10px">Dityam+ запустився</h1>'
        f'<p style="font-size:15px;line-height:1.55">Ви були в списку перших — дякуємо, що чекали. '
        f'Як обіцяли, для вас перший місяць за <b>{EARLY_PRICE} грн</b> замість {PRICE}, далі {PRICE} грн/міс.</p>'
        f'<p style="font-size:15px;line-height:1.55">{html.escape(WHAT)}</p>'
        '<p style="font-size:15px;line-height:1.55">Підписка оформлюється в Telegram-боті. Відкрийте його саме '
        'за цим посиланням — так бот упізнає вас і дасть знижку:</p>'
        f'<p style="margin:22px 0"><a href="{html.escape(link)}" style="background:#db5a1e;color:#fff;'
        'padding:13px 22px;border-radius:12px;text-decoration:none;font-weight:700">Оформити зі знижкою</a></p>'
        '<p style="color:#8a94a6;font-size:12px;margin-top:20px">Ви отримали цей лист, бо записались у список '
        f'очікування Dityam+ на <a href="{SITE_URL}/plus" style="color:#1e4fd6">dityam.com.ua</a>. '
        'Більше листів про запуск не буде.</p></div>'
    )


def send_telegram_launch(chat_id: str) -> bool:
    r = httpx.post(f"https://api.telegram.org/bot{MAIN_BOT_TOKEN}/sendMessage", json={
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
    mail = [r for r in rows if not r.get("telegram_chat_id") and r.get("email")]
    logger.info("У списку очікування: %d (Telegram %d, імейл %d)", len(rows), len(tg), len(mail))

    if not args.send:
        logger.info("[dry] Telegram-текст:\n%s", telegram_text())
        if mail:
            logger.info("[dry] Приклад посилання з листа: https://t.me/%s?start=w_%s", PLUS_BOT, mail[0]["id"])
        logger.info("[dry] Нічого не надіслано. Щоб надіслати — confirm = SEND.")
        return 0

    if tg and not MAIN_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задано")
        return 1

    sent_tg = sent_mail = 0
    for r in tg:
        sent_tg += send_telegram_launch(r["telegram_chat_id"])
        time.sleep(0.05)          # ліміт Telegram — ~30 повідомлень на секунду
    for r in mail:
        link = f"https://t.me/{PLUS_BOT}?start=w_{r['id']}"
        sent_mail += send_email(r["email"], email_html(link),
                                subject="🧡 Dityam+ запустився — перший місяць за 89 грн")
    logger.info("Готово. Telegram: %d/%d, імейл: %d/%d", sent_tg, len(tg), sent_mail, len(mail))
    return 0


if __name__ == "__main__":
    sys.exit(main())
