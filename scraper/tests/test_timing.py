"""Правила виду за часом — рішення Марії 17.09.2026.

Кейси — з живої бази того дня: 598 гуртків з «постійним» набором, проставленим
за типом; фраза «Набір постійний, дедлайну немає», яку дописує сам скрапер;
платформи з вільним записом; щорічні олімпіади.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from timing import (  # noqa: E402
    clean_kind, clean_months, clean_text, months_from_dates,
    recurrence_from_text, rule_kind,
)


def row(**over):
    base = {"title": "t", "opportunity_type": "course", "source": "інше",
            "summary": "", "details": None, "deadline": None,
            "event_start_date": None, "event_end_date": None,
            "recurrence": None, "admin_comment": None}
    base.update(over)
    return base


class Rules(unittest.TestCase):
    def test_platform_is_permanent(self):
        kind, _m, why = rule_kind(row(source="Prometheus"))
        self.assertEqual(kind, "permanent")
        self.assertIn("платформа", why)

    def test_silent_club_is_permanent_with_flag(self):
        # Рішення Марії: текст мовчить про набір → постійний, але з позначкою.
        kind, _m, why = rule_kind(row(opportunity_type="club",
                                      summary="Гурток вокалу для дітей 7–12 років."))
        self.assertEqual(kind, "permanent")
        self.assertIn("перевірити", why)

    def test_club_with_september_enrollment_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="club",
                                        summary="Набір у студію — у вересні.")))

    def test_aid_without_dates_is_permanent(self):
        kind, _m, _w = rule_kind(row(opportunity_type="allowance"))
        self.assertEqual(kind, "permanent")

    def test_aid_with_deadline_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="allowance", deadline="2026-12-31")))

    def test_annual_from_text_is_periodic_with_months(self):
        kind, months, _w = rule_kind(row(opportunity_type="olympiad", recurrence="annual",
                                         deadline="2026-10-30"))
        self.assertEqual(kind, "periodic")
        self.assertEqual(months, [10])

    def test_type_stamped_recurrence_is_not_trusted(self):
        stamped = row(recurrence="ongoing",
                      admin_comment="auto: 11.09.2026 проставлено ongoing за типом")
        self.assertIsNone(recurrence_from_text(stamped))
        self.assertIsNone(rule_kind(stamped))  # курс → вирішує модель, а не штамп

    def test_competition_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="competition")))


class Cleaning(unittest.TestCase):
    def test_scraper_phrase_is_removed(self):
        text = clean_text("Гурток малювання. Набір постійний, дедлайну немає.", None)
        self.assertNotIn("постійний", text)
        self.assertIn("Гурток малювання", text)

    def test_injected_phrase_does_not_count_as_season(self):
        # Фраза скрапера не робить гурток «сезонним» і не відправляє його моделі.
        kind, _m, _w = rule_kind(row(opportunity_type="club",
                                     summary="Шахи. Набір постійний, дедлайну немає."))
        self.assertEqual(kind, "permanent")

    def test_months(self):
        self.assertEqual(months_from_dates(row(deadline="2026-10-01",
                                               event_start_date="2026-11-06",
                                               event_end_date="2026-11-08")), [10, 11])
        self.assertEqual(clean_months([11, "3", 3, 13, None]), [3, 11])
        self.assertIsNone(clean_months([]))
        self.assertIsNone(clean_months("жовтень"))

    def test_kind(self):
        self.assertEqual(clean_kind("periodic"), "periodic")
        self.assertIsNone(clean_kind("annual"))
        self.assertIsNone(clean_kind("unknown"))


if __name__ == "__main__":
    unittest.main()
