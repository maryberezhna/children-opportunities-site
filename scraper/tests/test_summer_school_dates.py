"""«Літня школа» з нелітніми датами — до людини, не на сайт.

14.10.2026 аудит знайшов на сайті 2 «літні школи» з осінніми й зимовими
датами: School of Resilience (заїзди 13–29 листопада) і «Творчі осінні
канікули» (19–23.10). Тип видно в хлібних крихтах і фільтрах, тож хибний
він збиває людину. Самі не перекласифіковуємо — віддаємо людині.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from normalizer import summer_school_mismatch  # noqa: E402


class SummerSchoolDates(unittest.TestCase):
    def test_november_summer_school_is_caught(self):
        data = {"opportunity_type": "summer_school",
                "event_start_date": "2026-11-13"}
        self.assertIn("2026-11-13", summer_school_mismatch(data))

    def test_summer_dates_pass(self):
        for month in ("05", "06", "07", "08", "09"):
            data = {"opportunity_type": "summer_school",
                    "event_start_date": f"2027-{month}-01"}
            self.assertIsNone(summer_school_mismatch(data), month)

    def test_other_types_pass(self):
        data = {"opportunity_type": "camp", "event_start_date": "2026-11-13"}
        self.assertIsNone(summer_school_mismatch(data))

    def test_without_date_passes(self):
        # Літня школа на наступне літо часто анонсується без дат — це не
        # привід для чернетки: дату ловлять інші ворота.
        data = {"opportunity_type": "summer_school", "event_start_date": None}
        self.assertIsNone(summer_school_mismatch(data))
