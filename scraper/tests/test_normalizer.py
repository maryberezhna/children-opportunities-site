"""Інваріанти нормалізатора. Регресія 01.09.2026: slugify транслітерував
кирилицю тим unidecode-пакетом, який випадково стояв в оточенні, — той
самий запис у різних запусках отримував різні слаги, і в базі виросло
20 пар дублів. Ці тести прибʼють поведінку до власної таблиці."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from normalizer import Normalizer  # noqa: E402


class SlugInvariants(unittest.TestCase):
    def test_ukrainian_official_transliteration(self):
        # и→y, г→h, є→ie — офіційна таблиця, НЕ російська (i, g)
        slug = Normalizer._make_slug("Квіти Перемоги", "тест")
        self.assertTrue(slug.startswith("kvity-peremohy-"), slug)
        slug = Normalizer._make_slug("Гурток Ідея", "тест")
        self.assertTrue(slug.startswith("hurtok-ideia-"), slug)

    def test_deterministic(self):
        a = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        b = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("dytiachyi-khor-shchedryk-"), a)

    def test_hash_suffix_six_hex(self):
        slug = Normalizer._make_slug("Тест", "джерело")
        self.assertRegex(slug, r"-[0-9a-f]{6}$")


if __name__ == "__main__":
    unittest.main()
