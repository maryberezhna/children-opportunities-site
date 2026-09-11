"""send_window.py — спільні ворота «не раніше ніж» для розсилок.

Навіщо. Розклад cron у GitHub Actions для цього репозиторію не виконується:
заміряно 10-11 вересня 2026 по журналу прогонів.

    воркфлоу          у розкладі   фактично
    scrape-py         06:00 UTC    10:04-11:47 UTC
    deadline-check    06:00 UTC    10:24 UTC
    personal-digest   08:30 UTC    12:59 UTC
    verify-links      04:23 UTC    08:59 UTC
    uptime            щогодини     раз на ~4.5 години

Затримка стабільна — від 4 до 5.8 години, щодня, щонайменше десять днів
поспіль. Це не разовий збій: GitHub виконує заплановані воркфлоу за
залишковим принципом і для цього репозиторію віддає приблизно пʼять
запусків на добу з інтервалом ~4.5 години, скільки б їх не просили.

Наслідок для продукту: підписнику обіцяно нагадування о 10:00 за Києвом, а
воно йде близько 15:00. Обіцянку «ми нагадаємо вчасно» тримає не розклад, а
ця пара механізмів:

  • у воркфлоу кілька записів cron рано-вранці — щоб бодай один запуск
    дістався ранкового вікна і за швидкого, і за повільного GitHub;
  • ці ворота: запуск, що прийшов зарано, нічого не шле й виходить.
    Повторний запуск того самого дня не надішле дубля — за це відповідає
    UNIQUE у digest_reminders_sent і last_sent_at у digest_subscribers.

Верхньої межі свідомо немає: нагадування о 18:00 краще за жодне.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

KYIV_TZ_NAME = "Europe/Kyiv"
DEFAULT_HOUR = 9


def kyiv_now() -> datetime:
    """Поточний час у Києві. Якщо в оточенні немає бази часових поясів
    (мінімальні контейнери), відступаємо до фіксованого +03:00 — узимку це
    дасть похибку в годину, що для воріт «не раніше ранку» неістотно."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(KYIV_TZ_NAME))
    except Exception:
        return datetime.now(timezone(timedelta(hours=3)))


def too_early(hour: int | None = None) -> bool:
    """True — зараз зарано слати, викликач має вийти без відправки.

    Годину можна задати аргументом або змінною SEND_AFTER_HOUR; 0 вимикає
    ворота повністю (зручно для ручного запуску й тестів).
    """
    if hour is None:
        raw = os.environ.get("SEND_AFTER_HOUR", "")
        try:
            hour = int(raw) if raw.strip() else DEFAULT_HOUR
        except ValueError:
            hour = DEFAULT_HOUR
    if hour <= 0:
        return False
    now = kyiv_now()
    if now.hour >= hour:
        return False
    logger.info(
        "Зарано: %02d:%02d за Києвом, вікно відправки з %02d:00. "
        "Нічого не шлемо — надішле наступний запуск сьогодні.",
        now.hour, now.minute, hour,
    )
    return True
