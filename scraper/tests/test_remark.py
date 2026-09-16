"""Запобіжники перерозмітки. Усі кейси — із сухого прогону 16.09.2026, де
без них у базу пішли б хибні дати й фальшиві посилання на подачу."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from normalizer import valid_apply_url  # noqa: E402
from remark import plan_patch  # noqa: E402

TODAY = "2026-09-16"


def row(**over):
    base = {"id": "x", "title": "t", "source_url": "https://t.me/tviyspace/11815",
            "deadline": None, "event_start_date": None, "event_end_date": None,
            "details": None, "apply_url": None, "price_note": None,
            "verified_at": None, "admin_comment": None}
    return {**base, **over}


class ApplyUrl(unittest.TestCase):
    def test_form_is_apply_link(self):
        self.assertEqual(valid_apply_url("https://forms.gle/5ZZAEhubL5kaB2J38"),
                         "https://forms.gle/5ZZAEhubL5kaB2J38")

    def test_telegram_chat_is_not(self):
        # Одне й те саме запрошення в чат приліпилось до чотирьох обмінів.
        self.assertIsNone(valid_apply_url("https://t.me/+QTt-hFjTfJw0MGNi"))

    def test_source_itself_is_not(self):
        self.assertIsNone(valid_apply_url("https://example.org/p/", "https://example.org/p"))

    def test_words_are_not(self):
        self.assertIsNone(valid_apply_url("дивись у пості"))


class Dates(unittest.TestCase):
    def test_malmo_gets_start_and_keeps_deadline(self):
        r = row(deadline="2026-09-17", event_end_date="2026-11-08")
        out = {"deadline": "2026-09-17", "event_start_date": "2026-11-06",
               "event_end_date": "2026-11-08",
               "apply_url": "https://forms.gle/5ZZAEhubL5kaB2J38"}
        patch, _notes, stale = plan_patch(r, out, only_dates=False, today=TODAY)
        self.assertIsNone(stale)
        self.assertEqual(patch["event_start_date"], "2026-11-06")
        self.assertNotIn("deadline", patch)
        self.assertEqual(patch["apply_url"], "https://forms.gle/5ZZAEhubL5kaB2J38")

    def test_past_cycle_is_not_written(self):
        # Adroit Prizes: сторінка показує торішній дедлайн. Запис закрив би
        # живу щорічну програму вночі.
        r = row(deadline="2027-05-01")
        out = {"deadline": "2026-05-12"}
        patch, _notes, stale = plan_patch(r, out, only_dates=True, today=TODAY)
        self.assertIn("минулі дати", stale)
        self.assertNotIn("deadline", patch)

    def test_past_event_is_not_written(self):
        r = row()
        out = {"event_start_date": "2026-07-12", "event_end_date": "2026-07-19"}
        patch, _notes, stale = plan_patch(r, out, only_dates=True, today=TODAY)
        self.assertIsNotNone(stale)
        self.assertFalse({"event_start_date", "event_end_date"} & patch.keys())

    def test_verified_record_dates_untouched(self):
        r = row(verified_at="2026-09-01T00:00:00Z", deadline="2026-10-01")
        out = {"deadline": "2026-10-20", "details": "## Програма\n- дебати"}
        patch, _notes, _stale = plan_patch(r, out, only_dates=False, today=TODAY)
        self.assertNotIn("deadline", patch)
        self.assertIn("details", patch)

    def test_filled_details_not_overwritten(self):
        r = row(details="написала людина")
        out = {"details": "нове від моделі"}
        patch, _notes, _stale = plan_patch(r, out, only_dates=False, today=TODAY)
        self.assertNotIn("details", patch)


if __name__ == "__main__":
    unittest.main()
