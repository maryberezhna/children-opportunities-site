"""Перевірка дат по живій сторінці: рішення мусить спиратись на цитату.

Тут стережеться саме те місце, де 11.09.2026 зламалась довіра: LLM
«визначила» вік і мітку, яких у тексті не було, і доросла програма з
простроченим набором опинилась першою на сторінці для дітей захисників.
Тому `decide()` нічого не пише в базу без дослівної цитати зі сторінки.
"""
import pathlib
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from recheck_dates import decide, _valid_date  # noqa: E402

TODAY = date.today()
TODAY_ISO = TODAY.isoformat()
SOON = (TODAY + timedelta(days=30)).isoformat()
PAST = (TODAY - timedelta(days=30)).isoformat()
QUOTE = "Прийом заявок триває до 15 жовтня 2026 року"


def row(**over):
    base = {"id": 1, "title": "Конкурс", "opportunity_type": "competition",
            "admin_comment": None}
    base.update(over)
    return base


def out(**over):
    base = {"enrollment": "unknown", "evidence": QUOTE, "confidence": 0.9}
    base.update(over)
    return base


class EvidenceIsMandatory(unittest.TestCase):
    def test_no_quote_no_write(self):
        patch, _ = decide(row(), out(evidence="", deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_too_short_quote_no_write(self):
        patch, _ = decide(row(), out(evidence="так", deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_low_confidence_no_write(self):
        patch, _ = decide(row(), out(confidence=0.3, deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_quote_plus_date_writes(self):
        patch, why = decide(row(), out(deadline=SOON), TODAY_ISO)
        self.assertEqual(patch["deadline"], SOON)
        self.assertIn(QUOTE[:20], why)


class ClosingRules(unittest.TestCase):
    def test_page_says_closed(self):
        patch, why = decide(row(), out(enrollment="closed",
                                       evidence="Реєстрацію завершено"), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")
        self.assertIn("набір закрито", why)

    def test_past_deadline_closes(self):
        patch, why = decide(row(), out(deadline=PAST), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")
        self.assertEqual(patch["deadline"], PAST)
        self.assertIn("минув", why)

    def test_past_deadline_of_annual_stays(self):
        # Щорічний конкурс не гасне через торішній дедлайн — він оживе
        # наступного сезону, і сайт уже вміє це показувати.
        patch, _ = decide(row(), out(deadline=PAST, recurrence="annual"), TODAY_ISO)
        self.assertNotIn("status", patch)

    def test_seasonal_type_gets_recheck_date(self):
        # Табір закривається чесно, але через ~11 місяців ttl_requeue
        # перечитає сторінку: нова зміна оживить запис.
        patch, _ = decide(row(opportunity_type="camp"),
                          out(enrollment="closed", evidence="Зміну завершено"),
                          TODAY_ISO)
        self.assertIn("recheck_at", patch)

    def test_non_seasonal_type_has_no_recheck(self):
        patch, _ = decide(row(opportunity_type="volunteer"),
                          out(enrollment="closed", evidence="Набір завершено"),
                          TODAY_ISO)
        self.assertNotIn("recheck_at", patch)


class DateSanity(unittest.TestCase):
    def test_rejects_nonsense(self):
        for bad in (None, "", "квітень", "2026-13-45", 20261001):
            self.assertIsNone(_valid_date(bad), bad)

    def test_rejects_far_past_and_far_future(self):
        self.assertIsNone(_valid_date((TODAY - timedelta(days=500)).isoformat()))
        self.assertIsNone(_valid_date((TODAY + timedelta(days=2000)).isoformat()))

    def test_accepts_reasonable(self):
        self.assertEqual(_valid_date(f" {SOON} "), SOON)

    def test_recurrence_only_when_no_date(self):
        # Конкретна дата сильніша за «щорічність»: вона закриє запис вчасно.
        patch, _ = decide(row(), out(deadline=SOON, recurrence="annual"), TODAY_ISO)
        self.assertEqual(patch.get("deadline"), SOON)
        self.assertNotIn("recurrence", patch)

    def test_recurrence_alone_is_written(self):
        patch, why = decide(row(), out(recurrence="ongoing"), TODAY_ISO)
        self.assertEqual(patch["recurrence"], "ongoing")
        self.assertIn("постійна", why)


if __name__ == "__main__":
    unittest.main()
