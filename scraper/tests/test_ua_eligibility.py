"""«Хто може подати» для закордонних можливостей — лише з цитатою.

22.10.2026: RSI мав «дедлайн тижня» в плані Instagram, а сторінка програми
приймає лише громадян чи резидентів США. Вгадане «можна з України» шкодить
більше, ніж чесне «не вказано».
"""
import unittest

from normalizer import apply_ua_eligibility

PAGE = ("Applicants must be U.S. citizens or permanent residents. Students from "
        "other countries apply through their national partner organisations.")


class UaEligibility(unittest.TestCase):
    def test_quoted_answer_kept(self):
        data = {"is_international": True, "ua_eligibility": "none",
                "ua_eligibility_quote": "Applicants must be U.S. citizens or permanent residents",
                "ua_eligibility_note": "громадяни або резиденти США"}
        apply_ua_eligibility(data, PAGE)
        self.assertEqual(data["ua_eligibility"], "none")
        self.assertEqual(data["ua_eligibility_note"], "громадяни або резиденти США")
        self.assertIn("U.S. citizens", data["evidence"]["ua"])
        self.assertNotIn("ua_eligibility_quote", data)

    def test_invented_quote_becomes_unknown(self):
        data = {"is_international": True, "ua_eligibility": "from_ukraine",
                "ua_eligibility_quote": "Open to students from Ukraine",
                "ua_eligibility_note": "усі"}
        apply_ua_eligibility(data, PAGE)
        self.assertEqual(data["ua_eligibility"], "unknown")
        self.assertIsNone(data["ua_eligibility_note"])
        self.assertIn("без цитати", data["admin_comment"])

    def test_missing_answer_on_foreign_is_unknown(self):
        data = {"is_international": False, "countries": ["pl"]}
        apply_ua_eligibility(data, PAGE)
        self.assertEqual(data["ua_eligibility"], "unknown")

    def test_bad_value_is_unknown(self):
        data = {"is_international": True, "ua_eligibility": "yes"}
        apply_ua_eligibility(data, PAGE)
        self.assertEqual(data["ua_eligibility"], "unknown")

    def test_ukrainian_opportunity_cleared(self):
        data = {"is_international": False, "countries": ["ua"],
                "ua_eligibility": "from_ukraine", "ua_eligibility_note": "x",
                "ua_eligibility_quote": "x"}
        apply_ua_eligibility(data, PAGE)
        self.assertIsNone(data["ua_eligibility"])
        self.assertIsNone(data["ua_eligibility_note"])
        self.assertNotIn("ua_eligibility_quote", data)



class BackfillPlan(unittest.TestCase):
    def test_keeps_other_quotes(self):
        from backfill_ua_eligibility import plan
        row = {"evidence": {"age": "grades 11"}}
        patch = plan(row, {"ua_eligibility": "none",
                           "ua_eligibility_quote": "U.S. citizens or permanent residents",
                           "ua_eligibility_note": "громадяни або резиденти США"}, PAGE)
        self.assertEqual(patch["ua_eligibility"], "none")
        self.assertEqual(patch["evidence"]["age"], "grades 11")
        self.assertIn("U.S. citizens", patch["evidence"]["ua"])

    def test_no_quote_no_evidence(self):
        from backfill_ua_eligibility import plan
        patch = plan({}, {"ua_eligibility": "from_ukraine", "ua_eligibility_quote": None,
                          "ua_eligibility_note": None}, PAGE)
        self.assertEqual(patch, {"ua_eligibility": "unknown", "ua_eligibility_note": None})


if __name__ == "__main__":
    unittest.main()
