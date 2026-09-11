"""Ворота часу відправки.

Регресія, проти якої вони стоять: розклад cron у GitHub Actions для цього
репозиторію запізнюється на 4-5 годин, тож воркфлоу просить кілька ранкових
запусків. Без воріт перший з них надіслав би нагадування о 5 ранку.
"""
import pathlib
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import send_window  # noqa: E402


def at(hour: int):
    """Підмінює київський час на вказану годину."""
    moment = datetime(2026, 9, 11, hour, 30, tzinfo=timezone(timedelta(hours=3)))
    return mock.patch.object(send_window, "kyiv_now", return_value=moment)


class SendWindow(unittest.TestCase):
    def test_before_window_blocks(self):
        with at(5):
            self.assertTrue(send_window.too_early(9))

    def test_inside_window_passes(self):
        for hour in (9, 12, 23):
            with self.subTest(hour=hour), at(hour):
                self.assertFalse(send_window.too_early(9))

    def test_zero_disables_gate(self):
        # 0 — свідомий вимикач для ручного запуску, а не «північ».
        with at(3):
            self.assertFalse(send_window.too_early(0))

    def test_hour_from_environment(self):
        with at(8), mock.patch.dict("os.environ", {"SEND_AFTER_HOUR": "10"}):
            self.assertTrue(send_window.too_early())
        with at(11), mock.patch.dict("os.environ", {"SEND_AFTER_HOUR": "10"}):
            self.assertFalse(send_window.too_early())

    def test_broken_environment_falls_back(self):
        # Сміття в змінній не сміє вимкнути ворота мовчки.
        with at(5), mock.patch.dict("os.environ", {"SEND_AFTER_HOUR": "дев'ята"}):
            self.assertTrue(send_window.too_early())

    def test_kyiv_now_is_timezone_aware(self):
        self.assertIsNotNone(send_window.kyiv_now().tzinfo)


if __name__ == "__main__":
    unittest.main()
