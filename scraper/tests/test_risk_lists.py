"""Чутливі переліки — в одному місці зі спекою (22.09.2026). Розійдуться
Python і JS — цей тест упаде першим."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auto_review  # noqa: E402

_SPEC = os.path.join(os.path.dirname(__file__), "..", "..", "lib", "publish-criteria.json")


class RiskListsComeFromSpec(unittest.TestCase):
    def setUp(self):
        with open(_SPEC, encoding="utf-8") as f:
            self.risk = json.load(f)["risk"]

    def test_lists_match(self):
        self.assertEqual(auto_review.SENSITIVE_TYPES, set(self.risk["sensitive_types"]))
        self.assertEqual(auto_review.SENSITIVE_NEEDS, set(self.risk["sensitive_needs"]))

    def test_every_risk_has_a_label(self):
        self.assertEqual(sorted(self.risk["order"]), sorted(self.risk["labels"]))

    def test_sensitive_types_are_real_types(self):
        from normalizer import VALID_OPP_TYPES
        self.assertEqual(set(self.risk["sensitive_types"]) - VALID_OPP_TYPES, set())

    def test_daily_cap_is_a_days_work(self):
        self.assertTrue(15 <= self.risk["daily_cap"] <= 20, self.risk["daily_cap"])

    def test_trust_tiers_come_from_the_spec(self):
        """Рівні джерела теж живуть у спеці: підписи читають і Python, і JS
        (lib/queue-risk.js). Розійдуться — модератор побачить різні слова про
        те саме джерело в черзі та в логах коридорів (23.09.2026)."""
        self.assertEqual(sorted(self.risk["trust_tier_labels"]), ["1", "2", "3"])
        self.assertEqual(auto_review.TRUST_TIER_LABELS,
                         {int(k): v for k, v in self.risk["trust_tier_labels"].items()})
        # Джерело, якого немає в реєстрі, читаємо як найменш надійне.
        self.assertEqual(auto_review.DEFAULT_TIER, 3)
        self.assertEqual(auto_review.tier_label(None), self.risk["trust_tier_labels"]["3"])


if __name__ == "__main__":
    unittest.main()
