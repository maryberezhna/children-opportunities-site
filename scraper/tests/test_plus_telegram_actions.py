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

    def test_each_opportunity_is_its_own_message(self):
        """Кожна можливість — окремим повідомленням зі своїми кнопками (рішення
        24.09.2026; щоденна добірка до 29.09.2026 йшла списком «✍️ 1 / 👎 1»)."""
        other = item(id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", slug="no-date", deadline=None)
        msgs = self.pd.build_messages(SUB, [item(), other])
        self.assertEqual(len(msgs), 3)
        head, first, second = msgs
        self.assertIsNone(head[1])
        self.assertIn("Нові можливості", head[0])
        self.assertIn("isef-ukraine", first[0])
        self.assertIn("no-date", second[0])
        self.assertNotIn("1. <a", first[0])
        self.assertEqual([b["text"] for b in first[1]["inline_keyboard"][0]], ["👍 Цікаво", "👎 Не цікаво"])

    def test_no_old_apply_button(self):
        """«✍️ Подаюсь» замінено на «👍 Цікаво» (#497): рішення в людини ще немає."""
        for row in self.pd.card_keyboard(item())["inline_keyboard"]:
            for button in row:
                self.assertNotIn("✍️", button["text"])
                self.assertNotIn("pfb:yes", button.get("callback_data", ""))

    def test_calendar_is_a_button_only_with_a_date(self):
        # Веде прямо в Google Calendar, а не на сторінку сайту (Марія, 25.09.2026).
        rows = self.pd.card_keyboard(item())["inline_keyboard"]
        cal = [b for row in rows for b in row if "url" in b]
        self.assertEqual(len(cal), 1)
        self.assertIn("calendar.google.com", cal[0]["url"])
        self.assertNotIn("/events/", cal[0]["url"])
        # Без дати ставити подію нікуди — і кнопки не буде.
        no_date = self.pd.card_keyboard(item(deadline=None))["inline_keyboard"]
        self.assertEqual([b for row in no_date for b in row if "url" in b], [])

    def test_digest_does_not_offer_unsubscribe_every_time(self):
        """«Відписатись — /stop» у кожній добірці — це не турбота."""
        for text, _ in self.pd.build_messages(SUB, [item()]):
            self.assertNotIn("/stop", text)

    def test_interested_button_carries_the_opportunity_id(self):
        """«👍 Цікаво» — памʼять про пройдене: бот має знати, що саме позначили."""
        rows = self.pd.card_keyboard(item())["inline_keyboard"]
        btn = [b for b in rows[0] if b.get("callback_data", "").startswith("papp:")]
        self.assertEqual(len(btn), 1)
        self.assertTrue(btn[0]["callback_data"].endswith(item()["id"]))

    def test_callback_data_fits_telegram_limit(self):
        for row in self.pd.card_keyboard(item())["inline_keyboard"]:
            for button in row:
                if "callback_data" in button:
                    self.assertLessEqual(len(button["callback_data"].encode()), 64)

    def test_summary_is_cut_on_a_word(self):
        text = self.pd.card_text(item(summary="слово " * 100))
        self.assertIn("…", text)
        self.assertLess(len(text), 600)

    def test_send_messages_stops_without_header(self):
        calls = []
        self.pd.time = types.SimpleNamespace(sleep=lambda s: None)
        self.pd.send_telegram = lambda chat, text, reply_markup=None: calls.append(text) or False
        self.assertFalse(self.pd.send_messages("1", [("h", None), ("c", {})]))
        self.assertEqual(calls, ["h"])

    def test_send_telegram_passes_keyboard(self):
        sent = []
        self.pd.PLUS_BOT_TOKEN = "PLUS"
        self.pd.MAIN_BOT_TOKEN = ""
        self.pd.httpx = types.SimpleNamespace(post=lambda url, json=None, timeout=None: (
            sent.append(json) or types.SimpleNamespace(status_code=200, text="", json=lambda: {"ok": True})))
        keyboard = self.pd.card_keyboard(item())
        self.assertTrue(self.pd.send_telegram("1", "hi", reply_markup=keyboard))
        self.assertEqual(sent[0]["reply_markup"], keyboard)
        self.assertTrue(self.pd.send_telegram("1", "hi"))
        self.assertNotIn("reply_markup", sent[1])


class Content(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()

    def test_title_is_escaped(self):
        self.assertIn("ISEF &lt;Ukraine&gt;", self.pd.card_text(item()))

    def test_event_dates_in_meta_and_calendar(self):
        # 17.09.2026: подія без дедлайну не мала в добірці ні дати, ні кнопки
        # календаря; подія з дедлайном — не показувала, коли саме відбувається.
        y = __import__("datetime").datetime.now().year
        o = item(deadline=None, event_start_date=f"{y}-11-06", event_end_date=f"{y}-11-08")
        meta = self.pd._meta(o)
        self.assertIn("проходить 6–8 листопада", meta)
        self.assertTrue(self.pd.calendar_url(o))
        self.assertIsNone(self.pd.calendar_url(item(deadline=None)))

    def test_deadline_in_meta(self):
        this_year = f"{date.today().year}-10-30"
        self.assertIn("до 30 жовтня", self.pd.card_text(item(deadline=this_year)))
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
