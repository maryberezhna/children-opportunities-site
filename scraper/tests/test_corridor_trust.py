"""Маршрут запису: що вирішує зелений коридор (Марія, 23.09.2026).

Привід. У ранковому зведенні стояло «на сайт 0, притримано 3», і так було
щодня: у логах auto-review 21 із 23 жовтих трималися ЛИШЕ причиною «джерело
третього рівня довіри». Приплив у нас саме третього рівня — телеграм-канали
й discover-агент, — тож рівень джерела перебивав якість запису, а зелених не
бувало взагалі.

Правило тепер: підтверджене цитатою йде на сайт, хай яке джерело. Рівень
важить лише тоді, коли чогось бракує, — і тоді він видно в причині поруч із
тим, чого бракує. Чутлива тема лишається в людини завжди.
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
        "source": "Telegram (веб)", "evidence": dict(PAGE_QUOTES),
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

    def test_one_missing_quote_goes_to_human_with_both_facts(self):
        corridor, reason = auto_review.mechanical(
            row(evidence={k: v for k, v in PAGE_QUOTES.items() if k != "cost"}), trust_tier=3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("без цитати", reason)
        self.assertIn("вартість", reason)   # чого бракує
        self.assertIn(TIER3, reason)        # і звідки запис

    def test_missing_field_also_carries_the_tier(self):
        corridor, reason = auto_review.mechanical(row(cost_type=None), trust_tier=1)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("бракує", reason)
        self.assertIn(auto_review.TRUST_TIER_LABELS[1], reason)

    def test_unknown_tier_reads_as_third(self):
        _, reason = auto_review.mechanical(row(cost_type=None), trust_tier=7)
        self.assertIn(TIER3, reason)


class SensitiveStaysWithHuman(unittest.TestCase):
    """Запобіжник, який цитати не відчиняють: помилка тут б'є по найвразливіших."""

    def test_sensitive_type_with_every_quote_is_still_yellow(self):
        corridor, reason = auto_review.mechanical(
            row(opportunity_type="psychology"), trust_tier=1)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("чутлива категорія", reason)

    def test_sensitive_need_with_every_quote_is_still_yellow(self):
        corridor, reason = auto_review.mechanical(
            row(child_needs=["veteran_family"]), trust_tier=1)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("статусні діти", reason)


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

    def test_source_robot_cannot_read_is_named_without_the_tier(self):
        """МОН: цитати не буде ніколи, і причина має казати саме це."""
        corridor, reason = auto_review.mechanical(
            row(source="МОН України", evidence={}), trust_tier=1)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("не відкривається роботу", reason)


if __name__ == "__main__":
    unittest.main()
