"""Повторна розмітка не затирає відоме і не повертає закрите (аудит, С6)."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from db import merge_patch  # noqa: E402


class MergePatch(unittest.TestCase):
    def test_known_dates_are_not_wiped_by_empty(self):
        existing = {"status": "active", "event_start_date": "2026-11-06",
                    "timing_kind": "periodic", "details": "## Програма", "apply_url": "https://forms.gle/x"}
        record = {"title": "t", "slug": "new-slug", "event_start_date": None,
                  "timing_kind": None, "details": None, "apply_url": None, "summary": "новий опис"}
        patch = merge_patch(existing, record)
        for key in ("event_start_date", "timing_kind", "details", "apply_url", "slug"):
            self.assertNotIn(key, patch)
        self.assertEqual(patch["summary"], "новий опис")

    def test_new_values_do_overwrite(self):
        patch = merge_patch({"status": "active", "deadline": "2026-10-01"},
                            {"deadline": "2026-10-15"})
        self.assertEqual(patch["deadline"], "2026-10-15")

    def test_extraction_cannot_reopen_closed(self):
        # «Пропустити» модератора не ставить verified_at — запис не сміє ожити сам.
        self.assertNotIn("status", merge_patch({"status": "closed"}, {"status": "active"}))
        self.assertNotIn("status", merge_patch({"status": "draft"}, {"status": "active"}))

    def test_extraction_can_close(self):
        self.assertEqual(merge_patch({"status": "active"}, {"status": "closed"})["status"], "closed")


if __name__ == "__main__":
    unittest.main()
