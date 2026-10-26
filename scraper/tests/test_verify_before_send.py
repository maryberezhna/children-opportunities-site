"""Dityam+: свіжа перевірка сторінок перед добіркою й нагадуваннями (26.10.2026).

Марія: «перевіряй завжди на актуальність можливості перед публікацією».
Перевіряємо унікальні записи запуску один раз, а перевірені сьогодні — не
вдруге; що не пройшло — не йде нікому; збій перевірки — не шлемо взагалі.
"""
import os
import pathlib
import sys
import unittest
from datetime import date
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import verify_before_send as vbs  # noqa: E402

TODAY = date(2026, 10, 26)


def row(i, checked=None, status="active"):
    return {"id": i, "title": f"Можливість {i}", "status": status, "content_checked_at": checked}


class KeepOpen(unittest.TestCase):
    def test_same_rules_as_js(self):
        rows = [row("open"), row("ended"), row("platform"), row("camp"), row("none")]
        verdicts = {
            "open": {"state": "open", "status": "active"},
            "ended": {"state": "ended", "status": "closed"},
            "platform": {"state": "unreadable", "status": "active", "kind": "permanent",
                         "has_dates": False, "assumed": False},
            "camp": {"state": "unclear", "status": "active", "kind": "one_time", "has_dates": True},
        }
        kept, dropped = vbs.keep_open(rows, verdicts)
        self.assertEqual([r["id"] for r in kept], ["open", "platform"])
        self.assertEqual({r["id"]: why for r, why in dropped},
                         {"ended": "ended/closed", "camp": "unclear/active", "none": "без вердикту"})


class CheckedToday(unittest.TestCase):
    def test_today_and_active_only(self):
        self.assertTrue(vbs.checked_today(row("a", "2026-10-26T05:00:00+00:00"), TODAY))
        self.assertFalse(vbs.checked_today(row("a", "2026-10-25T23:00:00+00:00"), TODAY))
        self.assertFalse(vbs.checked_today(row("a", "2026-10-26T05:00:00Z", status="closed"), TODAY))
        self.assertFalse(vbs.checked_today(row("a", None), TODAY))


class VerifyRows(unittest.TestCase):
    def setUp(self):
        os.environ.pop("PUBLISH_CHECK", None)

    def test_checks_unique_stale_once_and_trusts_today(self):
        calls = []

        def run(ids, dry_run):
            calls.append((sorted(ids), dry_run))
            return {"b": {"state": "open", "status": "active"},
                    "c": {"state": "ended", "status": "closed"}}

        rows = [row("a", "2026-10-26T06:00:00+00:00"), row("b"), row("c"), row("b")]
        ok, dropped = vbs.verify_rows(rows, run=run, today=TODAY, dry_run=True)
        self.assertEqual(calls, [(["b", "c"], True)])
        self.assertEqual(ok, {"a", "b"})
        self.assertEqual([r["id"] for r, _ in dropped], ["c"])

    def test_nothing_to_check_no_model_call(self):
        ok, _ = vbs.verify_rows([row("a", "2026-10-26T06:00:00+00:00")],
                                run=lambda *a: self.fail("не мало кликати модель"), today=TODAY)
        self.assertEqual(ok, {"a"})

    def test_off_switch(self):
        with mock.patch.dict(os.environ, {"PUBLISH_CHECK": "off"}):
            ok, _ = vbs.verify_rows([row("x")], run=lambda *a: self.fail("вимкнено"), today=TODAY)
        self.assertEqual(ok, {"x"})

    def test_error_is_not_swallowed(self):
        def boom(ids, dry_run):
            raise RuntimeError("lifecycle впав")
        with self.assertRaises(RuntimeError):
            vbs.verify_rows([row("x")], run=boom, today=TODAY)


class SendersUseIt(unittest.TestCase):
    def test_digest_and_reminders_verify_before_sending(self):
        digest = (HERE / "personal_digest.py").read_text(encoding="utf-8")
        self.assertIn("verify_before_send.verify_rows(", digest)
        # Перевірка — до циклу відправки, а не всередині для кожного підписника.
        self.assertLess(digest.index("verify_before_send.verify_rows("),
                        digest.index("for sub, items, steps, revival in plans:"))
        self.assertIn("content_checked_at", digest)
        rem = (HERE / "deadline_reminders.py").read_text(encoding="utf-8")
        self.assertLess(rem.index("verify_before_send.verify_rows("), rem.index("    sent = 0\n    for sub in subs:"))
        self.assertIn("content_checked_at", rem)


if __name__ == "__main__":
    unittest.main()
