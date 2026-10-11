"""Маршрут запису: що вирішує зелений коридор (Марія, 23.09.2026).

Привід. У ранковому зведенні стояло «на сайт 0, притримано 3», і так було
щодня: у логах auto-review 21 із 23 жовтих трималися ЛИШЕ причиною «джерело
третього рівня довіри». Приплив у нас саме третього рівня — телеграм-канали
й discover-агент, — тож рівень джерела перебивав якість запису, а зелених не
бувало взагалі.

Правило 23.09.2026: підтверджене цитатою йде на сайт, хай яке джерело. Рівень
важить лише тоді, коли чогось бракує, — і тоді він видно в причині поруч із
тим, чого бракує.

03.10.2026 Марія скасувала обовʼязкові поля й цитати: тримає лише брак дати
в програми з датами, а чутливі теми публікуються самі, як усе інше.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auto_review  # noqa: E402

PAGE_QUOTES = {
    "age": "Для дітей 7–12 років",
    "date": "заявки приймаються до 15 червня 2027",
    "cost": "Участь безкоштовна",
    "type": "Літній табір «Веселка»",
    "place": "с. Славське, Львівська область",
}

TIER3 = auto_review.TRUST_TIER_LABELS[3]


def row(**over):
    data = {
        "title": "Літній табір «Веселка» у Карпатах",
        "summary": "Безкоштовний табір для дітей 7–12 років у Карпатах, заявки до 15 червня.",
        "age_from": 7, "age_to": 12, "deadline": "2027-06-15", "cost_type": "free",
        "opportunity_type": "camp", "format": "offline", "cities": ["Славське"],
        "child_needs": [], "link_status": "ok",
        "source": "Telegram (веб)", "source_url": "https://veselka.org.ua/tabir",
        "evidence": dict(PAGE_QUOTES),
    }
    data.update(over)
    return data


class TrustTierIsNoLongerAGate(unittest.TestCase):

    def test_third_tier_with_every_quote_passes_to_judge(self):
        """Головне. Телеграм-канал із цитатою на кожне поле — механіка пускає."""
        self.assertIsNone(auto_review.mechanical(row(), trust_tier=3))

    def test_tier_alone_holds_nothing(self):
        """Той самий запис із будь-якого рівня — те саме рішення."""
        for tier in (1, 2, 3, None):
            with self.subTest(tier=tier):
                self.assertIsNone(auto_review.mechanical(row(), trust_tier=tier))

    def test_missing_quote_no_longer_holds(self):
        """З 03.10.2026 брак цитати — не ворота: запис іде до судді."""
        self.assertIsNone(auto_review.mechanical(
            row(evidence={k: v for k, v in PAGE_QUOTES.items() if k != "cost"}), trust_tier=3))
        self.assertIsNone(auto_review.mechanical(row(evidence={}), trust_tier=3))

    def test_empty_cost_place_no_longer_hold(self):
        self.assertIsNone(auto_review.mechanical(
            row(cost_type=None, format=None, cities=[]), trust_tier=3))

    def test_empty_age_holds_again(self):
        # Вік — фільтр сайту (Марія, 09.10.2026): без нього запис — до людини.
        corridor, reason = auto_review.mechanical(row(age_from=None, age_to=None), trust_tier=3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("віку", reason)

    def test_missing_date_carries_the_tier(self):
        corridor, reason = auto_review.mechanical(row(deadline=None), trust_tier=1)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("бракує", reason)
        self.assertIn("дата", reason)
        self.assertIn(auto_review.TRUST_TIER_LABELS[1], reason)

    def test_unknown_tier_reads_as_third(self):
        _, reason = auto_review.mechanical(row(deadline=None), trust_tier=7)
        self.assertIn(TIER3, reason)


class SensitiveGoesThroughLikeEverythingElse(unittest.TestCase):
    """До 03.10.2026 чутлива тема лишалась у людини завжди. Марія того дня:
    «публікувати самим» — механіка її більше не тримає."""

    def test_sensitive_type_passes_to_judge(self):
        self.assertIsNone(auto_review.mechanical(row(opportunity_type="psychology"), trust_tier=1))

    def test_sensitive_need_passes_to_judge(self):
        self.assertIsNone(auto_review.mechanical(row(child_needs=["veteran_family"]), trust_tier=1))


class ThreeChecksStillGate(unittest.TestCase):
    """Зелений — це цитати І три перевірки, а не самі цитати."""

    def test_dead_link_is_red_whatever_the_quotes(self):
        corridor, _ = auto_review.mechanical(row(link_status="404"), trust_tier=1)
        self.assertEqual(corridor, auto_review.RED)

    def test_past_date_is_red(self):
        corridor, _ = auto_review.mechanical(row(deadline="2020-01-01"), trust_tier=1)
        self.assertEqual(corridor, auto_review.RED)

    def test_transliteration_is_not_ukrainian(self):
        """Реальний випадок із черги 23.09.2026: Giochi d'Autunno — єдиний запис
        з усіма пʼятьма цитатами, але опис транслітом («Matematychnyy
        konkurs-hra…»). Цитати його відчиняють, перевірка «українською» — ні."""
        corridor, reason = auto_review.mechanical(row(
            summary="Matematychnyy konkurs-hra dlya shkolyariv Italiyi. Uczestnyky "
                    "rozviazuyut matematychni zavdannya protyahom 90 khvylyn."), trust_tier=3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("не українською", reason)
        self.assertIn(TIER3, reason)

    def test_source_robot_cannot_read_no_longer_waits_for_a_quote(self):
        """МОН: цитати не буде ніколи — з 03.10.2026 вона й не потрібна."""
        self.assertIsNone(auto_review.mechanical(
            row(source="МОН України", evidence={}), trust_tier=1))


if __name__ == "__main__":
    unittest.main()


class ForeignTelegramOnlyStaysWithHuman(unittest.TestCase):
    """Марія, 27.09.2026: чужі Telegram-канали ніколи не показуємо."""

    def test_only_foreign_post_is_yellow(self):
        corridor, reason = auto_review.mechanical(
            row(source_url="https://t.me/Mozhlyvosti/10521", apply_url=None), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("чужого Telegram", reason)

    def test_foreign_post_with_a_form_is_still_yellow(self):
        # До 04.10.2026 форма подачі звільняла допис від цього правила. Але
        # форма — не першоджерело, і ворота адмінки такий запис не пускали.
        # Після 03.10.2026 (цитати не ворота) суддя пропустив би «Впливові»
        # і грант із @grants_ukraine — саме з формою.
        corridor, reason = auto_review.mechanical(
            row(source_url="https://t.me/tviyspace/11797",
                apply_url="https://forms.gle/1uvoZqQJCMc7pztHA"), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("чужого Telegram", reason)

    def test_eurodesk_catalog_is_yellow(self):
        corridor, reason = auto_review.mechanical(
            row(source_url="https://programmes.eurodesk.eu/search/program/abc"), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("Eurodesk", reason)

    def test_same_answer_as_the_admin_gate(self):
        # Ворота адмінки (lib/source-rules.js) і коридор кажуть те саме.
        from first_source import is_catalog, is_foreign_telegram
        self.assertTrue(is_foreign_telegram("https://t.me/tviyspace/1"))
        self.assertFalse(is_foreign_telegram("https://t.me/dityam_com_ua/512"))
        self.assertTrue(is_catalog("https://programmes.eurodesk.eu/x"))
        self.assertFalse(is_catalog("https://example.org/eurodesk.eu-guide"))

    def test_our_channel_is_fine(self):
        verdict = auto_review.mechanical(
            row(source_url="https://t.me/dityam_com_ua/512", apply_url=None), 3)
        self.assertTrue(verdict is None or "чужого Telegram" not in verdict[1])


class NoLinkNoPublish(unittest.TestCase):
    """Марія, 09.10.2026: посилання обовʼязкове «як божий день»."""

    def test_empty_source_is_yellow(self):
        corridor, reason = auto_review.mechanical(row(source_url=None, apply_url=None), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("немає посилання", reason)

    def test_form_alone_is_a_link(self):
        self.assertIsNone(auto_review.mechanical(
            row(source_url=None, apply_url="https://forms.gle/x"), 3))


class PlaceholdersAndParkedStayWithHuman(unittest.TestCase):
    """Марія, 09.10.2026: «так» — заглушки й відкладене суддя не публікує."""

    def test_age_placeholder_without_quote_holds(self):
        ev = {k: v for k, v in PAGE_QUOTES.items() if k != "age"}
        corridor, reason = auto_review.mechanical(row(age_from=0, age_to=18, evidence=ev), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("0–18", reason)

    def test_0_18_with_quote_still_holds_unless_payment(self):
        # Марія, 11.10.2026: «можливостей 0–18 не буває, виняток — тільки виплати».
        ev = dict(PAGE_QUOTES, age="для дітей до 18 років")
        corridor, reason = auto_review.mechanical(row(age_from=0, age_to=18, evidence=ev), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("0–18", reason)
        self.assertIsNone(auto_review.mechanical(
            row(age_from=0, age_to=18, evidence=ev, opportunity_type="allowance"), 3))

    def test_type_placeholder_holds(self):
        ev = {k: v for k, v in PAGE_QUOTES.items() if k != "type"}
        corridor, reason = auto_review.mechanical(
            row(opportunity_type="course", deadline=None, evidence=ev), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("заглушка «курс»", reason)

    def test_parked_drafts_hold(self):
        for comment in ("💡 пропозиція з форми на сайті · тип і вік ще не визначено",
                        "додано вручну через add-draft",
                        "auto: схоже, учасник — дорослий (батьки, жінки, підприємці)",
                        "lifecycle 2026-10-08: після закриття сторінка каже, що набір триває, "
                        "а нової дати немає — перевір: «…»"):
            corridor, _ = auto_review.mechanical(row(admin_comment=comment), 3)
            self.assertEqual(corridor, auto_review.YELLOW, comment)

    def test_unpublished_holds(self):
        corridor, reason = auto_review.mechanical(row(_unpublished=True), 3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("знято з сайту", reason)
