"""Частота добірки з анкети Dityam+ (digest_subscribers.digest_freq).

Підписник обирає в боті, як часто хоче добірку: раз на 2 дні чи раз на
тиждень. Якщо розсилка цього не враховує, людина, яка попросила «раз на
тиждень», отримує щодня — і відписується. Нагадування про дедлайни живуть
окремо (deadline_reminders.py) і цієї межі не знають.

Варіант «⚡ Щойно зʼявиться» (instant) прибрано 21.09.2026 (рішення Марії:
«зупини і видали поки») — він обіцяв те, чого розсилка раз на день не
виконує. Старе instant у базі й порожнє значення — «раз на 2 дні».
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


class DigestFreqTest(unittest.TestCase):
    def test_new_subscriber_gets_first_digest_immediately(self):
        for freq in ("2days", "weekly", "instant", None):
            self.assertTrue(pd.freq_due(sub(freq), NOW), freq)

    def test_no_instant_option(self):
        self.assertNotIn("instant", pd.FREQ_DAYS)
        self.assertEqual(set(pd.FREQ_DAYS), {"2days", "weekly"})

    def test_legacy_instant_reads_as_two_days(self):
        self.assertEqual(pd.freq_days("instant"), 2)
        self.assertFalse(pd.freq_due(sub("instant", hours_ago=1), NOW))
        self.assertFalse(pd.freq_due(sub("instant", hours_ago=24), NOW))
        self.assertTrue(pd.freq_due(sub("instant", hours_ago=48), NOW))

    def test_two_days(self):
        self.assertFalse(pd.freq_due(sub("2days", hours_ago=24), NOW))
        self.assertTrue(pd.freq_due(sub("2days", hours_ago=48), NOW))

    def test_weekly(self):
        self.assertFalse(pd.freq_due(sub("weekly", hours_ago=24 * 6), NOW))
        self.assertTrue(pd.freq_due(sub("weekly", hours_ago=24 * 7), NOW))

    def test_missing_or_unknown_value_reads_as_two_days(self):
        for value in (None, "", "daily", "щойно"):
            self.assertEqual(pd.freq_days(value), 2, value)
        self.assertFalse(pd.freq_due({"digest_freq": None, "last_sent_at": NOW.isoformat()}, NOW))
        self.assertFalse(pd.freq_due({"last_sent_at": NOW.isoformat()}, NOW))
        yesterday = (NOW - timedelta(hours=24)).isoformat()
        self.assertFalse(pd.freq_due({"last_sent_at": yesterday}, NOW))
        two_days = (NOW - timedelta(hours=48)).isoformat()
        self.assertTrue(pd.freq_due({"last_sent_at": two_days}, NOW))


if __name__ == "__main__":
    unittest.main()
