"""Позначки джерела (UTM) на НАШИХ посиланнях — дзеркало lib/utm.js.

Без них GA4 записує перехід із Telegram чи пошти як «прямий» (04.10.2026 —
22% відвідувань без джерела). Позначка лише для адрес dityam.com.ua, крім
/admin і /api; видимий текст посилання не міняється — тільки href.
"""
import re
from urllib.parse import quote

UTM_CHANNEL = {"source": "telegram", "medium": "social", "campaign": "channel"}
UTM_PLUS_BOT = {"source": "telegram", "medium": "social", "campaign": "dityam_plus"}
UTM_ORGANIZER_EMAIL = {"source": "email", "medium": "email", "campaign": "organizer_letter"}

_SITE_RE = re.compile(r"^https?://(?:www\.)?dityam\.com\.ua(?=[/?#]|$)", re.I)
_SKIP_PATH_RE = re.compile(r"^https?://[^/]+/(?:admin|api)(?:[/?#]|$)", re.I)
_HAS_UTM_RE = re.compile(r"[?&](?:amp;)?utm_source=", re.I)
_HREF_RE = re.compile(r"""href=(["'])(.*?)\1""")


def _utm_query(tag: dict, sep: str) -> str:
    pairs = [("utm_source", tag["source"]), ("utm_medium", tag["medium"]),
             ("utm_campaign", tag["campaign"])]
    if tag.get("content"):
        pairs.append(("utm_content", tag["content"]))
    return sep.join(f"{k}={quote(str(v), safe='')}" for k, v in pairs)


def with_utm(url, tag, sep: str = "&"):
    """Одна адреса з позначкою. sep='&amp;' — для href усередині HTML."""
    if not tag or not isinstance(url, str) or not _SITE_RE.match(url):
        return url
    if _SKIP_PATH_RE.match(url) or _HAS_UTM_RE.search(url):
        return url
    base, hash_ = (url.split("#", 1) + [""])[:2]
    hash_ = f"#{hash_}" if "#" in url else ""
    joiner = sep if "?" in base else "?"
    return f"{base}{joiner}{_utm_query(tag, sep)}{hash_}"


def tag_site_links(html: str, tag) -> str:
    """Усі href на наш сайт у готовому HTML-повідомленні чи листі."""
    if not tag or not isinstance(html, str):
        return html
    return _HREF_RE.sub(lambda m: f"href={m.group(1)}{with_utm(m.group(2), tag, '&amp;')}{m.group(1)}", html)


def tag_keyboard(markup, tag):
    """Кнопки inline_keyboard з url на наш сайт."""
    if not tag or not isinstance(markup, dict) or not isinstance(markup.get("inline_keyboard"), list):
        return markup
    rows = [[{**b, "url": with_utm(b["url"], tag)} if isinstance(b, dict) and isinstance(b.get("url"), str) else b
             for b in row] for row in markup["inline_keyboard"]]
    return {**markup, "inline_keyboard": rows}
