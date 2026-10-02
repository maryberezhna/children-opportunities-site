"""Наше дослідження завжди стає чернеткою (Марія, 02.10.2026: «звернення —
це тільки для форми з сайту, додавай усе в чернетку»)."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "x")

import process_suggestions as ps  # noqa: E402


class _Norm:
    last_reject_reason = "не для дітей"

    def normalize(self, *a, **k):
        return None


def _sug(origin):
    return {"id": 1, "url": "https://example.org/program", "title": "Зимова підтримка",
            "contact": "", "comment": "Google Alerts 01.10.2026", "origin": origin}


class ResearchAlwaysDrafts(unittest.TestCase):
    def run_one(self, origin, page):
        with mock.patch.object(ps, "find_existing", lambda sb, url: None), \
             mock.patch.object(ps, "fetch_text", lambda url: page):
            return ps.process_one(None, _Norm(), _sug(origin), apply=False, seen=set())

    def test_unreadable_page_becomes_stub_draft(self):
        status, why = self.run_one("research", (None, "HTTP 403"))
        self.assertEqual(status, "imported")
        self.assertIn("чернетка-заглушка", why)
        self.assertIn("HTTP 403", why)

    def test_rejected_by_normalizer_becomes_stub_draft(self):
        status, why = self.run_one("research", ("текст сторінки", "HTTP 200"))
        self.assertEqual(status, "imported")
        self.assertIn("нормалізатор не взяв", why)

    def test_popup_still_waits_for_human(self):
        status, _ = self.run_one("popup", (None, "HTTP 403"))
        self.assertEqual(status, "needs_human")


if __name__ == "__main__":
    unittest.main()
