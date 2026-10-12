"""Кастинг — не гурток (Марія, 12.10.2026: «тут кастинг» про чернетку з
типом «Гурток» для «Пошук акторів та танцюристів на виставу…»)."""
import pathlib
import unittest

SRC = (pathlib.Path(__file__).resolve().parents[1] / "normalizer.py").read_text(encoding="utf-8")


class CastingIsCompetition(unittest.TestCase):
    def test_prompt_says_casting_is_competition(self):
        self.assertIn("Кастинг,\n  пошук акторів чи танцюристів", SRC)
        self.assertIn("competition — конкурс, змагання робіт чи виступів; кастинг, open call", SRC)


if __name__ == "__main__":
    unittest.main()
