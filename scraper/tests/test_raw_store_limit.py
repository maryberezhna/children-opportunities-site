"""Вичерпаний ліміт API не має списувати спроби сирців (14.09.2026)."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import raw_store  # noqa: E402

REAL = ("Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', "
        "'message': 'You have reached your specified API usage limits. You will regain "
        "access on 2026-10-01 at 00:00 UTC.'}}")


class UsageLimit(unittest.TestCase):
    def test_real_message_is_detected(self):
        self.assertTrue(raw_store.is_usage_limit(REAL))

    def test_detected_inside_normalizer_truncation(self):
        # NormalizeError тримає лише перші 300 символів — ознака має туди вміщатись.
        self.assertTrue(raw_store.is_usage_limit(REAL[:300]))

    def test_ordinary_errors_still_count_as_attempts(self):
        for e in ("Error code: 529 - overloaded_error", "Request timed out", "invalid JSON in tool input"):
            self.assertFalse(raw_store.is_usage_limit(e))


if __name__ == "__main__":
    unittest.main()
