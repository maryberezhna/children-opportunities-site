"""Канонізація URL — єдиний ключ ідентичності можливості між усіма пайплайнами.

Дзеркало: scrapers/lib/canonical.mjs — правки мають іти в обидва файли синхронно.

Правила: https, хост у нижньому регістрі без www., без фрагмента, без
трекінгових параметрів, решта параметрів відсортована, без хвостового слеша,
без мовного префікса в шляху.
Тільки параметри, що ТОЧНО аналітичні — ?ref= чи ?page= можуть міняти вміст.
"""
import re
from typing import Optional
from urllib.parse import urlsplit, parse_qsl, quote, unquote

TRACKING_EXACT = {
    "fbclid", "gclid", "yclid", "msclkid", "twclid",
    "mc_cid", "mc_eid", "_ga", "_gl", "igshid", "igsh", "si",
    "srsltid", "ref_src", "spm",
}

# Мовний префікс шляху — не частина ідентичності. Та сама програма на
# americancouncils.org.ua лежала двічі: /en/programs/... і /programs/...,
# і для бази це були дві різні можливості. Те саме з uboost.study/ua/career.
#
# Список свідомо НЕ повний ISO 639-1: двобуквені коди, які частіше означають
# не мову, а розділ сайту, сюди не входять. "it" — це Information Technology
# частіше, ніж італійська; "hc" у mitocw.zendesk.com/hc/en-us/ — help center;
# так само небезпечні is, id, in, at, as, so, to, no, am, or, my.
# Помилково НЕ зрізати краще, ніж помилково склеїти дві різні сторінки.
LANG_PREFIXES = {
    "en", "uk", "ua", "ru", "de", "pl", "fr", "es", "pt", "nl", "sv", "da",
    "fi", "cs", "sk", "ro", "hu", "bg", "hr", "sl", "lt", "lv", "et", "el",
    "tr", "he", "ar", "fa", "hi", "zh", "ja", "ko", "ka", "hy", "az", "kk",
    "uz", "sr", "mk", "sq", "be",
}
# Приймаємо і "en", і "en-us" / "en_US" — обидві форми трапляються.
_LANG_SEG = re.compile(r"^([a-z]{2})(?:[-_][a-z]{2})?$", re.I)


def strip_lang_prefix(path: str) -> str:
    """Прибирає перший сегмент шляху, якщо це мовний код.

    Зрізаємо ЛИШЕ коли після префікса лишається ще щось: "/en" — це головна
    англійською, а не та сама сторінка, що "/". Один префікс за виклик:
    "/en/uk/x" — вже не локаль, а чийсь дивний шлях, і чіпати його нема за що.
    """
    if not path.startswith("/"):
        return path
    segments = path.split("/")          # ['', 'en', 'programs', ...]
    if len(segments) < 3 or not segments[2]:
        return path
    m = _LANG_SEG.match(segments[1])
    if m and m.group(1).lower() in LANG_PREFIXES:
        return "/" + "/".join(segments[2:])
    return path


def canonical_url(raw_url: Optional[str]) -> Optional[str]:
    if not raw_url or not isinstance(raw_url, str):
        return None
    url = raw_url.strip()
    if not url:
        return None
    if not re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
        url = f"https://{url}"

    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https"):
        return None

    host = (parts.hostname or "").lower()
    # IDN → punycode, як робить new URL() у JS (кириличні домени: дія.укр).
    try:
        host = host.encode("idna").decode("ascii")
    except (UnicodeError, UnicodeDecodeError):
        return None
    if host.startswith("www."):
        host = host[4:]
    # Валідний хост: лише [a-z0-9.-] і принаймні одна крапка (JS URL це гарантує).
    if not re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$", host):
        return None

    params = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACKING_EXACT and not k.lower().startswith("utm_")
    ]
    params.sort(key=lambda kv: kv[0])
    query = "&".join(
        k if v == "" else f"{k}={quote(v, safe=chr(33) + chr(42) + chr(39) + chr(40) + chr(41))}"
        for k, v in params
    )

    # Єдине кодування шляху: декодувати й перекодувати як JS encodeURI(decodeURI()).
    path = parts.path.rstrip("/")
    path = quote(unquote(path), safe=";,/:@&=+$-_.!~*'()")
    path = strip_lang_prefix(path)
    # Нестандартний порт зберігаємо: інший порт — інший сайт.
    port = f":{parts.port}" if parts.port and parts.port not in (80, 443) else ""

    return f"https://{host}{port}{path}" + (f"?{query}" if query else "")
