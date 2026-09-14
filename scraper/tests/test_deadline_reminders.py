"""Вікна нагадувань про дедлайни залежать від типу програми.

Регресія, проти якої стоять тести: раніше всім типам ішло «за 7 і 2 дні», і
для стипендії чи обміну з есе й рекомендаціями тиждень означав «уже пізно».
Друга річ, яку тримаємо: за один запуск запис потрапляє лише в одне вікно —
найтісніше, — інакше людина отримала б два повідомлення про те саме.
"""
import pathlib
import sys
import types
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

# personal_digest тягне мережеві залежності й змінні оточення; для чистих
# функцій вікон вони не потрібні.
_stub = types.ModuleType("personal_digest")
_stub.SITE_URL = "https://dityam.com.ua"
for _name in ("age_overlaps", "match_themes", "send_email", "send_telegram"):
    setattr(_stub, _name, lambda *a, **k: None)
sys.modules.setdefault("personal_digest", _stub)

import deadline_reminders as dr  # noqa: E402


class WindowsByType(unittest.TestCase):
    def test_long_applications_start_four_weeks_ahead(self):
        for t in ("scholarship", "grant", "exchange", "internship"):
            with self.subTest(type=t):
                self.assertEqual(dr.windows_for(t), (28, 14, 3))

    def test_competitions_two_weeks_ahead(self):
        for t in ("competition", "olympiad", "camp"):
            with self.subTest(type=t):
                self.assertEqual(dr.windows_for(t), (14, 3))

    def test_clubs_and_unknown_keep_short_windows(self):
        for t in ("club", "course", "workshop", None, "щось-нове"):
            with self.subTest(type=t):
                self.assertEqual(dr.windows_for(t), (7, 2))


class TightestWindow(unittest.TestCase):
    def test_picks_the_tightest_fitting_window(self):
        cases = [
            ("scholarship", 27, 28), ("scholarship", 14, 14), ("scholarship", 10, 14),
            ("scholarship", 3, 3), ("scholarship", 0, 3),
            ("competition", 13, 14), ("competition", 2, 3),
            ("club", 7, 7), ("club", 1, 2),
        ]
        for t, left, expected in cases:
            with self.subTest(type=t, left=left):
                self.assertEqual(dr.tightest_window(left, dr.windows_for(t)), expected)

    def test_too_early_means_no_reminder(self):
        self.assertIsNone(dr.tightest_window(29, dr.windows_for("scholarship")))
        self.assertIsNone(dr.tightest_window(15, dr.windows_for("competition")))
        self.assertIsNone(dr.tightest_window(8, dr.windows_for("club")))


if __name__ == "__main__":
    unittest.main()
