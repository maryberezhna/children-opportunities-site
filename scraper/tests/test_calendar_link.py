"""Кнопка «у календар» у боті (25.09.2026).

Марія: «у боті не працює календар — 1) чому він відкриває сайт, коли можна
напряму дати те посилання, 2) воно його не додає».

Обидві причини тут під тестами: посилання веде прямо в Google Calendar, а
дати утворюють справжній проміжок — «20261020/20261020» Google не приймав, і
подія не створювалась. Приклади спільні з сайтом: tests/fixtures/calendar-cases.json.
"""
import json
import os
import pathlib
import sys
import unittest
from datetime import date, datetime
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from calendar_link import calendar_target, google_calendar_url  # noqa: E402

FIXTURE = json.loads(
    (pathlib.Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "calendar-cases.json")
    .read_text(encoding="utf-8"))
TODAY = datetime.strptime(FIXTURE["today"], "%Y-%m-%d").date()
SITE = "https://dityam.com.ua"


def _params(url):
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


class SharedCases(unittest.TestCase):
    """Ті самі приклади, що й у сайту: кнопка й сторінка мусять вирішувати
    однаково, інакше клік веде туди, де додавати вже нічого."""

    def test_targets(self):
        for case in FIXTURE["cases"]:
            got = calendar_target(case["item"], TODAY)
            if case["target"] is None:
                self.assertIsNone(got, case["name"])
                continue
            self.assertEqual(got["kind"], case["target"]["kind"], case["name"])
            self.assertEqual(got["start"].isoformat(), case["target"]["start"], case["name"])
            self.assertEqual(got["end"].isoformat(), case["target"]["end"], case["name"])

    def test_urls(self):
        for case in (c for c in FIXTURE["cases"] if c["target"]):
            target = calendar_target(case["item"], TODAY)
            p = _params(google_calendar_url(case["item"], target, SITE))
            self.assertEqual(p["dates"], case["dates"], case["name"])
            self.assertEqual(p["text"], case["text"], case["name"])

    def test_dates_are_never_an_empty_span(self):
        # Саме через це календар «не додавав».
        for case in (c for c in FIXTURE["cases"] if c["target"]):
            target = calendar_target(case["item"], TODAY)
            start, end = _params(google_calendar_url(case["item"], target, SITE))["dates"].split("/")
            self.assertNotEqual(start, end, case["name"])


class UrlShape(unittest.TestCase):
    def test_link_goes_straight_to_google(self):
        # Не на сторінку сайту: доти людина мусила клікнути ще раз.
        url = google_calendar_url(
            {"slug": "x", "title": "Конкурс", "summary": "опис"},
            calendar_target({"deadline": "2026-10-20"}, TODAY), SITE)
        self.assertTrue(url.startswith("https://calendar.google.com/calendar/render?"))

    def test_deadline_carries_kyiv_timezone(self):
        p = _params(google_calendar_url(
            {"slug": "x", "title": "Конкурс"},
            calendar_target({"deadline": "2026-10-20"}, TODAY), SITE))
        self.assertEqual(p["ctz"], "Europe/Kyiv")

    def test_details_hold_the_page_link(self):
        p = _params(google_calendar_url(
            {"slug": "konkurs", "title": "Конкурс", "summary": "опис"},
            calendar_target({"deadline": "2026-10-20"}, TODAY), SITE))
        self.assertIn(f"{SITE}/o/konkurs", p["details"])
        self.assertIn("опис", p["details"])

    def test_string_and_date_objects_both_work(self):
        # З бази дати приходять рядками, у тестах — date.
        self.assertEqual(
            calendar_target({"deadline": date(2026, 10, 20)}, TODAY)["start"],
            calendar_target({"deadline": "2026-10-20"}, TODAY)["start"])

    def test_broken_date_does_not_raise(self):
        self.assertIsNone(calendar_target({"deadline": "невідомо"}, TODAY))


if __name__ == "__main__":
    unittest.main()
