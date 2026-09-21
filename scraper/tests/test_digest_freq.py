"""Частота добірки з анкети Dityam+ (digest_subscribers.digest_freq).

Підписник обирає в боті, як часто хоче добірку: щодня, раз на 2 дні чи раз на
тиждень. Якщо розсилка цього не враховує, людина, яка попросила «раз на
тиждень», отримує щодня — і відписується. Нагадування про дедлайни живуть
окремо (deadline_reminders.py) і цієї межі не знають.

«⚡ Щойно зʼявиться» (instant) прибрано 21.09.2026 — обіцяв те, чого розсилка
раз на день не виконує; того ж дня повернуто чесне «щодня», першим і за
замовчуванням. Старе instant у базі й порожнє значення — «щодня».
Дні рахуються календарні, за Києвом, а не по 24 години.
"""
import importlib.util
import pathlib
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import httpx  # noqa: F401
except ImportError:  # локально без залежностей скрапера
    sys.modules["httpx"] = types.ModuleType("httpx")


def load_module():
    spec = importlib.util.spec_from_file_location(
        "personal_digest_freq_under_test", ROOT / "personal_digest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pd = load_module()
NOW = datetime(2026, 9, 20, 6, 0, tzinfo=timezone.utc)


def sub(freq, hours_ago=None):
    last = None if hours_ago is None else (NOW - timedelta(hours=hours_ago)).isoformat()
    return {"digest_freq": freq, "last_sent_at": last}


def at(y, m, d, hh, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=timezone.utc)


class DigestFreqTest(unittest.TestCase):
    def test_new_subscriber_gets_first_digest_immediately(self):
        for freq in ("daily", "2days", "weekly", "instant", None):
            self.assertTrue(pd.freq_due(sub(freq), NOW), freq)

    def test_options(self):
        self.assertNotIn("instant", pd.FREQ_DAYS)
        self.assertEqual(pd.FREQ_DAYS, {"daily": 1, "2days": 2, "weekly": 7})
        self.assertEqual(pd.DEFAULT_FREQ, "daily")

    def test_daily_once_per_kyiv_day(self):
        self.assertFalse(pd.freq_due(sub("daily", hours_ago=1), NOW))
        self.assertTrue(pd.freq_due(sub("daily", hours_ago=24), NOW))

    def test_daily_does_not_skip_a_day_when_the_schedule_drifts(self):
        # Учора розсилка пішла о 15:59 UTC (18:59 Київ), сьогодні запуск о
        # 10:05 UTC — минуло 18 годин, але це вже інша київська доба.
        last = {"digest_freq": "daily", "last_sent_at": at(2026, 9, 19, 15, 59).isoformat()}
        self.assertTrue(pd.freq_due(last, at(2026, 9, 20, 10, 5)))

    def test_second_run_the_same_kyiv_day_sends_nothing(self):
        last = {"digest_freq": "daily", "last_sent_at": at(2026, 9, 20, 7, 30).isoformat()}
        self.assertFalse(pd.freq_due(last, at(2026, 9, 20, 12, 0)))
        # 21:30 UTC — це вже 00:30 наступного дня за Києвом.
        self.assertTrue(pd.freq_due(last, at(2026, 9, 20, 21, 30)))

    def test_legacy_instant_and_missing_read_as_daily(self):
        for value in ("instant", None, "", "щойно"):
            self.assertEqual(pd.freq_days(value), 1, value)
        self.assertFalse(pd.freq_due(sub("instant", hours_ago=1), NOW))
        self.assertTrue(pd.freq_due(sub("instant", hours_ago=24), NOW))
        self.assertFalse(pd.freq_due({"last_sent_at": NOW.isoformat()}, NOW))

    def test_two_days(self):
        self.assertFalse(pd.freq_due(sub("2days", hours_ago=24), NOW))
        self.assertTrue(pd.freq_due(sub("2days", hours_ago=48), NOW))
        # Позавчора пізно ввечері, сьогодні зранку — вже через день, а не «ще 3 години».
        last = {"digest_freq": "2days", "last_sent_at": at(2026, 9, 18, 16, 0).isoformat()}
        self.assertTrue(pd.freq_due(last, at(2026, 9, 20, 9, 0)))

    def test_weekly(self):
        self.assertFalse(pd.freq_due(sub("weekly", hours_ago=24 * 6), NOW))
        self.assertTrue(pd.freq_due(sub("weekly", hours_ago=24 * 7), NOW))


if __name__ == "__main__":
    unittest.main()
