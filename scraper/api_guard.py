"""api_guard.py — відмова Claude API не має виглядати як «нічого не знайшли».

Навіщо. 14.09.2026 о 09:22 UTC задача «Рідкісне за кордоном» отримала від
Anthropic «You have reached your specified API usage limits». Скрипт записав
це в лог, повернув порожній список — і запуск став зеленим із «кандидатів: 0».
Так само поводяться майже всі скрипти конвеєра: помилку API ловлять, щоб один
збій не валив нічний прогін. Для тимчасових збоїв це правильно. Для ліміту,
оплати чи ключа — ні: вони не минуть до ранку, а зелений запуск ховає, що
конвеєр стоїть.

Як працює. Кожен клієнт створюється через `client()`: до нього чіпляється
хук, який дивиться на кожну відповідь api.anthropic.com. Прямі HTTP-виклики
кличуть `note()` самі. Якщо відмова фатальна, запобіжник запамʼятовує її, а
на виході з процесу змінює код завершення на ненульовий — хай би скрипт
ковтнув помилку як завгодно. Запуск у GitHub стає червоним, і GitHub шле лист.

Фатальні: 401 (ключ), 403 і 400/402 зі словами про ліміт, оплату чи дозвіл.
Не фатальні: 429 (частота), 5xx, таймаути — вони минають, їх лікує повтор.
"""
import atexit
import logging
import os
import sys

import httpx

logger = logging.getLogger("api_guard")

EXIT_CODE = 3

FATAL_MARKERS = (
    "usage limit",
    "credit balance",
    "billing",
    "spend limit",
    "invalid x-api-key",
    "invalid api key",
    "permission",
    "disabled",
)

_fatal = None


def is_fatal(status, message) -> bool:
    """Чи означає відповідь, що далі цей запуск API не отримає."""
    text = (message or "").lower()
    if status == 401:
        return True
    if status in (400, 402, 403) and any(m in text for m in FATAL_MARKERS):
        return True
    return False


def note(status, message) -> bool:
    """Зафіксувати відповідь API. Повертає True, якщо відмова фатальна."""
    global _fatal
    if not is_fatal(status, message):
        return False
    if _fatal is None:
        _fatal = f"HTTP {status}: {str(message)[:300]}"
        logger.error("🔴 Claude API відмовив, і це не мине саме: %s. "
                     "Запуск буде позначено як невдалий.", _fatal)
    return True


def fatal():
    """Текст першої фатальної відмови або None."""
    return _fatal


def _hook(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    if "anthropic.com" not in str(response.request.url):
        return
    try:
        response.read()
        body = response.text
    except Exception:
        body = ""
    note(response.status_code, body)


def client(**kwargs):
    """anthropic.Anthropic із запобіжником. Ті самі аргументи, що й у SDK."""
    import anthropic
    if "http_client" not in kwargs:
        kwargs["http_client"] = httpx.Client(
            timeout=httpx.Timeout(600.0, connect=10.0),
            event_hooks={"response": [_hook]},
        )
    return anthropic.Anthropic(**kwargs)


@atexit.register
def _exit_red() -> None:
    if not _fatal:
        return
    msg = (f"\n🔴 Запуск невдалий: Claude API недоступний ({_fatal}).\n"
           "Перевірте ліміт і баланс: https://console.anthropic.com/settings/billing\n")
    try:
        sys.stdout.flush()
        sys.stderr.write(msg)
        sys.stderr.flush()
    finally:
        os._exit(EXIT_CODE)
