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

# PLACE_ONLINE і PLACE_ABROAD — колишні кнопки «💻 Онлайн» і «✈️ За кордоном».
# З 22.09.2026 кнопок в анкеті немає (онлайн і закордон приходять кожному),
# але в старих профілях ці значення збережені й мають лишатись нешкідливими.
PLACE_ONLINE = "online"
PLACE_ABROAD = "abroad"
PLACE_OTHER = "__other"
PLACE_PSEUDO = (PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER)


def chosen_cities(places) -> list:
    """Міста з профілю — без службових значень (online/abroad/__other)."""
    return [p for p in (places or []) if p not in PLACE_PSEUDO]

EMPTY_CHILD = {"position": 1, "age_bands": [], "likes": [], "formats": [], "needs": []}


def age_overlap(a_from, a_to, bands) -> bool:
    """Можливість покриває майже всю вікову смугу дитини, а не один рік
    (27.10.2026): спільних років щонайменше (довжина смуги − 1), для 7–10 —
    три. Вужча можливість (табір для 8–9) підходить, якщо цілком у смузі.
    Дзеркало ageOverlap у lib/plusProfile.js."""
    if not bands:
        return True
    a = 0 if a_from is None else a_from
    z = 18 if a_to is None else a_to
    for b in bands:
        r = AGE_RANGES.get(b)
        if not r:
            continue
        shared = min(z, r[1]) - max(a, r[0]) + 1
        need = min(r[1] - r[0], z - a + 1)
        if shared >= need:
            return True
    return False


def age_known(o: dict) -> bool:
    """«0–18» без цитати зі сторінки (evidence.age) — це «вік не знайшли»:
    порожній вік база зберігає як 0–18. Такий запис Dityam+ не надсилає.
    age_evidence — evidence->age з вибірки. Дзеркало ageKnown."""
    a = 0 if o.get("age_from") is None else o.get("age_from")
    z = 18 if o.get("age_to") is None else o.get("age_to")
    if not (a == 0 and z == 18):
        return True
    ev = o.get("age_evidence")
    if ev is None:
        ev = (o.get("evidence") or {}).get("age")
    return bool(ev)


def is_local_abroad(o: dict) -> bool:
    """Подати можуть лише ті, хто живе в іншій країні (abroad_only), або
    місцева програма країни без України й не міжнародна. Дзеркало isLocalAbroad."""
    if o.get("ua_eligibility") == "abroad_only":
        return True
    cc = [c for c in (o.get("countries") or []) if c]
    return (not o.get("is_international")) and bool(cc) and "ua" not in cc


def formats_of(o: dict, themes: set) -> set:
    out = set()
    for key, types in FORMAT_TYPES.items():
        if o.get("opportunity_type") in types or any(t in themes for t in FORMAT_THEMES[key]):
            out.add(key)
    return out


def place_ok(o: dict, places) -> bool:
    """Онлайн, всеукраїнське й закордонне підходить кожному завжди. Місто
    лише додає офлайн-записи, де це місто є в cities. Порожній вибір — будь-де.
    Запис без жодної позначки місця при обраному місті не підходить:
    вгадувати, де він, не будемо.

    Рішення Марії 22.09.2026: «стоп, ми не гарантуємо, що будуть можливості
    саме з міста» → «тоді нам треба видалити [обмеження], щоб ми показували
    все по Україні, онлайн і закордоном». До того онлайн і закордон треба було
    обирати кнопками, і родина з Ніжина, що їх не натиснула, лишалась ні з чим.
    Старі значення online/abroad/__other у профілі — не місто: нічого не
    додають і нічого не забирають."""
    cities = o.get("cities") or []
    if is_local_abroad(o):
        # Місцеве закордонне — лише родині з містом запису або «за кордон».
        return PLACE_ABROAD in (places or []) or any(c in cities for c in chosen_cities(places))
    if not places:
        return True
    if o.get("format") in ("online", "hybrid") or "Онлайн" in cities:
        return True
    if "Вся Україна" in cities:
        return True
    if (
        o.get("is_international")
        or any(c and c != "ua" for c in (o.get("countries") or []))
        or "Міжнародні" in cities
    ):
        return True
    return any(c in cities for c in chosen_cities(places))


def child_match(child: dict, o: dict, themes: set):
    """None — не підходить, 'need' — через особливу обставину, 'profile' —
    через вподобання й формат. Обставина відкриває запис поза вподобаннями,
    але вік перевіряємо завжди."""
    if not age_known(o):
        return None
    if not age_overlap(o.get("age_from"), o.get("age_to"), child.get("age_bands") or []):
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
