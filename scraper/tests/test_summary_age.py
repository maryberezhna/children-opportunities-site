"""Вік в описі проти поля — дзеркало tests/age-text.test.mjs."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from auto_review import summary_age_conflict, summary_age_range  # noqa: E402

CONTEST = ("Літературний конкурс для трьох вікових груп: 8–10, 11–13 і 14–18 років. "
           "Заявки приймають на пошту організатора.")


def test_range_widest_and_vid_do():
    assert summary_age_range(CONTEST) == (8, 18)
    assert summary_age_range("Участь беруть діти від 8 до 16 років.") == (8, 16)
    assert summary_age_range("для дітей 6-11, підлітків 11-13 та 13-17 років") == (6, 17)
    assert summary_age_range("Гурток хору. Заняття двічі на тиждень.") is None


def test_duration_is_not_age():
    assert summary_age_range("Навчальна програма розрахована на 5-7 років для дітей.") is None
    assert summary_age_range("Навчання 5-7 років, живопис і графіка.") is None
    assert summary_age_range("Навчання програмування тривалістю від 1 до 2 років у залежності від віку.") is None


def test_conflict_when_text_wider():
    assert summary_age_conflict(CONTEST, 8, 16) == "в описі 8–18 років, а в полі 8–16"
    assert summary_age_conflict("Нагорода для молоді 9–25 років.", 16, 18) == \
        "в описі 9–25 років, а в полі 16–18"


def test_no_conflict_ceiling_and_narrower():
    assert summary_age_conflict("Волонтерство для молоді 18–30 років.", 18, 18) is None
    assert summary_age_conflict("Конкурс для 13–24 років.", 13, 18) is None
    assert summary_age_conflict("Курс зі ШІ для підлітків 12–17 років та інженерія для 7–11.", 7, 18) is None
    assert summary_age_conflict("Вік 8–16 років.", None, None) is None
