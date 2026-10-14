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
        self.assertEqual(inv.PRINT_PRICE, num("printPrice"))

    def test_needs_invite(self):
        self.assertTrue(inv.needs_invite(ENTRY, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "invite_sent_at": "2026-10-05T10:05:00+00:00"}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "finished_at": "2026-10-05T11:00:00+00:00"}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "paid_at": None}, NOW))
        self.assertFalse(inv.needs_invite({**ENTRY, "parent_email": ""}, NOW))
        # Безкоштовна заявка (з 08.10.2026) не згорає; стара платна — через 72 години.
        late = datetime(2026, 10, 8, 10, 1, tzinfo=timezone.utc)
        self.assertTrue(inv.needs_invite(ENTRY, late))
        self.assertFalse(inv.needs_invite({**ENTRY, "amount": 150}, late))

    def test_message(self):
        subject, text, body = inv.build_message(ENTRY)
        link = "https://dityam.com.ua/olimpiada/test?t=9cabd081887339b3edeadead8ffb15e2"
        self.assertIn("Соломія Коваленко", subject)
        for part in (text, body):
            self.assertIn(link, part)
            self.assertIn("Участь безкоштовна", part)
            self.assertNotIn("внесок", part)
            self.assertNotIn("після оплати", part)
            self.assertIn("Dityam.com.ua", part)
        self.assertIn(f'href="{link}"', body)
        for part in (text, body):
            self.assertIn("поштомат Нової пошти", part)
            self.assertIn(f"{inv.PRINT_PRICE} грн", part)
            self.assertIn("якщо Соломія Коваленко виграє, повідомимо вас окремим листом", part)
        # після «Dityam+» тире не ставимо, а слова «розіграш» у листі бути не може
        self.assertNotIn("Dityam+ —", text)
        self.assertNotIn("розіграш", text.lower())

    def test_diploma_message(self):
        entry = {**ENTRY, "finished_at": "2026-10-05T11:00:00+00:00", "score": 23, "max_score": 25}
        self.assertTrue(inv.needs_diploma(entry))
        self.assertFalse(inv.needs_diploma({**entry, "diploma_sent_at": "2026-10-05T11:05:00+00:00"}))
        self.assertFalse(inv.needs_diploma(ENTRY))   # тест ще не пройдено
        subject, text, body = inv.build_diploma_message(entry)
        self.assertIn("Диплом", subject)
        self.assertIn("23 з 25", text)
        self.assertIn("23 з 25", body)
        # Відкритого завдання немає — у конкурсі на приз не бере участі, обіцяти нічого.
        # Друк не оплачено — питаємо про Нову пошту з кнопкою на форму доставки.
        for part in (text, body):
            self.assertNotIn("виграє", part)
            self.assertIn("Бажаєте друкований диплом?", part)
            self.assertIn("https://dityam.com.ua/olimpiada/test?t=9cabd081887339b3edeadead8ffb15e2#dostavka", part)
            self.assertIn(f"{inv.PRINT_PRICE} грн", part)
        competing = {**entry, "open_answer": "Задача про трьох котів"}
        for part in inv.build_diploma_message(competing)[1:]:
            self.assertIn("якщо Соломія Коваленко виграє, повідомимо вас окремим листом", part)
        printed = {**competing, "print_paid_at": "2026-10-05T11:10:00+00:00",
                   "print_order": {"city": "Київ", "branch": "відділення 12"}}
        for part in inv.build_diploma_message(printed)[1:]:
            self.assertNotIn("Бажаєте друкований диплом?", part)
            self.assertNotIn("Вкажіть, куди його надіслати", part)
        # Участь разом із дипломом (249 грн): оплачено, адреси ще немає — просимо її.
        bundle = {**competing, "amount": 249, "print_paid_at": "2026-10-05T11:10:00+00:00"}
        for part in inv.build_diploma_message(bundle)[1:]:
            self.assertNotIn("Бажаєте друкований диплом?", part)
            self.assertIn("Вкажіть, куди його надіслати", part)
            self.assertIn("#dostavka", part)
        # Dityam+ після олімпіади — перший місяць за 1 грн (08.10.2026), у кожному листі.
        for part in (text, body):
            self.assertIn("Перший місяць — 1 грн замість 99 грн, далі 99 грн/міс", part)
            self.assertIn("https://t.me/DityamPlusBot?start=from_olimpiada", part)
            self.assertNotIn("Dityam+ —", part)
        # Без вкладення (11.10.2026): лише посилання на сторінку диплома.
        msg = inv.make_diploma_email(entry)
        parts = [p.get_content_type() for p in msg.walk()]
        self.assertNotIn("image/png", parts)
        self.assertIn("text/html", parts)
        self.assertNotIn("dyplom-olimpiada-dityam.png", msg.as_string())
        self.assertIn("Відкрити диплом", body)
        self.assertIn(f"/olimpiada/test?t={entry['token']}", text)

    def test_email_headers(self):
        msg = inv.make_email(ENTRY)
        self.assertEqual(msg["To"], "mama@example.com")
        self.assertIn("hellodityam.com.ua@gmail.com", msg["From"])
        self.assertEqual(msg["Reply-To"], "hellodityam.com.ua@gmail.com")


if __name__ == "__main__":
    unittest.main()


class FeedbackLetterTest(unittest.TestCase):
    """Лист через тиждень «розкажіть про ваш досвід» (Марія, 12.10.2026)."""
    NOW = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)

    def row(self, email, sent, **kw):
        base = {"id": email + sent, "parent_email": email, "child_name": "Олена", "finished_at": sent,
                "diploma_sent_at": sent, "feedback_sent_at": None, "wfp_last_status": "Free", "source": None}
        base.update(kw)
        return base

    def test_one_letter_per_address_after_seven_days(self):
        rows = [self.row("a@x.ua", "2026-10-09T10:00:00+00:00"),
                self.row("A@x.ua", "2026-10-10T10:00:00+00:00", child_name="Марк"),  # та сама адреса, друга дитина
                self.row("b@x.ua", "2026-10-18T10:00:00+00:00")]                     # ще не минуло 7 днів
        got = inv.feedback_targets(rows, now=self.NOW)
        self.assertEqual([r["parent_email"] for r in got], ["a@x.ua"])
        self.assertEqual(got[0]["child_names"], ["Олена", "Марк"])

    def test_skips_asked_tests_and_own(self):
        rows = [self.row("a@x.ua", "2026-10-09T10:00:00+00:00"),
                self.row("a@x.ua", "2026-10-09T11:00:00+00:00", feedback_sent_at="2026-10-16T10:00:00+00:00"),
                self.row("t@x.ua", "2026-10-09T10:00:00+00:00", wfp_last_status="Test"),
                self.row("c@x.ua", "2026-10-09T10:00:00+00:00", source="check"),
                self.row("maryberezhna@gmail.com", "2026-10-09T10:00:00+00:00")]
        self.assertEqual(inv.feedback_targets(rows, now=self.NOW), [])

    def test_personal_greeting(self):
        self.assertTrue(inv.feedback_greeting(["Олена Коваль"]).startswith("Олена Коваль тепер має диплом"))
        self.assertTrue(inv.feedback_greeting(["Олена", "Марк", "Олена"]).startswith("Олена і Марк тепер мають дипломи"))
        self.assertTrue(inv.feedback_greeting([]).startswith("Ваша дитина тепер має диплом"))

    def test_letter_asks_and_promises(self):
        subject, text, body = inv.build_feedback_message({"parent_email": "a@x.ua", "child_names": ["Олена"]})
        self.assertIn("Олена тепер має диплом", text)
        self.assertIn("Де ви зазвичай шукаєте", text)
        self.assertIn("Що в цьому найскладніше і чого не вистачає?", text)
        self.assertIn("Обіцяємо: ми дослухаємося.", text)
        self.assertIn("Пишу вам особисто", body)
        # Марія, 14.10.2026: нагадування про доставку диплома й олімпіаду з моди.
        self.assertIn("Не забудьте, що ви можете пройти нашу нову можливість — олімпіаду з моди.", text)
        _, t2, b2 = inv.build_feedback_message({"parent_email": "a@x.ua", "child_names": ["Олена"], "token": "abc123"})
        self.assertIn("Не забудьте, що ви можете замовити доставку диплома або пройти нашу нову можливість — олімпіаду з моди.", t2)
        self.assertIn("/olimpiada/test?t=abc123", b2)
        self.assertIn("#dostavka", b2)
        self.assertIn("/modnyi-kod?utm_source=email", b2)
        _, t3, _ = inv.build_feedback_message({"parent_email": "a@x.ua", "child_names": ["Олена"], "token": "abc123", "print_paid_at": "2026-10-10"})
        self.assertNotIn("доставку", t3)
        msg = inv.make_feedback_email({"parent_email": "a@x.ua", "child_names": ["Олена"]})
        self.assertIn("a@x.ua", msg["To"])
