"""Відмови людини з причиною — приклади того, чого пошук більше не приносить.

Марія, 28.09.2026, про кнопку в черзі: «Не підходить (не шукати такі
можливості, залишити дропдаун чому ж)». Кнопка пише код причини в
moderation_corrections (field='__decision', after.reason); тут ці відмови
стають блоком у промпті discover_agent. Причини з teach=false (дубль, минуло,
нема першоджерела) нічого не кажуть про вид можливостей і в промпт не йдуть.

Перелік причин — lib/reject-reasons.json, той самий, що в адмінці.
"""
from __future__ import annotations

import json
import logging
import pathlib
import re
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

REASONS_PATH = pathlib.Path(__file__).resolve().parents[1] / "lib" / "reject-reasons.json"
DECISION_FIELD = "__decision"   # дзеркало lib/corrections.js
DAYS = 180
MAX_LINES = 30

# Посилання й домени з коментаря в промпт не йдуть (19.10.2026). Марія
# відхилила запис для дорослих і дописала «https://ucci.ie/events/ — збережи в
# базі, бо можна моніторити джерело». Текст лягав у блок «НЕ ПРИНОСЬ НІЧОГО
# ПОДІБНОГО» разом із доменом — і вчив пошук уникати рівно того сайту, який
# просили лишити. Рішення про джерело тепер окреме (кнопка в черзі → таблиця
# source_candidates), а сюди домен не потрапляє взагалі.
LINK_RE = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|\b[a-z0-9][a-z0-9-]*(?:\.[a-z]{2,})+(?:/\S*)?",
    re.IGNORECASE,
)


def strip_links(text) -> str:
    """Коментар без посилань і доменів. Порожньо — якщо нічого не лишилось."""
    cleaned = LINK_RE.sub(" ", str(text or ""))
    return " ".join(cleaned.split()).strip(" ,.;:\u2014-")


def load_reasons() -> dict:
    with open(REASONS_PATH, encoding="utf-8") as f:
        return {r["code"]: r for r in json.load(f)["reasons"]}


def teach_lines(rows: list[dict], titles: dict, reasons: dict, limit: int = MAX_LINES) -> list[str]:
    """Рядки «назва — причина». Чиста функція — під тести.

    rows — moderation_corrections, найновіші першими; titles — {id: назва}.
    Одна назва — один рядок: два відхилення того самого не вчать удвічі.
    """
    out, seen = [], set()
    for row in rows or []:
        after = row.get("after") if isinstance(row.get("after"), dict) else {}
        if after.get("action") != "reject":
            continue
        reason = reasons.get(after.get("reason"))
        if not reason or not reason.get("teach"):
            continue
        title = (titles.get(str(row.get("opportunity_id"))) or "").strip()
        if not title or title.casefold() in seen:
            continue
        seen.add(title.casefold())
        line = f"«{title[:120]}» — {reason['label'].lower()}"
        # Коментар про сайт — рішення про ДЖЕРЕЛО, а не про вид можливості:
        # у «не приноси такого» йому не місце.
        comment = "" if after.get("keep_source") else strip_links(after.get("comment"))
        if comment:
            line += f": {comment[:160]}"
        out.append(line)
        if len(out) >= limit:
            break
    return out


def avoid_block(lines: list[str]) -> str:
    """Блок для промпту пошуку. Порожньо — якщо вчитись ще нема на чому."""
    if not lines:
        return ""
    return ("\nМАРІЯ ВІДХИЛИЛА ТАКІ ЗНАХІДКИ — НЕ ПРИНОСЬ НІЧОГО ПОДІБНОГО\n"
            "(той самий вид, та сама причина; конкретні назви — лише приклади):\n"
            + "\n".join(f"- {line}" for line in lines) + "\n")


def fetch_lines(client, days: int = DAYS, limit: int = MAX_LINES) -> list[str]:
    """Свіжі відмови з причиною. Збій — порожній список: пошук без прикладів
    гірший, але не зламаний."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        rows = (client.table("moderation_corrections")
                .select("opportunity_id, after, created_at")
                .eq("field", DECISION_FIELD).gte("created_at", since)
                .order("created_at", desc=True).limit(300).execute().data or [])
        ids = list({str(r["opportunity_id"]) for r in rows if r.get("opportunity_id")})
        titles = {}
        if ids:
            opps = (client.table("opportunities").select("id, title")
                    .in_("id", ids[:300]).execute().data or [])
            titles = {str(o["id"]): o.get("title") or "" for o in opps}
        return teach_lines(rows, titles, load_reasons(), limit)
    except Exception as e:  # noqa: BLE001
        logger.warning("Відмови людини прочитати не вдалося: %s", e)
        return []
