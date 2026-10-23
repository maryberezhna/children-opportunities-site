"""«Чи вдалося на щось подати заявку?» — як часто питати (Марія, 23.10.2026)."""
import unittest
from datetime import datetime, timedelta, timezone

from ask_checkin import ANSWERS, EVERY, FIRST_AFTER, due, keyboard, kind_of

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


def ago(days=0, hours=0):
    return (NOW - timedelta(days=days, hours=hours)).isoformat()


class Kind(unittest.TestCase):
    def test_recent_action_is_active(self):
        self.assertEqual(kind_of([ago(3)], NOW), "active")

    def test_old_or_no_action_is_quiet(self):
        self.assertEqual(kind_of([ago(40), None], NOW), "quiet")
        self.assertEqual(kind_of([], NOW), "quiet")


class Due(unittest.TestCase):
    def test_first_question_waits_for_subscription_age(self):
        sub = {"created_at": ago(FIRST_AFTER["active"] - 1)}
        self.assertFalse(due(sub, "active", [], [], NOW))
        sub = {"created_at": ago(FIRST_AFTER["active"])}
        self.assertTrue(due(sub, "active", [], [], NOW))

    def test_quiet_waits_longer(self):
        sub = {"created_at": ago(FIRST_AFTER["active"] + 1)}
        self.assertFalse(due(sub, "quiet", [], [], NOW))

    def test_repeat_after_period(self):
        sub = {"created_at": ago(200)}
        self.assertFalse(due(sub, "active", [{"asked_at": ago(EVERY["active"] - 1)}], [], NOW))
        self.assertTrue(due(sub, "active", [{"asked_at": ago(EVERY["active"])}], [], NOW))
        self.assertFalse(due(sub, "quiet", [{"asked_at": ago(EVERY["active"])}], [], NOW))

    def test_one_question_per_day_with_outcomes(self):
        sub = {"created_at": ago(200)}
        self.assertFalse(due(sub, "active", [], [ago(hours=5)], NOW))


class Keyboard(unittest.TestCase):
    def test_callback_fits_telegram_limit(self):
        kb = keyboard("12345678-1234-1234-1234-123456789012")
        datas = [b["callback_data"] for row in kb["inline_keyboard"] for b in row]
        self.assertEqual(len(datas), len(ANSWERS))
        self.assertTrue(all(len(d.encode()) <= 64 for d in datas))


if __name__ == "__main__":
    unittest.main()
