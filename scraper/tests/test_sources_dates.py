"""Джерела й редактор: дати не губляться (аудит «Дедлайн, подія, сезон», С7, С8)."""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from main import check_on_change  # noqa: E402
from process_notes import build_patch  # noqa: E402

TODAY = date(2026, 9, 17)


class CheckOnChange(unittest.TestCase):
    def test_dated_record_gets_checked_today(self):
        self.assertEqual(check_on_change({"deadline": "2026-10-01"}, TODAY), "2026-09-17")

    def test_undated_record_is_not_rechecked(self):
        # Гурток без дат: змінений текст сторінки — не привід викликати модель.
        self.assertIsNone(check_on_change({"deadline": None}, TODAY))
        self.assertIsNone(check_on_change({"deadline": "2026-09-01"}, TODAY))

    def test_not_more_often_than_every_two_weeks(self):
        recent = {"deadline": "2026-10-01",
                  "admin_comment": "lifecycle 2026-09-10: відкрито: «…»"}
        self.assertIsNone(check_on_change(recent, TODAY))
        old = {"deadline": "2026-10-01", "admin_comment": "lifecycle 2026-08-20: відкрито"}
        self.assertEqual(check_on_change(old, TODAY), "2026-09-17")

    def test_already_due_is_left_alone(self):
        self.assertIsNone(check_on_change({"deadline": "2026-10-01", "recheck_at": "2026-09-15"}, TODAY))


class EditorNote(unittest.TestCase):
    def test_note_can_set_and_clear_dates(self):
        patch = build_patch({"deadline": "", "event_start_date": "2026-11-06",
                             "event_end_date": "8 листопада"})
        self.assertIsNone(patch["deadline"])            # «прибери дедлайн» тепер працює
        self.assertEqual(patch["event_start_date"], "2026-11-06")
        self.assertNotIn("event_end_date", patch)       # словесна дата не пишеться

    def test_kind_and_apply_link_are_validated(self):
        patch = build_patch({"timing_kind": "annual", "apply_url": "https://t.me/+abc"})
        self.assertEqual(patch, {})
        patch = build_patch({"timing_kind": "periodic", "apply_url": "https://forms.gle/x"})
        self.assertEqual(patch, {"timing_kind": "periodic", "apply_url": "https://forms.gle/x"})

    def test_other_fields_ignore_empty(self):
        self.assertEqual(build_patch({"title": "", "summary": "Новий опис", "slug": "x"}),
                         {"summary": "Новий опис"})


if __name__ == "__main__":
    unittest.main()
