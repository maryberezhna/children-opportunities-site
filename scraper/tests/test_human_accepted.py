"""Карантин: запис, який людина прийняла, проходить без порогу впевненості."""
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import normalizer as nz  # noqa: E402

EXTRACTED = {
    "title": "World Heritage Volunteers", "summary": "Волонтерські табори ЮНЕСКО для молоді.",
    "age_from": 18, "age_to": 18, "opportunity_type": "volunteer", "cost_type": "free",
    "format": "offline", "cities": [], "countries": ["it"], "is_international": True,
    "recurrence": "annual", "confidence": 0.3, "enrollment_status": "open",
}


def fake_response():
    block = SimpleNamespace(type="tool_use", name="extract_opportunity", input=dict(EXTRACTED))
    return SimpleNamespace(content=[block])


class HumanAccepted(unittest.TestCase):
    def run_normalize(self, accepted):
        n = nz.Normalizer.__new__(nz.Normalizer)
        with patch.object(nz.Normalizer, "_call_api", return_value=fake_response()), \
                patch.object(nz.hubs, "is_hub", return_value=False):
            return n, n.normalize("Age: 18 to 30 …", "Eurodesk", "https://programmes.eurodesk.eu/1-eu",
                                  raw_title="World Heritage Volunteers", human_accepted=accepted)

    def test_low_confidence_still_goes_to_quarantine_without_human(self):
        n, out = self.run_normalize(False)
        self.assertIsNone(out)
        self.assertEqual(n.last_reject_code, "low_confidence")

    def test_human_accept_skips_the_confidence_gate(self):
        _, out = self.run_normalize(True)
        self.assertIsNotNone(out)
        self.assertIn("людина прийняла з карантину", out["admin_comment"])
