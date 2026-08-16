"""Канонізація URL — єдиний ключ ідентичності можливості між усіма пайплайнами.

Дзеркало: scrapers/lib/canonical.mjs — правки мають іти в обидва файли синхронно.

Правила: https, хост у нижньому регістрі без www., без фрагмента, без
трекінгових параметрів, решта параметрів відсортована, без хвостового слеша.
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
    # Нестандартний порт зберігаємо: інший порт — інший сайт.
    port = f":{parts.port}" if parts.port and parts.port not in (80, 443) else ""

    return f"https://{host}{port}{path}" + (f"?{query}" if query else "")
