"""Запис без першоджерела — у чернетку, а не на сайт.

09.10.2026 людина написала: «Хочу заповнити форму, але нема лінку для форми».
HERside прийшов зі скрапера Telegram як допис @tviyspace без посилання на
організатора, і база за замовчуванням зробила його active.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from normalizer import hold_without_source  # noqa: E402


class HoldWithoutSource(unittest.TestCase):
    def test_foreign_telegram_post_is_draft(self):
        data = hold_without_source({"source_url": "https://t.me/tviyspace/11946"})
        self.assertEqual(data["status"], "draft")
        self.assertIn("чужого Telegram", data["admin_comment"])

    def test_form_does_not_make_post_a_source(self):
        data = hold_without_source({"source_url": "https://t.me/Mozhlyvosti/10646",
                                    "apply_url": "https://forms.gle/x"})
        self.assertEqual(data["status"], "draft")

    def test_eurodesk_is_draft(self):
        data = hold_without_source(
            {"source_url": "https://programmes.eurodesk.eu/search/programme/1/eu"})
        self.assertEqual(data["status"], "draft")

    def test_organizer_page_untouched(self):
        data = hold_without_source({"source_url": "https://kosice2026.sk/herside"})
        self.assertNotIn("status", data)
        self.assertNotIn("admin_comment", data)

    def test_our_channel_untouched(self):
        data = hold_without_source({"source_url": "https://t.me/dityam_com_ua/512"})
        self.assertNotIn("status", data)

    def test_no_link_at_all_is_draft(self):
        data = hold_without_source({"source_url": "", "apply_url": None})
        self.assertEqual(data["status"], "draft")
        self.assertIn("немає посилання", data["admin_comment"])

    def test_keeps_earlier_note(self):
        data = hold_without_source({"source_url": "https://t.me/tviyspace/1",
                                    "admin_comment": "переписати українською"})
        self.assertTrue(data["admin_comment"].startswith("переписати українською · "))


if __name__ == "__main__":
    unittest.main()
