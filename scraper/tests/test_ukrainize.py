"""Записи англійською → українською (22.09.2026, пост WWOOF у каналі).
Критерій — дзеркало post-labels.isUkrainianPost."""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from ukrainize import needs_ukrainian, plan  # noqa: E402

TODAY = date(2026, 9, 22)
WWOOF = {"title": "Volunteer in organic farms",
         "summary": "WWOOF connects volunteers with organic farms worldwide.",
         "details": None, "admin_comment": None}


class Needs(unittest.TestCase):
    def test_english_or_latin_title_needs_translation(self):
        self.assertTrue(needs_ukrainian(WWOOF))
        self.assertTrue(needs_ukrainian({"title": "Yale Young Global Scholars",
                                         "summary": "Літня академічна програма Єльського університету."}))
        self.assertTrue(needs_ukrainian({"title": "Kresťanský tábor pre ukrajinské deti",
                                         "summary": "Табір для українських дітей у Словаччині."}))

    def test_ukrainian_with_brand_does_not(self):
        self.assertFalse(needs_ukrainian({"title": "UNESCO Youth Eyes on Silk Roads — фотоконкурс",
                                          "summary": "Міжнародний фотоконкурс для молоді."}))
        self.assertFalse(needs_ukrainian({"title": "Гурток робототехніки", "summary": None}))


class Plan(unittest.TestCase):
    OUT = {"title": "WWOOF — волонтерство на органічних фермах",
           "summary": "WWOOF поєднує волонтерів з органічними фермами по всьому світу.",
           "details": ""}

    def test_translation_replaces_only_what_was_not_ukrainian(self):
        patch = plan(WWOOF, self.OUT, TODAY)
        self.assertEqual(patch["title"], "WWOOF — волонтерство на органічних фермах")
        self.assertTrue(patch["summary"].startswith("WWOOF поєднує"))
        self.assertNotIn("details", patch)
        self.assertIn("ukrainize 2026-09-22", patch["admin_comment"])

    def test_ukrainian_fields_are_never_overwritten(self):
        row = {"title": "Yale Young Global Scholars",
               "summary": "Літня академічна програма Єльського університету.", "admin_comment": None}
        out = {"title": "Yale Young Global Scholars — літня програма Єльського університету",
               "summary": "Інший переказ тієї самої програми."}
        patch = plan(row, out, TODAY)
        self.assertIn("title", patch)
        self.assertNotIn("summary", patch)

    def test_model_answer_still_english_changes_nothing(self):
        self.assertEqual(plan(WWOOF, {"title": "Volunteer on farms", "summary": "Still English."}, TODAY), {})

    def test_summary_is_capped(self):
        out = dict(self.OUT, summary="Опис " * 200)
        self.assertLessEqual(len(plan(WWOOF, out, TODAY)["summary"]), 400)


if __name__ == "__main__":
    unittest.main()
