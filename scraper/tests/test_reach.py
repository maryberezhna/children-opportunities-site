"""Групи «для кого за місцем» (27.10.2026) — дзеркало lib/reach.js.

Приклади спільні з сайтом: tests/fixtures/reach-cases.json. Група мусить бути
однаковою на сайті, в каналі й у Dityam+.
"""
import json
import os
import pathlib
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from reach import REACH, reach_doubt, reach_label, reach_of  # noqa: E402

FIXTURE = json.loads(
    (pathlib.Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "reach-cases.json")
    .read_text(encoding="utf-8"))


class SharedCases(unittest.TestCase):
    def test_reach_and_doubt(self):
        for case in FIXTURE["cases"]:
            self.assertEqual(reach_of(case["item"]), case["reach"], case["name"])
            self.assertEqual(reach_doubt(case["item"]), case["doubt"], case["name"])

    def test_every_group_covered(self):
        for r in REACH:
            self.assertTrue(any(c["reach"] == r for c in FIXTURE["cases"]), r)

    def test_labels(self):
        self.assertEqual(reach_label("diaspora"), "🌍 Живемо за кордоном")
        self.assertEqual(reach_label("travel", "en"), "✈️ Going abroad")
        self.assertEqual(reach_label(None), "")


if __name__ == "__main__":
    unittest.main()
