"""Відправка листів Dityam+ через Resend (15.09.2026).

Gmail відбиває автоматичні листи зі звичайної gmail.com («550 5.7.30 DKIM
authentication didn't pass»), тож із ключем RESEND_API_KEY листи мають іти
через Resend із домену dityam.com.ua, а без ключа — як і раніше, через Gmail.
Тести тримають саме цей перемикач і те, що 429 від Resend не губить лист.
"""
import importlib.util
import os
import pathlib
import sys
import types
import unittest
from unittest import mock

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
        "personal_digest_resend_under_test", ROOT / "personal_digest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Response:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


class FakeHttpx:
    def __init__(self, *statuses):
        self.statuses = list(statuses)
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return Response(self.statuses.pop(0), '{"message":"error"}')


class FakeSMTP:
    def __init__(self, host, port):
        self.host = host
        self.sent = []
        FakeSMTP.last = self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        self.user = user

    def sendmail(self, from_addr, to_addrs, msg):
        self.sent.append((from_addr, to_addrs))


class NoSMTP:
    def SMTP_SSL(self, *args):
        raise AssertionError("з ключем Resend Gmail не використовується")


class ResendSending(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()
        self.pd.time = types.SimpleNamespace(sleep=lambda s: None)

    def test_with_key_sends_through_resend_from_domain(self):
        self.pd.httpx = FakeHttpx(200)
        self.pd.smtplib = NoSMTP()
        with mock.patch.dict(os.environ, {"RESEND_API_KEY": "re_test"}):
            ok = self.pd.send_email("parent@example.com", "<p>Добірка</p>", subject="Тема")
        self.assertTrue(ok)
        url, kwargs = self.pd.httpx.calls[0]
        self.assertEqual(url, "https://api.resend.com/emails")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer re_test")
        body = kwargs["json"]
        self.assertIn("@dityam.com.ua>", body["from"])
        self.assertEqual(body["to"], ["parent@example.com"])
        self.assertEqual(body["subject"], "Тема")
        self.assertEqual(body["html"], "<p>Добірка</p>")
        self.assertEqual(body["reply_to"], "hellodityam.com.ua@gmail.com")

    def test_rate_limit_is_retried_not_lost(self):
        self.pd.httpx = FakeHttpx(429, 200)
        with mock.patch.dict(os.environ, {"RESEND_API_KEY": "re_test"}):
            self.assertTrue(self.pd.send_email("parent@example.com", "<p>x</p>"))
        self.assertEqual(len(self.pd.httpx.calls), 2)

    def test_rejected_email_reports_failure(self):
        self.pd.httpx = FakeHttpx(422)
        with mock.patch.dict(os.environ, {"RESEND_API_KEY": "re_test"}):
            self.assertFalse(self.pd.send_email("not-an-email", "<p>x</p>"))
        self.assertEqual(len(self.pd.httpx.calls), 1)

    def test_without_key_falls_back_to_gmail(self):
        self.pd.httpx = FakeHttpx()
        self.pd.smtplib = types.SimpleNamespace(SMTP_SSL=FakeSMTP)
        self.pd.GMAIL_APP_PASSWORD = "app-password"
        with mock.patch.dict(os.environ):
            os.environ.pop("RESEND_API_KEY", None)
            self.assertTrue(self.pd.send_email("parent@example.com", "<p>x</p>"))
        self.assertEqual(self.pd.httpx.calls, [])
        self.assertEqual(FakeSMTP.last.host, "smtp.gmail.com")
        self.assertEqual(FakeSMTP.last.sent[0][1], ["parent@example.com"])


if __name__ == "__main__":
    unittest.main()
