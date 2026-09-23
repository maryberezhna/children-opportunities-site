"""Сіра смуга відбору (20.09.2026).

Марія прислала міграцію, яка зробила відбір вимірюваним: оцінка
класифікатора стала колонкою, а записи, де модель вагається, дістали
окремий статус review замість спільного «ні». Тест тримає межі смуги: за
ними ховається рідкісне закордонне, описане скупо.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from raw_store import GREY_HIGH, GREY_LOW, triage_status  # noqa: E402


class GreyBand(unittest.TestCase):
    def test_inside_band_goes_to_quarantine(self):
        for conf in (GREY_LOW, 0.3, 0.4, 0.54):
            with self.subTest(conf=conf):
                self.assertEqual(triage_status("low_confidence", conf), "review")

    def test_below_band_is_noise(self):
        for conf in (0.0, 0.1, 0.24):
            with self.subTest(conf=conf):
                self.assertEqual(triage_status("low_confidence", conf), "rejected")

    def test_upper_edge_belongs_to_the_model(self):
        # 0.55 і вище модель приймає сама — у карантин потрапити не може.
        self.assertEqual(triage_status("low_confidence", GREY_HIGH), "rejected")

    def test_other_reasons_never_go_to_quarantine(self):
        for code in ("dead_link", "duplicate", "not_child", "off_topic", "unknown", None):
            with self.subTest(code=code):
                self.assertEqual(triage_status(code, 0.4), "rejected")

    def test_missing_confidence_is_not_grey(self):
        self.assertEqual(triage_status("low_confidence", None), "rejected")




class GreyNeedsAChild(unittest.TestCase):
    """У чергу людини — лише те, що бодай може бути дитячим (23.09.2026).

    Марія відкрила карантин і побачила «Дякуємо, що пройшли цей квіз»,
    «Yoga with an American» і Erasmus+ для студентів: «нас приходить якийсь
    смітник». Модель на такому вагається, і сіра смуга клала все це їй на стіл.
    """

    def test_grey_without_a_child_word_is_rejected(self):
        for text in ("Дякуємо, що пройшли цей квіз разом з нами. Волонтерство ширше.",
                     "Yoga with an American. Ready to stretch? Join us at America House.",
                     "#освіта", "Київ"):
            with self.subTest(text=text[:20]):
                self.assertEqual(triage_status("low_confidence", 0.4, text), "rejected")

    def test_grey_with_a_child_word_still_waits_for_a_human(self):
        for text in ("Гуртки для дітей у ЦТДЮГ Галичини",
                     "Безкоштовна арттерапія для школярів Запоріжжя",
                     "Математична олімпіада для учнів 5-11 класів",
                     "Summer camp for children aged 7-14"):
            with self.subTest(text=text[:20]):
                self.assertEqual(triage_status("low_confidence", 0.4, text), "review")

    def test_old_calls_without_text_behave_as_before(self):
        self.assertEqual(triage_status("low_confidence", 0.4), "review")


if __name__ == "__main__":
    unittest.main()
