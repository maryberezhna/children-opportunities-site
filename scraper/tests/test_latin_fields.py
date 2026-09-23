"""Українська латиницею — не українська.

22.09.2026 на сайт вийшов запис, де короткий опис був транслітерацією:
«Matematychnyy konkurs-hra "Giochi d'Autunno" dlya shkolyariv Italiyi».
Промпт вимагає українську, але не гарантує її. Тепер такий запис іде людині.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from normalizer import latin_fields  # noqa: E402


class LatinFields(unittest.TestCase):
    def test_translit_is_caught(self):
        data = {"summary": "Matematychnyy konkurs-hra dlya shkolyariv Italiyi. "
                           "Uczestnyky rozviazuyut zavdannya protyahom 90 khvylyn."}
        self.assertEqual(latin_fields(data), ["summary"])

    def test_english_is_caught(self):
        data = {"summary": "Richmond CoderDojo is a free coding club open to young "
                           "people aged 7 to 17 with sessions on Saturdays."}
        self.assertEqual(latin_fields(data), ["summary"])

    def test_ukrainian_passes(self):
        data = {"title": "Конкурс Малої академії наук України для школярів",
                "summary": "Всеукраїнський конкурс дослідницьких робіт для учнів "
                           "7–17 років. Подача через регіональні відділення."}
        self.assertEqual(latin_fields(data), [])

    def test_latin_name_inside_ukrainian_passes(self):
        data = {"summary": "Молодіжний обмін Erasmus+ «Speak Up for Change» у Польщі: "
                           "проїзд і проживання покриває приймальна сторона."}
        self.assertEqual(latin_fields(data), [])

    def test_short_name_not_judged(self):
        self.assertEqual(latin_fields({"title": "Hello English"}), [])
