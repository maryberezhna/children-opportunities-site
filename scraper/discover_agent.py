"""discover_agent.py — щоденний агент веб-пошуку можливостей (Claude).

Бере 1 ключове слово (детермінована ротація по днях через словник), просить
Claude пошукати в інтернеті СВІЖІ конкретні можливості для дітей 0–18 в Україні
за цим словом, і зберігає знайдених кандидатів зі статусом ``draft``. На сайті
драфти не показуються (сайт фільтрує status='active') — їх схвалюють вручну на
/admin.

Env:
  ANTHROPIC_API_KEY         — ключ (web search має бути увімкнений в організації)
  SUPABASE_URL / SUPABASE_SERVICE_KEY
  DISCOVER_MODEL            — опц., модель (деф. claude-haiku-4-5-20251001).
                             Якщо буде HTTP 400 "web search not supported" —
                             постав claude-opus-4-8.
  DISCOVER_MAX              — опц., скільки кандидатів шукати (деф. 5)
  DRY_RUN=true              — лише вивести, нічого не писати
"""
import os
import re
import json
import difflib
import hashlib
import logging
from datetime import date, datetime, timezone

import httpx
from slugify import slugify

from db import get_client
from keywords import KEYWORD_CATEGORIES
from normalizer import _sanitize

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Web search is not supported on every model — haiku 4.5 returns HTTP 400.
# Default to sonnet-5 (supports web search, cheaper than opus); override with
# DISCOVER_MODEL=claude-opus-4-8 if needed.
MODEL = os.environ.get("DISCOVER_MODEL") or "claude-sonnet-5"
MAX_CANDIDATES = int(os.environ.get("DISCOVER_MAX", "5"))
DRY_RUN = os.environ.get("DRY_RUN") == "true"
# Duplicate control: ≥ DUP_SKIP title match → drop the candidate entirely;
# DUP_TAG..DUP_SKIP → keep but flag as a possible duplicate of the match.
DUP_SKIP = float(os.environ.get("DUP_SKIP", "0.80"))
DUP_TAG = float(os.environ.get("DUP_TAG", "0.60"))

# Specific, meaningful search terms (the 12 themes, flattened). Generic signal
# words from keywords.ALL_KEYWORDS are intentionally excluded — they make poor
# stand-alone search queries.
KEYWORDS = sorted({kw for kws in KEYWORD_CATEGORIES.values() for kw in kws})


def keyword_of_day() -> str:
    """Deterministic keyword-of-the-day — rotates through the whole list once
    every len(KEYWORDS) days, no state needed."""
    doy = date.today().timetuple().tm_yday
    return KEYWORDS[doy % len(KEYWORDS)]


def _prompt(kw: str) -> str:
    return (
        f"Знайди в інтернеті до {MAX_CANDIDATES} КОНКРЕТНИХ, актуальних можливостей "
        f"для ДІТЕЙ 0–18 років в Україні за темою «{kw}». Використай веб-пошук.\n\n"
        "Кожна має бути:\n"
        "- для дітей/підлітків 0–18 (НЕ для дорослих чи студентів ВНЗ),\n"
        "- конкретна, з реальним організатором і сторінкою (НЕ агрегатор/каталог),\n"
        "- бажано з активним дедлайном або набором, що триває.\n\n"
        "Поверни ВІДПОВІДЬ ЛИШЕ як JSON-масив (без пояснень, без markdown):\n"
        '[{"title":"...","summary":"1-3 речення опису","url":"https-посилання",'
        '"deadline":"YYYY-MM-DD або null","age_from":7,"age_to":17,'
        '"opportunity_type":"course|olympiad|competition|club|camp|scholarship|grant|festival|exchange|workshop",'
        '"cost_type":"free|partially_free|paid_affordable"}]\n'
        "Якщо нічого певного не знайдено — поверни []."
    )


def _extract_json_array(text: str):
    """Parse the first balanced JSON array in the text, ignoring any trailing
    prose (e.g. a citation/source list the model may append). Tries each '['
    position with raw_decode so a greedy '[.*]' span can't swallow non-JSON."""
    decoder = json.JSONDecoder()
    start = 0
    while True:
        i = text.find("[", start)
        if i == -1:
            return None
        try:
            value, _ = decoder.raw_decode(text, i)
            if isinstance(value, list):
                return value
        except json.JSONDecodeError:
            pass
        start = i + 1


def search_candidates(kw: str) -> list[dict]:
    body = {
        "model": MODEL,
        "max_tokens": 5000,
        # No user_location — the web_search tool rejects country code "UA"
        # ("Country code UA is not supported"). Ukraine focus comes from the
        # prompt text instead.
        "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}],
        "messages": [{"role": "user", "content": _prompt(kw)}],
    }
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
            timeout=180,
        )
    except Exception as e:
        logger.error("Request failed: %s", e)
        return []

    if r.status_code != 200:
        # Surface the real API message (e.g. low credit balance, web search
        # disabled, unsupported model) rather than guessing.
        detail = r.text[:400]
        try:
            detail = r.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Anthropic API HTTP %s: %s", r.status_code, detail)
        return []

    data = r.json()
    # Final answer = concatenation of top-level text blocks, in order.
    text = "".join(b.get("text", "") for b in data.get("content", [])
                   if b.get("type") == "text")
    searches = data.get("usage", {}).get("server_tool_use", {}).get("web_search_requests")
    logger.info("  web searches used: %s", searches)

    stop = data.get("stop_reason")
    if stop in ("max_tokens", "pause_turn"):
        logger.warning("  stop_reason=%s — відповідь могла обірватись, кандидати можуть бути неповні.", stop)

    parsed = _extract_json_array(text)
    if parsed is None:
        logger.info("  JSON-масив не виділено. Голова тексту: %s",
                    text[:200].replace("\n", " "))
        return []
    return [c for c in parsed if isinstance(c, dict)]


def _clamp_age(v, default):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(0, min(18, n))


def to_record(c: dict, kw: str) -> dict | None:
    title = (c.get("title") or "").strip()
    url = (c.get("url") or "").strip()
    if not title or not url.startswith("http"):
        return None

    rec = {
        "title": title[:300],
        "summary": (c.get("summary") or "").strip()[:400],
        "age_from": _clamp_age(c.get("age_from"), 0),
        "age_to": _clamp_age(c.get("age_to"), 18),
        "opportunity_type": c.get("opportunity_type"),
        "cost_type": c.get("cost_type"),
        "deadline": c.get("deadline"),
        "source": f"🔎 Агент: {kw}",
        "source_url": url,
        "status": "draft",
    }
    rec = _sanitize(rec)
    if rec["age_from"] > rec["age_to"]:
        rec["age_from"], rec["age_to"] = 0, 18

    short = hashlib.md5(f"{title}{url}".encode()).hexdigest()[:6]
    rec["slug"] = f"{slugify(title, max_length=80, word_boundary=True)}-{short}"
    normalized = re.sub(r"[^\w\s]", "", title.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    rec["content_hash"] = hashlib.sha256(f"{normalized}|{url}".encode()).hexdigest()[:16]
    return rec


def _norm_title(t: str) -> str:
    t = (t or "").lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _best_match(title: str, existing: list) -> tuple:
    """existing: list of (slug, normalized_title). Returns (slug, score) of the
    closest existing opportunity by title similarity."""
    nt = _norm_title(title)
    if not nt:
        return None, 0.0
    best_slug, best = None, 0.0
    for slug, ntitle in existing:
        if not ntitle:
            continue
        score = difflib.SequenceMatcher(None, nt, ntitle).ratio()
        if score > best:
            best, best_slug = score, slug
    return best_slug, best


def main() -> int:
    kw = keyword_of_day()
    logger.info("🔎 Агент — слово дня: «%s» (модель %s)%s",
                kw, MODEL, " [DRY RUN]" if DRY_RUN else "")

    candidates = search_candidates(kw)
    logger.info("  Знайдено кандидатів: %d", len(candidates))
    if not candidates:
        return 0

    client = get_client()

    # Existing titles (active + draft) for duplicate analysis — every candidate
    # is compared against these BEFORE it can enter the moderation queue.
    try:
        rows = (client.table("opportunities").select("title, slug")
                .in_("status", ["active", "draft"]).execute().data or [])
    except Exception as e:
        logger.warning("  Не вдалося завантажити наявні для дедупу: %s", e)
        rows = []
    existing = [(r["slug"], _norm_title(r.get("title"))) for r in rows if r.get("slug")]

    added, skipped, dup_skipped, flagged = 0, 0, 0, 0
    for c in candidates:
        rec = to_record(c, kw)
        if not rec:
            skipped += 1
            continue

        # Duplicate analysis (also catches near-dupes within this batch).
        best_slug, score = _best_match(rec["title"], existing)
        if score >= DUP_SKIP:
            dup_skipped += 1
            logger.info("  ⏭ дублікат %.0f%% (з %s) — не пропоную: %s",
                        score * 100, best_slug, rec["title"][:55])
            continue
        if score >= DUP_TAG:
            rec["dup_of"] = best_slug
            rec["dup_score"] = round(score, 3)
            flagged += 1

        if DRY_RUN:
            tag = f"  ⚠ схоже на {best_slug} ({score:.0%})" if rec.get("dup_of") else ""
            logger.info("  [DRY] %s → %s%s", rec["title"][:60], rec["source_url"], tag)
            added += 1
            existing.append((rec["slug"], _norm_title(rec["title"])))
            continue

        try:
            if (client.table("opportunities").select("id")
                    .eq("content_hash", rec["content_hash"]).execute().data):
                skipped += 1
                continue
            client.table("opportunities").insert(
                {**rec, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).execute()
            added += 1
            existing.append((rec["slug"], _norm_title(rec["title"])))
            logger.info("  ✅ draft%s: %s",
                        f" ⚠дубль~{int(score*100)}%" if rec.get("dup_of") else "",
                        rec["title"][:65])
        except Exception as e:
            logger.error("  ✗ insert failed for '%s': %s", rec["title"][:50], e)
            skipped += 1

    logger.info("\nГотово: %d драфтів (%d з тегом «дубль»), %d як дублікати відкинуто, "
                "%d інших пропущено. Модерація — на /admin.",
                added, flagged, dup_skipped, skipped)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
