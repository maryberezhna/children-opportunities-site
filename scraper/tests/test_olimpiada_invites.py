"""Запрошення до тесту онлайн-олімпіади (scraper/olimpiada_invites.py).

Лист іде батькам після оплати й має сказати три речі точно: посилання на
тест, до якого часу його треба почати (72 години), і що внесок потім не
повертається. Числа в листі мусять збігатися з сайтом (lib/olimpiada.js).
"""
import pathlib
import re
import sys
import unittest
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import olimpiada_invites as inv  # noqa: E402

NOW = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)
ENTRY = {
    "id": "1", "token": "9cabd081887339b3edeadead8ffb15e2", "child_name": "Соломія Коваленко",
    "parent_email": "mama@example.com", "paid_at": "2026-10-05T10:00:00+00:00",
    "invite_sent_at": None, "finished_at": None,
}


class InvitesTest(unittest.TestCase):
    def test_numbers_match_site_config(self):
        js = (ROOT.parent / "lib" / "olimpiada.js").read_text(encoding="utf-8")
        def num(key):
            return int(re.search(rf"{key}:\s*(\d+)", js).group(1))
        self.assertEqual(inv.QUESTIONS, num("questionCount"))
        self.assertEqual(inv.MINUTES, num("minutes"))
        self.assertEqual(inv.ACCESS_HOURS, num("accessHours"))

    def test_needs_invite(self):
        self.assertTrue(inv.needs_invite(ENTRY, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "invite_sent_at": "2026-10-05T10:05:00+00:00"}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "finished_at": "2026-10-05T11:00:00+00:00"}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "paid_at": None}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "parent_email": ""}, NOW))
        # 72 години минули — запрошувати вже нікуди
        self.assertFalse(inv.needs_invite(ENTRY, datetime(2026, 10, 8, 10, 1, tzinfo=timezone.utc)))

    def test_message(self):
        subject, text, body = inv.build_message(ENTRY)
        link = "https://dityam.com.ua/olimpiada/test?t=9cabd081887339b3edeadead8ffb15e2"
        self.assertIn("Соломія Коваленко", subject)
        for part in (text, body):
            self.assertIn(link, part)
            self.assertIn("8 жовтня, 13:00", part)       # 72 години після оплати, за Києвом
            self.assertIn("внесок не повертається", part)
            self.assertIn("Dityam.com.ua", part)
        self.assertIn(f'href="{link}"', body)
        # після «Dityam+» тире не ставимо, а слова «розіграш» у листі бути не може
        self.assertNotIn("Dityam+ —", text)
        self.assertNotIn("розіграш", text.lower())

    def test_email_headers(self):
        msg = inv.make_email(ENTRY)
        self.assertEqual(msg["To"], "mama@example.com")
        self.assertIn("hellodityam.com.ua@gmail.com", msg["From"])
        self.assertEqual(msg["Reply-To"], "hellodityam.com.ua@gmail.com")


if __name__ == "__main__":
    unittest.main()
