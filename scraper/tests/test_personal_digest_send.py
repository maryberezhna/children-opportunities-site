"""Добірки й нагадування Dityam+ ідуть із платного бота; основний — запасний.

Регресія, проти якої стоять тести: до 14.09.2026 send_telegram слав з
основного бота (TELEGRAM_BOT_TOKEN), а підписники оформлюють Dityam+ у
платному @DityamPlusBot — і Telegram не дає боту першим написати людині, яка
його не запускала. Друга річ, яку тримаємо: людині, що сама заблокувала
платний бот, основний не дописує.
"""
import importlib.util
import pathlib
import sys
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import httpx  # noqa: F401
except ImportError:  # локально без залежностей скрапера
    sys.modules["httpx"] = types.ModuleType("httpx")


def load_personal_digest():
    # Під окремою назвою: test_deadline_reminders підміняє "personal_digest"
    # заглушкою в sys.modules, а тут потрібен справжній модуль.
    spec = importlib.util.spec_from_file_location(
        "personal_digest_send_under_test", ROOT / "personal_digest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self):
        return self._body


OK = FakeResponse(200, {"ok": True})
NOT_STARTED = FakeResponse(403, {"ok": False, "description": "Forbidden: bot can't initiate conversation with a user"})
NOT_FOUND = FakeResponse(400, {"ok": False, "description": "Bad Request: chat not found"})
BLOCKED = FakeResponse(403, {"ok": False, "description": "Forbidden: bot was blocked by the user"})
RATE_LIMIT = FakeResponse(429, {"ok": False, "description": "Too Many Requests: retry after 5"})


class SendTelegram(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()
        self.pd.PLUS_BOT_TOKEN = "PLUS"
        self.pd.MAIN_BOT_TOKEN = "MAIN"
        self.calls = []

    def answer(self, **by_token):
        def post(url, json=None, timeout=None):
            token = url.split("/bot", 1)[1].split("/", 1)[0]
            self.calls.append(token)
            return by_token[token]
        self.pd.httpx = types.SimpleNamespace(post=post)

    def test_plus_bot_goes_first(self):
        self.answer(PLUS=OK, MAIN=OK)
        self.assertTrue(self.pd.send_telegram("1", "hi"))
        self.assertEqual(self.calls, ["PLUS"])

    def test_falls_back_when_plus_bot_was_never_started(self):
        for plus in (NOT_STARTED, NOT_FOUND):
            with self.subTest(plus=plus.text):
                self.calls = []
                self.answer(PLUS=plus, MAIN=OK)
                self.assertTrue(self.pd.send_telegram("1", "hi"))
                self.assertEqual(self.calls, ["PLUS", "MAIN"])

    def test_no_fallback_when_user_blocked_plus_bot(self):
        self.answer(PLUS=BLOCKED, MAIN=OK)
        self.assertFalse(self.pd.send_telegram("1", "hi"))
        self.assertEqual(self.calls, ["PLUS"])

    def test_no_fallback_on_errors_another_bot_would_not_fix(self):
        self.answer(PLUS=RATE_LIMIT, MAIN=OK)
        self.assertFalse(self.pd.send_telegram("1", "hi"))
        self.assertEqual(self.calls, ["PLUS"])

    def test_without_plus_token_uses_main(self):
        self.pd.PLUS_BOT_TOKEN = ""
        self.answer(MAIN=OK)
        self.assertTrue(self.pd.send_telegram("1", "hi"))
        self.assertEqual(self.calls, ["MAIN"])

    def test_without_any_token_sends_nothing(self):
        self.pd.PLUS_BOT_TOKEN = ""
        self.pd.MAIN_BOT_TOKEN = ""
        self.answer()
        self.assertFalse(self.pd.send_telegram("1", "hi"))
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
