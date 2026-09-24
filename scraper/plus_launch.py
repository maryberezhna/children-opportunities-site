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
Їм код можна дати вручну — у цьому й сенс коду замість мовчазної знижки.

Знижка (рішення Марії 19.09.2026) — промокод FIRST: перший місяць 1 грн замість
119 (0 грн платіжний сервіс не проводить), перший рік 799 замість 999. До
19.09.2026 бот сам давав знижку тим, кого знаходив у plus_waitlist за chat_id:
механіка мовчки обходила тих, хто лишив пошту. Тепер механіка одна — код.
Кнопка веде на діп-лінк, тож тим, хто з неї прийде, код застосується сам.

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
PROMO = "FIRST"
PROMO_PRICE = 1
PROMO_PRICE_YEAR = 799
PRICE = 119
PRICE_YEAR = 999

WHAT = (
    "Dityam+ щодня добирає можливості окремо для кожної вашої дитини — за віком, "
    "вподобаннями, форматом і містом — і нагадує про дедлайни завчасно: за 4 і 2 "
    "тижні для стипендій, грантів і обмінів, за 2 тижні для конкурсів і таборів."
)


def telegram_text() -> str:
    return (
        "🧡 <b>Dityam+ запустився</b>\n\n"
        f"Ви були в списку перших — дякуємо, що чекали. Як обіцяли, для вас "
        f"промокод <b>{PROMO}</b>: перший місяць за {PROMO_PRICE} грн замість {PRICE} "
        f"(платіжний сервіс не проводить 0 грн), а перший рік — за {PROMO_PRICE_YEAR} "
        f"грн замість {PRICE_YEAR}.\n\n"
        f"{WHAT}\n\n"
        f"Кнопка нижче застосує код сама. Якщо відкриєте бота інакше — натисніть "
        f"«У мене є промокод» і введіть <b>{PROMO}</b>.\n\n"
        "Скасувати можна командою /stop у боті."
    )


def wrong_chat_text() -> str:
    """Тим, хто записався через @DityamComUABot (пости в каналі до 15.09.2026).

    Цей бот зветься «Dityam Адмінка 🛠» — службовий, і стороння людина не має
    бачити його взагалі (правило Марії, 24.09.2026). Слати їй звідси повний
    лист про запуск означало б закріпити помилку. Тому звідси йде одне
    коротке повідомлення: перепрошуємо, вам сюди, а цей чат видаляйте.
    Промокод називаємо, щоб людина не втратила обіцяну знижку по дорозі.
    """
    return (
        "🧡 <b>Dityam+ запустився</b>\n\n"
        "І одразу вибачення: ми переплутали чат. Ви записувались у список перших, "
        "але цей бот службовий — він для адміністрування сайту, писати вам сюди не "
        "мали.\n\n"
        f"Усе про Dityam+ — у @{PLUS_BOT}. Там і ваш промокод <b>{PROMO}</b>, як "
        f"обіцяли: перший місяць за {PROMO_PRICE} грн замість {PRICE}, перший рік — "
        f"за {PROMO_PRICE_YEAR} грн замість {PRICE_YEAR}.\n\n"
        "Кнопка нижче застосує код сама. А цей чат сміливо видаляйте — більше ми "
        "сюди не напишемо."
    )


def via_plus_bot(row: dict) -> bool:
    """Записалась у @DityamPlusBot (з 15.09.2026) — писати треба ним."""
    return str(row.get("source") or "").startswith("plus_bot")


def send_telegram_launch(chat_id: str, token: str, text: str | None = None) -> bool:
    r = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json={
        "chat_id": chat_id,
        "text": text or telegram_text(),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {"inline_keyboard": [[
            {"text": f"🚀 Оформити з кодом {PROMO}",
             "url": f"https://t.me/{PLUS_BOT}?start=promo_first_launch"},
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
        logger.info("[dry] Текст для @%s:\n%s", PLUS_BOT, telegram_text())
        if any(not via_plus_bot(r) for r in tg):
            logger.info("[dry] Текст для тих, хто записався через службовий бот:\n%s",
                        wrong_chat_text())
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
        plus = via_plus_bot(r)
        token = PLUS_BOT_TOKEN if plus else MAIN_BOT_TOKEN
        # Зі службового бота — лише «переплутали чат», ніколи повний лист.
        text = None if plus else wrong_chat_text()
        sent_tg += send_telegram_launch(r["telegram_chat_id"], token, text)
        time.sleep(0.05)          # ліміт Telegram — ~30 повідомлень на секунду
    logger.info("Готово. Telegram: %d/%d", sent_tg, len(tg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
