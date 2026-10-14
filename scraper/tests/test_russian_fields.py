"""Русизм у згенерованому тексті — до людини, не на сайт.

14.10.2026 на сайті висів опис «розвивати soft и hard skills»: текст
український, але зі сполучником « и ». Промпт вимагає українську, та не
гарантує її, тож перевіряємо самі — як latin_fields, лише про російські
маркери: літери ы/э/ъ/ё і « и » окремим словом.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from normalizer import russian_fields  # noqa: E402


class RussianFields(unittest.TestCase):
    def test_standalone_i_is_caught(self):
        data = {"summary": "Програма допомагає розвивати soft и hard skills "
                           "у підлітків 14–16 років."}
        self.assertEqual(russian_fields(data), ["summary"])

    def test_russian_letters_are_caught(self):
        data = {"details": "Конкурс для школьников: подъём о 8-й ранку, "
                           "экскурсії щодня."}
        self.assertEqual(russian_fields(data), ["details"])

    def test_ukrainian_passes(self):
        # «и» всередині слів (мислення, комунікація) — звичайна українська.
        data = {"title": "Школа лідерства для підлітків",
                "summary": "Табір особистісного розвитку: критичне мислення, "
                           "комунікація і проєктний менеджмент.",
                "details": "Заїзди 13–20 і 22–29 листопада, участь безкоштовна."}
        self.assertEqual(russian_fields(data), [])

    def test_quoted_proper_name_goes_to_human_too(self):
        # Власна назва з « и » теж іде людині: хай вирішить вона, а не регулярка.
        data = {"title": "Конкурс «Мир и дети» для школярів"}
        self.assertEqual(russian_fields(data), ["title"])

    def test_empty_fields_pass(self):
        self.assertEqual(russian_fields({"title": None, "summary": ""}), [])
