"""Записи зі «Звернень» автоматика не чіпає (Марія, 11.10.2026)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from requests_guard import MARKS, is_request  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")


class Guard(unittest.TestCase):
    def test_marks(self):
        self.assertTrue(is_request({"admin_comment": "💡 пропозиція з форми на сайті · контакт: x"}))
        self.assertTrue(is_request({"admin_comment": "… · опубліковано вручну за рішенням Марії 04.10.2026"}))
        self.assertFalse(is_request({"admin_comment": "auto-approved v1"}))
        self.assertFalse(is_request({"admin_comment": None}))

    def test_every_checker_skips_requests(self):
        for f in ("lifecycle.py", "recheck_dates.py", "audit_clubs.py", "ttl_requeue.py",
                  "classify_timing.py", "proof_recheck.py"):
            with self.subTest(f=f):
                src = open(os.path.join(ROOT, "scraper", f), encoding="utf-8").read()
                self.assertIn("protected_ids(", src)

    def test_sql_closer_has_the_same_marks(self):
        sql = open(os.path.join(ROOT, "supabase", "migrations", "20261011_requests_untouchable.sql"),
                   encoding="utf-8").read()
        for m in MARKS:
            self.assertIn(m, sql)


if __name__ == "__main__":
    unittest.main()
