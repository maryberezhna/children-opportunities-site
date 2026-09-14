"""source_report.py — що насправді дає кожне джерело. Без моделі.

Навіщо. 14.09.2026 з'ясувалось: з 02.09, коли вимкнули гурткові скрапери,
звичайний пошук додає 0–15 можливостей на день, а за останні сім скрапів 99%
сирих знахідок прийшли з Telegram, RSS і «Місця Сили» — і екстракція відкидала
80–100% з них. Причини відхилення в лог не пишуться, вони лежать у
raw_items.last_error. Цей звіт збирає їх по кожному каналу й стрічці окремо,
щоб було видно, що дає справжні можливості, а що — лише шум.

Модель не потрібна: лише читання raw_items і opportunities. Працює й тоді,
коли ліміт API вичерпано.

Запуск:
    python source_report.py            # за 30 днів
    python source_report.py --days 60

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY. Опційно GITHUB_STEP_SUMMARY — тоді
таблиця ляже й у підсумок запуску в Actions.
"""
import argparse
import collections
import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

_TG = re.compile(r"t\.me/(?:s/)?([A-Za-z0-9_]{3,})", re.IGNORECASE)


def group_key(source_name: str | None, source_url: str | None) -> str:
    """Telegram — по каналу, RSS — по стрічці (хосту), решта — по назві джерела."""
    url = source_url or ""
    m = _TG.search(url)
    if m:
        return f"TG @{m.group(1).lower()}"
    name = (source_name or "—").strip()
    if "rss" in name.lower():
        host = urlparse(url).netloc.lower().removeprefix("www.")
        return f"RSS {host or name}"
    return name


def normalize_reason(error: str | None) -> str:
    """Причина без конкретики (адрес, чисел, id), щоб однакові склеювались."""
    text = (error or "причину не записано").strip()
    if text.startswith("duplicate"):
        return "дубль — уже є в базі"
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[0-9a-f]{8}-[0-9a-f-]{27,}", "", text)
    text = re.sub(r"\d+", "N", text)
    text = re.sub(r"«[^»]{0,80}»", "«…»", text)
    return re.sub(r"\s+", " ", text).strip(" .·—-")[:90] or "причину не записано"


def _fetch_all(query, page: int = 1000) -> list[dict]:
    rows, start = [], 0
    while True:
        chunk = query.range(start, start + page - 1).execute().data or []
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        start += page


def build(raw: list[dict], opp_status: dict) -> dict:
    groups = collections.defaultdict(lambda: {
        "raw": 0, "saved": 0, "active": 0, "draft": 0, "closed": 0, "dup": 0,
        "rejected": 0, "pending": 0, "failed": 0,
        "reasons": collections.Counter(), "types": collections.Counter(), "titles": [],
    })
    overall = collections.Counter()
    for r in raw:
        g = groups[group_key(r.get("source_name"), r.get("source_url"))]
        g["raw"] += 1
        st = r.get("status")
        if st == "processed":
            g["saved"] += 1
            o = opp_status.get(r.get("opportunity_id")) or {}
            if o.get("status") in ("active", "draft", "closed"):
                g[o["status"]] += 1
            if o.get("opportunity_type"):
                g["types"][o["opportunity_type"]] += 1
            if o.get("title") and len(g["titles"]) < 3:
                g["titles"].append(o["title"][:70])
        elif st == "rejected":
            reason = normalize_reason(r.get("last_error"))
            if reason.startswith("дубль"):
                g["dup"] += 1
            else:
                g["rejected"] += 1
                g["reasons"][reason] += 1
                overall[reason] += 1
        elif st == "failed":
            g["failed"] += 1
        else:
            g["pending"] += 1
    return {"groups": groups, "overall": overall}


def verdict(g: dict) -> str:
    useful = g["active"] + g["draft"]
    if g["raw"] >= 10 and useful == 0:
        return "шум"
    if g["raw"] >= 10 and useful / g["raw"] < 0.05:
        return "майже шум"
    if useful >= 3:
        return "корисне"
    return "мало даних"


def render(report: dict, days: int) -> str:
    groups = report["groups"]
    out = [f"# Джерела за {days} днів\n",
           "| Джерело | Сирих | Збережено | на сайті | чернетки | дублі | відхилено | висновок |",
           "|---|---:|---:|---:|---:|---:|---:|---|"]
    for name, g in sorted(groups.items(), key=lambda x: -x[1]["raw"]):
        out.append(f"| {name} | {g['raw']} | {g['saved']} | {g['active']} | {g['draft']} | "
                   f"{g['dup']} | {g['rejected']} | {verdict(g)} |")
    tot = {k: sum(g[k] for g in groups.values()) for k in ("raw", "saved", "active", "draft", "dup", "rejected", "pending", "failed")}
    out.append(f"\n**Разом:** сирих {tot['raw']} · збережено {tot['saved']} (на сайті {tot['active']}, "
               f"чернетки {tot['draft']}) · дублі {tot['dup']} · відхилено {tot['rejected']} · "
               f"у черзі {tot['pending']} · вичерпали спроби {tot['failed']}\n")
    out.append("## Причини відхилення — загалом\n")
    for reason, n in report["overall"].most_common(15):
        out.append(f"- {n} × {reason}")
    out.append("\n## По джерелах\n")
    for name, g in sorted(groups.items(), key=lambda x: -x[1]["raw"]):
        if g["raw"] < 3:
            continue
        out.append(f"### {name} — {verdict(g)}")
        out.append(f"сирих {g['raw']} · на сайті {g['active']} · чернетки {g['draft']} · закрито {g['closed']} · "
                   f"дублі {g['dup']} · відхилено {g['rejected']}")
        if g["types"]:
            out.append("типи збереженого: " + ", ".join(f"{t} {n}" for t, n in g["types"].most_common(5)))
        for t in g["titles"]:
            out.append(f"  - {t}")
        for reason, n in g["reasons"].most_common(4):
            out.append(f"  - ✗ {n} × {reason}")
        out.append("")
    return "\n".join(out)


def main() -> None:
    p = argparse.ArgumentParser(description="Що дає кожне джерело")
    p.add_argument("--days", type=int, default=30)
    args = p.parse_args()

    from db import get_client
    sb = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
    raw = _fetch_all(sb.table("raw_items")
                     .select("source_name, source_url, status, last_error, opportunity_id, fetched_at")
                     .gte("fetched_at", since).order("fetched_at"))
    ids = sorted({r["opportunity_id"] for r in raw if r.get("opportunity_id")})
    opp = {}
    for i in range(0, len(ids), 200):
        for o in (sb.table("opportunities").select("id, status, opportunity_type, title")
                  .in_("id", ids[i:i + 200]).execute().data or []):
            opp[o["id"]] = o

    text = render(build(raw, opp), args.days)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    main()
