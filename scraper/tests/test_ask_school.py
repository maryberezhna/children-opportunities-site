"""«Вартість уточнюйте в школі» — виняток лише для шкіл і студій діаспори
(рішення Марії 28.09.2026). Спільні з JS приклади — у
tests/fixtures/publish-criteria-cases.json; тут — те, що робить конвеєр."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import db  # noqa: E402
from auto_review import GREEN, RED, YELLOW, mechanical  # noqa: E402
from normalizer import apply_ask_school, missing_required  # noqa: E402
from proof import ASK_SCHOOL, ASK_SCHOOL_VALUE, is_diaspora_school  # noqa: E402

SCHOOL = {
    "title": "Українська суботня школа «Сонях» у Лейпцигу",
    "summary": ("Суботня школа для українських дітей, які живуть у Німеччині: українська "
                "мова, історія й література щосуботи."),
    "opportunity_type": "club", "countries": ["de"], "cities": ["Лейпциг"],
    "age_from": 5, "age_to": 12, "recurrence": "ongoing", "cost_type": None,
    "link_status": "ok",
    "evidence": {"age": "для дітей 5–12 років", "date": "щосуботи",
                 "type": "суботня школа", "place": "у Лейпцигу"},
}


class AskSchool(unittest.TestCase):

    def test_school_without_price_gets_the_note(self):
        row = dict(SCHOOL, evidence=dict(SCHOOL["evidence"]))
        apply_ask_school(row)
        self.assertEqual(row["cost_type"], ASK_SCHOOL_VALUE)
        self.assertIn("уточнюйте в школі", row["admin_comment"])
        self.assertEqual(missing_required(row), [])

    def test_school_with_price_keeps_it(self):
        row = dict(SCHOOL, cost_type="paid_affordable")
        apply_ask_school(row)
        self.assertEqual(row["cost_type"], "paid_affordable")

    def test_not_a_diaspora_school_loses_the_value(self):
        for patch in ({"opportunity_type": "camp"}, {"countries": ["ua"]},
                      {"countries": None}, {"title": "Гурток малювання"}):
            row = dict(SCHOOL, cost_type=ASK_SCHOOL_VALUE, **patch)
            apply_ask_school(row)
            self.assertIsNone(row["cost_type"], patch)
            self.assertIn("вартість", missing_required(row))

    def test_no_country_yet_no_note(self):
        # main.py підставляє країну джерела вже після нормалізатора й тоді
        # викликає apply_ask_school ще раз.
        row = dict(SCHOOL, countries=None)
        apply_ask_school(row)
        self.assertIsNone(row["cost_type"])
        row["countries"] = ["de"]
        apply_ask_school(row)
        self.assertEqual(row["cost_type"], ASK_SCHOOL_VALUE)

    def test_mechanical_lets_it_through_to_the_judge(self):
        row = dict(SCHOOL, cost_type=ASK_SCHOOL_VALUE)
        self.assertIsNone(mechanical(row, trust_tier=2))

    def test_mechanical_holds_it_elsewhere(self):
        row = dict(SCHOOL, cost_type=ASK_SCHOOL_VALUE, opportunity_type="camp",
                   title="Табір «Сонях» у Німеччині", deadline="2099-01-01")
        verdict = mechanical(row, trust_tier=2)
        self.assertEqual(verdict[0], YELLOW)
        self.assertIn("вартість", verdict[1])
        self.assertNotIn(verdict[0], (GREEN, RED))

    def test_school_word_is_the_same_as_the_dedup_key(self):
        # «Школа» для винятку й «школа» для «одна школа — одна картка» — одне слово.
        self.assertEqual(db._SCHOOL_WORD.pattern, ASK_SCHOOL["title_pattern"])
        self.assertEqual(set(db.SCHOOL_TYPES), set(ASK_SCHOOL["types"]))
        self.assertTrue(is_diaspora_school(SCHOOL))


if __name__ == "__main__":
    unittest.main()
