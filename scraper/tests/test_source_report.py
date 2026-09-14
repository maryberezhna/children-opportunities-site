"""Звіт по джерелах: групування й склеювання причин."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from source_report import build, group_key, normalize_reason, verdict  # noqa: E402


class Grouping(unittest.TestCase):
    def test_telegram_by_channel(self):
        self.assertEqual(group_key("Telegram (веб)", "https://t.me/s/Mozhlyvosti/10539"), "TG @mozhlyvosti")
        self.assertEqual(group_key("Можливості", "https://t.me/mozhlyvosti/1"), "TG @mozhlyvosti")

    def test_rss_by_feed_host(self):
        self.assertEqual(group_key("RSS-стрічки", "https://www.nus.org.ua/2026/09/03/x/"), "RSS nus.org.ua")

    def test_other_by_source_name(self):
        self.assertEqual(group_key("MAN", "https://man.gov.ua/x"), "MAN")


class Reasons(unittest.TestCase):
    def test_specifics_are_stripped(self):
        a = normalize_reason("вік 25–35 — не для дітей https://x.ua/1")
        b = normalize_reason("вік 18–40 — не для дітей https://y.ua/2")
        self.assertEqual(a, b)

    def test_duplicate(self):
        self.assertEqual(normalize_reason("duplicate: вже є 8fd5ea72-64b2-4ed7-bd55-c69288e0c20a"), "дубль — уже є в базі")


class Build(unittest.TestCase):
    def test_counts_and_verdict(self):
        raw = ([{"source_name": "Telegram (веб)", "source_url": "https://t.me/s/noise/1", "status": "rejected",
                 "last_error": "не можливість: новина"}] * 12
               + [{"source_name": "Telegram (веб)", "source_url": "https://t.me/s/good/1", "status": "processed",
                   "opportunity_id": "a"}] * 3)
        rep = build(raw, {"a": {"status": "active", "opportunity_type": "competition", "title": "Конкурс"}})
        self.assertEqual(verdict(rep["groups"]["TG @noise"]), "шум")
        self.assertEqual(rep["groups"]["TG @good"]["active"], 3)
        self.assertEqual(verdict(rep["groups"]["TG @good"]), "корисне")


if __name__ == "__main__":
    unittest.main()
