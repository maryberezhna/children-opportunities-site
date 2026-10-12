"""Кастинг — не гурток (Марія, 12.10.2026: «тут кастинг» про чернетку з
типом «Гурток» для «Пошук акторів та танцюристів на виставу…»)."""
from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / "normalizer.py").read_text(encoding="utf-8")


def test_prompt_says_casting_is_competition():
    assert "Кастинг,\n  пошук акторів чи танцюристів" in SRC
    assert "competition — конкурс, змагання робіт чи виступів; кастинг, open call" in SRC
