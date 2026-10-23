"""Канали в реєстрі джерел (24.09.2026): вимкнути один канал — рядком у базі.

Доти вимикач був один на всі чотирнадцять, тож @unicef_ukraine (6 сторінок у
LLM за 10 днів, 0 записів) не можна було зняти, не знявши заразом «Твій
космос» (33% прийнятих).
"""
import os
import pathlib
import re
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scrapers"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from telegram_web import CHANNELS, channels_from_registry  # noqa: E402

MIGRATION = (pathlib.Path(__file__).resolve().parents[2]
             / "supabase" / "migrations" / "20260924_telegram_channels_registry.sql")


class FromRegistry(unittest.TestCase):
    def test_disabled_channel_is_skipped(self):
        rows = {
            "Твій космос можливостей": {"enabled": True, "config": {"handle": "tviyspace"}},
            "UNICEF Ukraine": {"enabled": False, "config": {"handle": "unicef_ukraine"}},
        }
        self.assertEqual(channels_from_registry(rows), [("tviyspace", "Твій космос можливостей")])

    def test_handle_is_normalised(self):
        rows = {"Грантотека": {"enabled": True, "config": {"handle": " @grantoteka "}}}
        self.assertEqual(channels_from_registry(rows), [("grantoteka", "Грантотека")])

    def test_row_without_handle_is_skipped_not_fatal(self):
        rows = {"Порожній": {"enabled": True, "config": {}},
                "Грантотека": {"enabled": True, "config": {"handle": "grantoteka"}}}
        self.assertEqual(channels_from_registry(rows), [("grantoteka", "Грантотека")])

    def test_empty_registry_means_fallback(self):
        # None — сигнал «реєстру немає»: викликач бере вбудований перелік.
        # Порожній список означав би «жодного каналу», і скрапінг зупинився б
        # через недоступність реєстру, а не через рішення людини.
        self.assertIsNone(channels_from_registry({}))
        self.assertIsNone(channels_from_registry(None))

    def test_enabled_defaults_to_true(self):
        rows = {"Нове": {"config": {"handle": "newone"}}}
        self.assertEqual(channels_from_registry(rows), [("newone", "Нове")])


class MigrationMatchesCode(unittest.TestCase):
    """Вбудований перелік — запасний шлях, тож він мусить лишатись повним:
    канал, якого немає в міграції, зникне для всіх, у кого реєстр заповнений."""

    def test_every_builtin_channel_is_in_the_migration(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        handles = set(re.findall(r'"handle":\s*"([^"]+)"', sql))
        for handle, display in CHANNELS:
            self.assertIn(handle, handles, f"{display} ({handle}) немає в міграції реєстру")

    def test_migration_has_no_channel_the_code_forgot(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        handles = set(re.findall(r'"handle":\s*"([^"]+)"', sql))
        self.assertEqual(handles - {h for h, _ in CHANNELS}, set())


if __name__ == "__main__":
    unittest.main()


class FollowSourcesSurvivesTest(unittest.TestCase):
    """Один дивний допис не валить усе джерело (18–22.10.2026 нічний прогін
    падав «not enough values to unpack» десь у переході за посиланням, і
    Telegram давав 0 нових щоночі)."""

    def test_broken_post_is_kept_and_others_followed(self):
        import asyncio
        from unittest import mock
        import telegram_web as tw

        items = [
            {"source_url": "https://t.me/a/1", "raw_text": "допис 1", "_links": ["boom"]},
            {"source_url": "https://t.me/a/2", "raw_text": "допис 2", "_links": []},
        ]

        def pick(links):
            if links == ["boom"]:
                raise ValueError("not enough values to unpack (expected 2, got 1)")
            return None

        with mock.patch.object(tw.first_source, "pick", side_effect=pick):
            got = asyncio.run(tw._follow_sources(client=None, items=items,
                                                 semaphore=asyncio.Semaphore(1)))

        self.assertEqual([it["source_url"] for it in got], ["https://t.me/a/1", "https://t.me/a/2"])
        self.assertEqual(got[0]["raw_text"], "допис 1")
        self.assertNotIn("_links", got[0])
