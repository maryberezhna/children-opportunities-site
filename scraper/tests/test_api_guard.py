"""Запобіжник Claude API: ліміт і оплата мають робити запуск червоним.

Регресія 14.09.2026: «You have reached your specified API usage limits»
перетворилось на «кандидатів: 0» у зеленому запуску.
"""
import pathlib
import subprocess
import sys
import textwrap
import unittest

SCRAPER = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRAPER))

import api_guard  # noqa: E402


class IsFatal(unittest.TestCase):
    def test_usage_limit_and_billing_are_fatal(self):
        self.assertTrue(api_guard.is_fatal(
            400, "You have reached your specified API usage limits. You will regain access on 2026-10-01"))
        self.assertTrue(api_guard.is_fatal(400, "Your credit balance is too low to access the Anthropic API"))
        self.assertTrue(api_guard.is_fatal(401, "invalid x-api-key"))
        self.assertTrue(api_guard.is_fatal(403, "Your API key does not have permission"))

    def test_transient_errors_are_not_fatal(self):
        self.assertFalse(api_guard.is_fatal(429, "rate_limit_error: usage limit per minute"))
        self.assertFalse(api_guard.is_fatal(529, "overloaded"))
        self.assertFalse(api_guard.is_fatal(500, "internal error"))
        self.assertFalse(api_guard.is_fatal(400, "messages: text content blocks must be non-empty"))


class Note(unittest.TestCase):
    # Стан запобіжника глобальний на процес. Без скидання фатальна відмова з
    # цього тесту зробила б червоним увесь прогін тестів — саме так, як це
    # і має бути в справжньому скрипті.
    def setUp(self):
        api_guard._fatal = None

    def tearDown(self):
        api_guard._fatal = None

    def test_first_fatal_is_remembered(self):
        self.assertIsNone(api_guard.fatal())
        self.assertFalse(api_guard.note(429, "slow down"))
        self.assertIsNone(api_guard.fatal())
        self.assertTrue(api_guard.note(400, "usage limits reached"))
        self.assertIn("usage limits", api_guard.fatal())


class ExitCode(unittest.TestCase):
    """Навіть якщо скрипт ковтнув помилку й завершився «успішно», процес
    має вийти з ненульовим кодом — інакше GitHub покаже зелений запуск."""

    def run_script(self, body):
        code = textwrap.dedent(f"""
            import sys
            sys.path.insert(0, {str(SCRAPER)!r})
            import api_guard
            {body}
            sys.exit(0)
        """)
        return subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)

    def test_swallowed_fatal_error_still_fails_the_run(self):
        r = self.run_script('api_guard.note(400, "usage limits")')
        self.assertEqual(r.returncode, api_guard.EXIT_CODE)
        self.assertIn("Claude API недоступний", r.stderr)

    def test_clean_run_stays_green(self):
        r = self.run_script('api_guard.note(429, "rate limit")')
        self.assertEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
