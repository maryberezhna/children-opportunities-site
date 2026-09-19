"""plus_profile.py — профіль Dityam+ і добір можливостей під нього.

Дзеркало lib/plusProfile.js: бот на JS і дайджест із нагадуваннями на Python
мусять добирати однаково. Тримається тими самими тестами
(tests/plusProfile.test.mjs і scraper/tests/test_plus_profile.py) — правити
обидва файли.

Модель (14.09.2026):
  родина — де шукати (places) і чи показувати платне (cost_pref);
  кожна дитина — вік, вподобання, формат участі й особливі обставини.

Без мережі й без змінних оточення: імпортується в тестах напряму.
"""

MAX_CHILDREN = 6

AGE_RANGES = {"0-3": (0, 3), "4-6": (4, 6), "7-10": (7, 10), "11-14": (11, 14), "15-18": (15, 18)}
# У синхроні з lib/plusProfile.js (19.09.2026: додано 4 теми і 3 формати).
LIKE_KEYS = ("stem", "arts", "sport", "languages", "soft_skills", "career",
             "nature", "health", "history", "business")

FORMAT_TYPES = {
    "clubs": ("club", "course", "workshop", "study_program", "mentorship", "educational_material"),
    "camps": ("camp", "summer_school", "excursion"),
    "contests": ("competition", "olympiad", "hackathon", "sport_tournament", "festival", "award", "conference", "sport_event"),
    "grants": ("scholarship", "grant", "exchange", "residency", "study_abroad"),
    "support": ("psychology", "rehabilitation", "medical_aid"),
    "family_aid": ("allowance", "support_payment", "humanitarian", "shelter", "legal_aid"),
    "volunteering": ("volunteer", "internship"),
}
FORMAT_THEMES = {
    "clubs": ("format", "nonformal"), "camps": ("camps",), "contests": ("contests",), "grants": (),
    "support": (), "family_aid": (), "volunteering": (),
}

PLACE_ONLINE = "online"
PLACE_ABROAD = "abroad"
PLACE_OTHER = "__other"

EMPTY_CHILD = {"position": 1, "age_bands": [], "likes": [], "formats": [], "needs": []}


def age_overlap(a_from, a_to, bands) -> bool:
    if not bands:
        return True
    for b in bands:
        r = AGE_RANGES.get(b)
        if r and a_from <= r[1] and a_to >= r[0]:
            return True
    return False


def formats_of(o: dict, themes: set) -> set:
    out = set()
    for key, types in FORMAT_TYPES.items():
        if o.get("opportunity_type") in types or any(t in themes for t in FORMAT_THEMES[key]):
            out.add(key)
    return out


def place_ok(o: dict, places) -> bool:
    """Порожній вибір — будь-де. «Вся Україна» підходить кожному, хто шукає
    в Україні. Запис без позначки місця при непорожньому виборі не підходить:
    вгадувати, де він, не будемо."""
    if not places:
        return True
    want = set(places)
    cities = o.get("cities") or []
    if PLACE_ONLINE in want and (o.get("format") in ("online", "hybrid") or "Онлайн" in cities):
        return True
    if PLACE_ABROAD in want and (
        o.get("is_international")
        or any(c and c != "ua" for c in (o.get("countries") or []))
        or "Міжнародні" in cities
    ):
        return True
    real = [p for p in places if p not in (PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER)]
    if (real or PLACE_OTHER in want) and "Вся Україна" in cities:
        return True
    return any(c in cities for c in real)


def child_match(child: dict, o: dict, themes: set):
    """None — не підходить, 'need' — через особливу обставину, 'profile' —
    через вподобання й формат. Обставина відкриває запис поза вподобаннями,
    але вік перевіряємо завжди."""
    if not age_overlap(o["age_from"], o["age_to"], child.get("age_bands") or []):
        return None
    needs = child.get("needs") or []
    if needs and any(n in needs for n in (o.get("child_needs") or [])):
        return "need"
    likes = child.get("likes") or []
    if likes and not any(l in themes for l in likes):
        return None
    formats = child.get("formats") or []
    if formats and not (set(formats) & formats_of(o, themes)):
        return None
    return "profile"


def children_of(sub: dict, rows) -> list:
    """Діти підписника. Без окремих профілів — одна дитина зі старих полів
    рядка (анкета до 14.09.2026 і вебформа)."""
    own = sorted((r for r in (rows or []) if r.get("subscriber_id") == sub.get("id")),
                 key=lambda r: r.get("position") or 0)
    if own:
        return own
    interests = sub.get("interests") or []
    bands = sub.get("age_bands") or []
    if not bands and not interests:
        return [dict(EMPTY_CHILD)]
    formats = []
    if any(i in ("format", "nonformal") for i in interests):
        formats.append("clubs")
    if "camps" in interests:
        formats.append("camps")
    if "contests" in interests:
        formats.append("contests")
    return [{"position": 1, "age_bands": bands,
             "likes": [i for i in interests if i in LIKE_KEYS],
             "formats": formats, "needs": []}]


def child_label(child: dict, count: int) -> str:
    if count <= 1:
        return ""
    ranges = [AGE_RANGES[b] for b in (child.get("age_bands") or []) if b in AGE_RANGES]
    span = f"{min(r[0] for r in ranges)}–{max(r[1] for r in ranges)} р." if ranges else ""
    return f"Дитина {child.get('position')}" + (f" ({span})" if span else "")


def match_family(sub: dict, children: list, opps: list) -> list:
    """Записи, що підходять хоч одній дитині. Кожен один раз, зі списком
    дітей. Записи через особливу обставину — нагору. Теми беремо з o['_themes']."""
    kids = children or [dict(EMPTY_CHILD)]
    free_only = sub.get("cost_pref") == "free_only"
    by_need, rest = [], []
    for o in opps:
        if free_only and o.get("cost_type") != "free":
            continue
        if not place_ok(o, sub.get("places") or []):
            continue
        themes = o.get("_themes") or set()
        hits, via_need = [], False
        for k in kids:
            m = child_match(k, o, themes)
            if m:
                hits.append(k)
                via_need = via_need or m == "need"
        if hits:
            (by_need if via_need else rest).append({"o": o, "kids": hits, "via_need": via_need})
    return by_need + rest


def pick_fair(matches: list, children: list, limit: int) -> list:
    """Ділимо місця в повідомленні по черзі між дітьми."""
    if not children or len(children) <= 1:
        return matches[:limit]
    queues = [[m for m in matches if any(k is c for k in m["kids"])] for c in children]
    taken, out = set(), []
    progressed = True
    while len(out) < limit and progressed:
        progressed = False
        for q in queues:
            if len(out) >= limit:
                break
            while q and id(q[0]) in taken:
                q.pop(0)
            if q:
                m = q.pop(0)
                taken.add(id(m))
                out.append(m)
                progressed = True
    return out


def for_line(match: dict, count: int) -> str:
    """«для: Дитина 1 (7–10 р.), Дитина 2 (15–18 р.)» або порожньо."""
    if count <= 1:
        return ""
    return "для: " + ", ".join(child_label(k, count) for k in match["kids"])
