"""Backfill `child_needs` tags from opportunity text.

Problem this fixes
------------------
Only ~31 of ~385 live opportunities carry any `child_needs` tag, so the
vulnerable-group filters on the site (ВПО / інвалідність / онко / ветерани /
малозабезпечені / сироти) return almost nothing — even though the descriptions
clearly serve those groups (e.g. "ВПО, діти військових, малозабезпечені,
сироти" from a Постанова КМУ). The AI normalizer only tags `child_needs` when
it is very explicit, so historical rows stayed empty.

This script keyword-matches title + summary + description and UNIONS the
derived tags into the existing `child_needs` array. It never removes tags.

Safety
------
Defaults to DRY RUN — prints what would change and a per-tag tally, writes
nothing. Pass --apply to actually update Supabase.

    python scraper/backfill_child_needs.py            # dry run (safe)
    python scraper/backfill_child_needs.py --apply     # write changes

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (same as the
scraper). Run from the repo root.
"""
import sys
import re
from collections import Counter

from db import get_client

# Each tag maps to a list of case-insensitive substrings. Matching is done on a
# lower-cased concatenation of title + summary + description. Keep patterns
# specific to avoid false positives.
NEED_PATTERNS = {
    "idp": ["впо", "внутрішньо переміщ", "переселен", "вимушено переміщ"],
    "disability": [
        "інвалідн", "з інвалідністю", "особливими освітніми", "ооп",
        "нечуюч", "незряч", "порушенням слуху", "порушенням зору",
        "дцп", "інклюзивн",
    ],
    "gifted": ["обдарован", "талановит"],
    "oncology": ["онко", "онкозахвор", "лейкоз", "рак ", "пухлин", "tabletochki", "табелеточки"],
    "veteran_family": [
        "ветеран", "загиблих захисник", "загиблих військов", "загиблих героїв",
        "дітей героїв", "діти героїв", "родин загиблих", "полеглих",
    ],
    "low_income": ["малозабезпеч", "скрутн матеріальн", "з бідних", "з незаможних", "соціально незахищ"],
    "orphan": [
        "сирот", "дітей-сиріт", "позбавлених батьківського піклування",
        "позбавлені батьківського піклування", "під опікою",
    ],
    "frontline": ["прифронтов", "зоні бойових", "зони бойових"],
    "de_occupied": ["деокупован", "звільнених територ", "тимчасово окупован"],
    "rural": ["сільськ", "село", "малих міст"],
}


def derive_needs(text: str) -> set:
    text = (text or "").lower()
    found = set()
    for tag, patterns in NEED_PATTERNS.items():
        if any(p in text for p in patterns):
            found.add(tag)
    return found


def main() -> int:
    apply = "--apply" in sys.argv
    client = get_client()

    # select("*") so the script is robust whether or not a `description`
    # column exists — missing fields simply read back as None below.
    rows = (
        client.table("opportunities")
        .select("*")
        .execute()
        .data
        or []
    )
    print(f"Fetched {len(rows)} opportunities\n")

    added_tally = Counter()
    changed = 0
    newly_tagged = 0

    for row in rows:
        existing = set(row.get("child_needs") or [])
        text = " ".join(
            str(row.get(f) or "") for f in ("title", "summary", "description")
        )
        derived = derive_needs(text)
        to_add = derived - existing
        if not to_add:
            continue

        changed += 1
        if not existing:
            newly_tagged += 1
        for t in to_add:
            added_tally[t] += 1

        merged = sorted(existing | derived)
        title = (row.get("title") or "")[:60]
        print(f"  [{'WRITE' if apply else 'DRY'}] +{sorted(to_add)}  {title}")

        if apply:
            client.table("opportunities").update({"child_needs": merged}).eq(
                "id", row["id"]
            ).execute()

    print("\n=== Summary ===")
    print(f"Rows that would gain tags: {changed}  (of which newly tagged from empty: {newly_tagged})")
    print("Per-tag additions:")
    for tag, n in added_tally.most_common():
        print(f"  {tag:16} +{n}")
    if not apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to persist.")
    else:
        print("\nApplied. Redeploy not required (data is read live from Supabase).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
