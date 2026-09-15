"""Добірка Dityam+ у Telegram: кнопки, зміст і «Не цікаво» (15.09.2026).

До 15.09.2026 /plus показував у прикладі «👍 Цікаво / 👎 Не цікаво / 📅 Додати
в календар», а в справжніх повідомленнях їх не було. Тести тримають те, що
легко тихо зламати: ліміт Telegram на callback_data, календар лише з
дедлайном, дедлайн у рядку деталей і що «👎» справді прибирає запис.

Того ж дня імейл Dityam+ прибрано повністю (рішення Марії): добірки й
нагадування йдуть лише в Telegram, і тест стежить, щоб листи не повернулись
непомітно.
"""
import importlib.util
import pathlib
import sys
import types
import unittest
from datetime import date

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
        "personal_digest_telegram_under_test", ROOT / "personal_digest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SUB = {"unsub_token": "tok123", "telegram_chat_id": "42"}
OPP_ID = "11111111-2222-3333-4444-555555555555"


def item(**over):
    base = {
        "id": OPP_ID, "slug": "isef-ukraine", "title": "ISEF <Ukraine>",
        "age_from": 14, "age_to": 17, "cost_type": "free",
        "_themes": {"contests"}, "deadline": "2027-01-31",
    }
    base.update(over)
    return base


class TelegramKeyboard(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()

    def test_row_per_item_numbered_like_the_text(self):
        other = item(id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", slug="no-date", deadline=None)
        rows = self.pd.telegram_keyboard([item(), other])["inline_keyboard"]
        self.assertEqual([b["text"] for b in rows[0]], ["👍 1", "👎 1", "📅 1"])
        self.assertEqual([b["text"] for b in rows[1]], ["👍 2", "👎 2"])  # без дедлайну — без календаря
        text = self.pd.build_telegram(SUB, [item(), other])
        self.assertIn("1. <a", text)
        self.assertIn("2. <a", text)

    def test_callback_data_fits_telegram_limit(self):
        for row in self.pd.telegram_keyboard([item()])["inline_keyboard"]:
            for button in row:
                if "callback_data" in button:
                    self.assertLessEqual(len(button["callback_data"].encode()), 64)

    def test_send_telegram_passes_keyboard(self):
        sent = []
        self.pd.PLUS_BOT_TOKEN = "PLUS"
        self.pd.MAIN_BOT_TOKEN = ""
        self.pd.httpx = types.SimpleNamespace(post=lambda url, json=None, timeout=None: (
            sent.append(json) or types.SimpleNamespace(status_code=200, text="", json=lambda: {"ok": True})))
        keyboard = self.pd.telegram_keyboard([item()])
        self.assertTrue(self.pd.send_telegram("1", "hi", reply_markup=keyboard))
        self.assertEqual(sent[0]["reply_markup"], keyboard)
        self.assertTrue(self.pd.send_telegram("1", "hi"))
        self.assertNotIn("reply_markup", sent[1])


class Content(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()

    def test_title_is_escaped(self):
        self.assertIn("ISEF &lt;Ukraine&gt;", self.pd.build_telegram(SUB, [item()]))

    def test_deadline_in_meta(self):
        this_year = f"{date.today().year}-10-30"
        self.assertIn("до 30 жовтня", self.pd.build_telegram(SUB, [item(deadline=this_year)]))
        self.assertNotIn(" до ", self.pd._meta(item(deadline=None)))

    def test_no_email_delivery_left(self):
        for name in ("send_email", "build_email", "email_footer", "feedback_url"):
            self.assertFalse(hasattr(self.pd, name), name)


class FakeQuery:
    def __init__(self, rows, log):
        self.rows, self.log = rows, log

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        self.log.append(("eq", a))
        return self

    def in_(self, *a, **k):
        self.log.append(("in", a))
        return self

    def execute(self):
        return types.SimpleNamespace(data=self.rows)


class FakeClient:
    def __init__(self, rows):
        self.rows, self.log = rows, []

    def table(self, name):
        self.log.append(("table", name))
        return FakeQuery(self.rows, self.log)


class Disliked(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()

    def test_groups_not_interested_by_chat(self):
        client = FakeClient([
            {"opportunity_id": "a", "telegram_user_id": 42},
            {"opportunity_id": "b", "telegram_user_id": 42},
        ])
        got = self.pd.load_disliked(client, [{"telegram_chat_id": "42"}, {"telegram_chat_id": None}])
        self.assertEqual(got, {"42": {"a", "b"}})
        self.assertIn(("eq", ("value", "no")), client.log)
        self.assertIn(("in", ("telegram_user_id", ["42"])), client.log)

    def test_no_telegram_ids_no_query(self):
        client = FakeClient([])
        self.assertEqual(self.pd.load_disliked(client, [{"telegram_chat_id": None}]), {})
        self.assertEqual(client.log, [])


if __name__ == "__main__":
    unittest.main()
