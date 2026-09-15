"""Зміст можливості в добірці Dityam+ (15.09.2026).

До 15.09.2026 у листі була лише назва, тип і вік — без опису й без дедлайну,
хоча /plus обіцяє «назву, вік, вартість, дедлайн і посилання на деталі».
Марія: «чому в імейлі немає опису можливостей».
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
    spec = importlib.util.spec_from_file_location(
        "personal_digest_content_under_test", ROOT / "personal_digest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SUB = {"unsub_token": "tok", "telegram_chat_id": "42"}


def item(**over):
    base = {
        "id": "11111111-2222-3333-4444-555555555555", "slug": "daad", "title": "DAAD",
        "age_from": 15, "age_to": 17, "cost_type": "free", "_themes": {"languages"},
        "deadline": "2026-10-30",
        "summary": "Стипендії на літні мовні курси в Німеччині для старшокласників з України. Повне покриття <витрат>.",
    }
    base.update(over)
    return base


class Content(unittest.TestCase):
    def setUp(self):
        self.pd = load_personal_digest()

    def test_email_has_escaped_summary(self):
        body = self.pd.build_email(SUB, [item()])
        self.assertIn("Стипендії на літні мовні курси", body)
        self.assertIn("&lt;витрат&gt;", body)

    def test_long_summary_is_cut_on_a_word_with_ellipsis(self):
        text = self.pd.short_summary({"summary": "слово " * 100})
        self.assertLessEqual(len(text), self.pd.SUMMARY_CHARS + 1)
        self.assertTrue(text.endswith("…"))
        self.assertFalse(text[:-1].endswith(" "))

    def test_no_summary_no_empty_paragraph(self):
        self.assertEqual(self.pd.short_summary({"summary": None}), "")
        self.assertNotIn("<p style", self.pd.build_email(SUB, [item(summary=None)]).split("<table")[1].split("</table>")[0])

    def test_deadline_in_meta_for_email_and_telegram(self):
        self.assertIn("до 30 жовтня", self.pd.build_email(SUB, [item()]))
        self.assertIn("до 30 жовтня", self.pd.build_telegram(SUB, [item()]))
        self.assertNotIn(" до ", self.pd._meta(item(deadline=None)))


if __name__ == "__main__":
    unittest.main()
