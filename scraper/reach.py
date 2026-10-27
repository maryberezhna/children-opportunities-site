"""Для кого можливість за місцем — чотири групи. Дзеркало lib/reach.js.

Рішення Марії 27.10.2026: «нам треба чітко розділити діаспору / рівні онлайн
можливості / і локальні можливості в україні».

  ukraine  — 🇺🇦 В Україні
  online   — 💻 Онлайн для всіх
  diaspora — 🌍 Живемо за кордоном (для дітей, що вже живуть в іншій країні)
  travel   — ✈️ Поїхати за кордон (обміни, стипендії, табори з України)

Лише поля, що вже є в базі: format, is_international, countries, cities,
ua_eligibility (і opportunity_type для гуртків за кордоном). Приклади спільні
з сайтом: tests/fixtures/reach-cases.json — бот і сайт мусять рахувати однаково.
"""
import re

REACH = ("ukraine", "online", "diaspora", "travel")

REACH_LABELS = {
    "ukraine": ("🇺🇦", "В Україні", "In Ukraine"),
    "online": ("💻", "Онлайн для всіх", "Online for all"),
    "diaspora": ("🌍", "Живемо за кордоном", "Living abroad"),
    "travel": ("✈️", "Поїхати за кордон", "Going abroad"),
}

# Гурток чи курс в іншій країні — для тих, хто там живе. Ті самі, що
# LOCAL_TYPES у lib/reach.js і lib/diaspora.js.
LOCAL_TYPES = {
    "club", "course", "workshop", "mentorship", "educational_material",
    "humanitarian", "psychology", "medical_aid", "legal_aid", "shelter",
}

_PSEUDO_CITIES = {"онлайн", "вся україна", "міжнародні", "україна"}
_ONLINE = re.compile(r"онлайн|online|дистанц", re.I)


def reach_label(reach, lang="uk"):
    """«🇺🇦 В Україні». Невідома група — порожній рядок."""
    l = REACH_LABELS.get(reach)
    if not l:
        return ""
    return f"{l[0]} {l[2] if lang == 'en' else l[1]}"


def _countries(o):
    return [str(c).lower() for c in (o.get("countries") or []) if c]


def _abroad(o):
    return [c for c in _countries(o) if c != "ua"]


def _real_cities(o):
    return [c for c in (o.get("cities") or []) if str(c).lower().strip() not in _PSEUDO_CITIES]


def _has_ua(o):
    return "ua" in _countries(o)


def _all_ukraine(o):
    return any(re.search(r"вся україна", c or "", re.I) for c in (o.get("cities") or []))


def _online(o):
    if _ONLINE.search(o.get("format") or ""):
        return True
    if any(re.search(r"онлайн|online", c or "", re.I) for c in (o.get("cities") or [])):
        return True
    return o.get("format") == "hybrid" and not _real_cities(o) and not (o.get("countries") or [])


def goes_abroad(o):
    """Дзеркало goesAbroad з lib/geo.js."""
    if _abroad(o):
        return True
    if _real_cities(o) and _has_ua(o):
        return False
    if _countries(o):  # лише Україна
        return False
    return bool(o.get("is_international")) and not _online(o)


def local_abroad(o):
    """Місцева програма іншої країни: не міжнародна, країна є, України немає."""
    return (not o.get("is_international")) and bool(_abroad(o)) and not _has_ua(o)


def reach_of(o):
    """'ukraine' | 'online' | 'diaspora' | 'travel' | None."""
    if not o:
        return None
    if o.get("ua_eligibility") == "abroad_only":
        return "diaspora"
    if o.get("ua_eligibility") != "from_ukraine" and _abroad(o):
        if local_abroad(o):
            return "diaspora"
        if o.get("opportunity_type") in LOCAL_TYPES and not _online(o):
            return "diaspora"
    if _online(o):
        return "online"
    if goes_abroad(o):
        return "travel"
    if _has_ua(o) or _real_cities(o) or _all_ukraine(o):
        return "ukraine"
    return None


def reach_doubt(o):
    """Чому групу варто перевірити людині: 'eligibility' | 'no_place' | 'mixed' | None."""
    r = reach_of(o)
    if r is None:
        return "no_place"
    if r == "diaspora" and o.get("ua_eligibility") != "abroad_only":
        return "eligibility"
    if r == "travel" and not _abroad(o) and _all_ukraine(o):
        return "mixed"
    return None
