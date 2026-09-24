"""Посилання «у календар» для бота — дзеркало lib/calendar-links.js.

Навіщо окремий модуль. Кнопка в добірці вела на сторінку сайту
/events/<slug>/add, а та лише показувала два варіанти й чекала ще одного
кліку. Марія 25.09.2026: «чому він відкриває сайт, коли можна напряму дати
те посилання». Тепер бот дає адресу Google Calendar одразу — а сторінка
лишається для тих, хто прийде на неї зі старих посилань.

Що саме ставимо в календар — те саме, що на сайті (calendarTarget):
дедлайн, поки він попереду, інакше дати самої події. Спільні приклади для
обох мов — tests/fixtures/calendar-cases.json.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from urllib.parse import urlencode


def _as_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def calendar_target(o: dict, today: date) -> dict | None:
    """Що ставити в календар: {kind, start, end} або None, якщо нічого.

    Чиста функція — під тести. Дзеркало calendarTarget з lib/calendar-links.js:
    розбіжність означала б кнопку, яка веде на сторінку, а та редиректить на
    саму можливість (на 25.09.2026 так поводився 1 запис зі 130).
    """
    deadline = _as_date(o.get("deadline"))
    if deadline and deadline >= today:
        return {"kind": "deadline", "start": deadline, "end": deadline}
    start = _as_date(o.get("event_start_date")) or _as_date(o.get("event_end_date"))
    end = _as_date(o.get("event_end_date")) or _as_date(o.get("event_start_date"))
    if start and end and end >= today:
        return {"kind": "event", "start": start, "end": end}
    return None


def google_calendar_url(o: dict, target: dict, site_url: str) -> str:
    """Адреса, яка відкриває Google Calendar із заповненою подією.

    `dates` мусить бути проміжком: «20261020/20261020» Google не приймав, і
    подія просто не створювалась — саме через це кнопка «не працювала».
    Дедлайн — зустріч о 09:00 того дня (як у .ics), подія — цілі дні, де
    кінець не включно.
    """
    page = f"{site_url}/o/{o['slug']}"
    start = target["start"].strftime("%Y%m%d")
    is_deadline = target["kind"] == "deadline"
    params = {
        "action": "TEMPLATE",
        "text": f"Заявки до: {o['title']}" if is_deadline else o["title"],
        "dates": (f"{start}T090000/{start}T095900" if is_deadline
                  else f"{start}/{(target['end'] + timedelta(days=1)).strftime('%Y%m%d')}"),
        "details": f"{o['summary']}\n\n{page}" if o.get("summary") else page,
        "sprop": f"website:{site_url}",
    }
    if is_deadline:
        params["ctz"] = "Europe/Kyiv"
    return "https://calendar.google.com/calendar/render?" + urlencode(params)
