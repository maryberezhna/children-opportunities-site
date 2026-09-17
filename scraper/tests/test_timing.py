"""Правила виду за часом — рішення Марії 17.09.2026.

Кейси — з живої бази того дня: 598 гуртків з «постійним» набором, проставленим
за типом; фраза «Набір постійний, дедлайну немає», яку дописує сам скрапер;
платформи з вільним записом; щорічні олімпіади.
"""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from timing import (  # noqa: E402
    accept_model_kind, clean_kind, clean_months, clean_text, evidence_in_text,
    from_injecting_source, is_expired, months_from_dates, next_season_check,
    recheck_after_close, recurrence_from_text, rule_kind, season_start_month,
    spread_date,
)


def row(**over):
    base = {"title": "t", "opportunity_type": "course", "source": "інше",
            "summary": "", "details": None, "deadline": None,
            "event_start_date": None, "event_end_date": None,
            "recurrence": None, "admin_comment": None}
    base.update(over)
    return base


class Rules(unittest.TestCase):
    def test_platform_is_permanent(self):
        kind, _m, why = rule_kind(row(source="Prometheus"))
        self.assertEqual(kind, "permanent")
        self.assertIn("платформа", why)

    def test_silent_club_is_permanent_with_flag(self):
        # Рішення Марії: текст мовчить про набір → постійний, але з позначкою.
        kind, _m, why = rule_kind(row(opportunity_type="club",
                                      summary="Гурток вокалу для дітей 7–12 років."))
        self.assertEqual(kind, "permanent")
        self.assertIn("перевірити", why)

    def test_club_with_september_enrollment_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="club",
                                        summary="Набір у студію — у вересні.")))

    def test_aid_without_dates_is_permanent(self):
        kind, _m, _w = rule_kind(row(opportunity_type="allowance"))
        self.assertEqual(kind, "permanent")

    def test_aid_with_deadline_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="allowance", deadline="2026-12-31")))

    def test_annual_from_text_is_periodic_with_months(self):
        kind, months, _w = rule_kind(row(opportunity_type="olympiad", recurrence="annual",
                                         deadline="2026-10-30"))
        self.assertEqual(kind, "periodic")
        self.assertEqual(months, [10])

    def test_type_stamped_recurrence_is_not_trusted(self):
        stamped = row(recurrence="ongoing",
                      admin_comment="auto: 11.09.2026 проставлено ongoing за типом")
        self.assertIsNone(recurrence_from_text(stamped))
        self.assertIsNone(rule_kind(stamped))  # курс → вирішує модель, а не штамп

    def test_competition_goes_to_model(self):
        self.assertIsNone(rule_kind(row(opportunity_type="competition")))


class Cleaning(unittest.TestCase):
    def test_scraper_phrase_is_removed(self):
        text = clean_text("Гурток малювання. Набір постійний, дедлайну немає.", None)
        self.assertNotIn("постійний", text)
        self.assertIn("Гурток малювання", text)

    def test_injected_phrase_does_not_count_as_season(self):
        # Фраза скрапера не робить гурток «сезонним» і не відправляє його моделі.
        kind, _m, _w = rule_kind(row(opportunity_type="club",
                                     summary="Шахи. Набір постійний, дедлайну немає."))
        self.assertEqual(kind, "permanent")

    def test_months(self):
        self.assertEqual(months_from_dates(row(deadline="2026-10-01",
                                               event_start_date="2026-11-06",
                                               event_end_date="2026-11-08")), [10, 11])
        self.assertEqual(clean_months([11, "3", 3, 13, None]), [3, 11])
        self.assertIsNone(clean_months([]))
        self.assertIsNone(clean_months("жовтень"))

    def test_kind(self):
        self.assertEqual(clean_kind("periodic"), "periodic")
        self.assertIsNone(clean_kind("annual"))
        self.assertIsNone(clean_kind("unknown"))



class ModelAnswers(unittest.TestCase):
    """Кейси першого сухого прогону 17.09.2026, які не можна було записати."""

    def test_reasoning_is_not_evidence(self):
        text = "Всеукраїнська олімпіада зі штучного інтелекту UOAI 2026 для учнів 8–11 класів."
        self.assertFalse(evidence_in_text("олімпіада як формат зазвичай щорічна", text))

    def test_real_quote_is_evidence(self):
        text = "Курси англійської мови. Групи стартують у вересні, заняття двічі на тиждень."
        self.assertTrue(evidence_in_text("«Групи стартують у вересні»", text))

    def test_record_dates_are_evidence(self):
        self.assertTrue(evidence_in_text("дати в записі: заявки до 2026-09-19", ""))

    def test_periodic_needs_repeat_signal(self):
        text = "Програма для учнів 8–9 класів, заняття з вересня по грудень."
        self.assertFalse(accept_model_kind(row(opportunity_type="course"), "periodic",
                                           "заняття з вересня по грудень", text))
        text2 = "VII Всеукраїнський Турнір Астрономічних Боїв. Реєстрація до 3 серпня."
        self.assertTrue(accept_model_kind(row(opportunity_type="competition"), "periodic",
                                          "VII Всеукраїнський Турнір", text2))

    def test_one_time_rejected_when_text_says_yearly(self):
        text = "Щорічний конкурс есе. Заявки до 30 листопада 2026."
        self.assertFalse(accept_model_kind(row(opportunity_type="competition"), "one_time",
                                           "дати в записі: заявки до 2026-11-30", text))

    def test_permanent_needs_quote_not_dates(self):
        self.assertFalse(accept_model_kind(row(), "permanent", "дати в записі: немає", ""))

    def test_scraper_permanent_claim_is_dropped_for_its_sources(self):
        r = row(source="Гурток (gurtok.org)")
        self.assertTrue(from_injecting_source(r))
        text = clean_text("Літні мовні курси польської. Набір постійний, умови уточнюються.",
                          drop_permanent_claims=True)
        self.assertNotIn("постійн", text)
        self.assertIn("Літні мовні курси", text)

    def test_olympiad_is_periodic_by_definition(self):
        kind, _m, why = rule_kind(row(opportunity_type="olympiad"))
        self.assertEqual(kind, "periodic")
        self.assertIn("визначенням", why)


TODAY = date(2026, 9, 17)


class Seasons(unittest.TestCase):
    """Коли дивитись на програму знову (планова перевірка, 17.09.2026)."""

    def test_school_year_starts_in_september(self):
        self.assertEqual(season_start_month([9, 10, 11, 12, 1, 2, 3, 4, 5]), 9)
        self.assertIsNone(season_start_month(list(range(1, 13))))

    def test_upcoming_season_is_checked_soon_not_next_year(self):
        # Олімпіада з сезоном у жовтні 17 вересня — дивимось уже за кілька днів.
        self.assertEqual(next_season_check([10], [], TODAY), date(2026, 9, 20))

    def test_just_ended_season_waits_for_next_cycle(self):
        self.assertEqual(next_season_check([10], [], TODAY, skip_current=True), date(2027, 9, 1))
        self.assertEqual(next_season_check([9, 10, 11, 12, 1, 2, 3, 4, 5], [], TODAY,
                                           skip_current=True), date(2027, 8, 1))

    def test_later_season_checks_month_before(self):
        self.assertEqual(next_season_check([1], [], TODAY), date(2026, 12, 1))
        self.assertEqual(next_season_check([3], [], TODAY), date(2027, 2, 1))

    def test_without_months_uses_last_known_date(self):
        # Bloomsday: дедлайн 16 червня → наступна перевірка у квітні.
        self.assertEqual(next_season_check(None, ["2026-06-16"], TODAY), date(2027, 4, 17))
        self.assertEqual(next_season_check(None, [], TODAY), date(2026, 10, 17))

    def test_after_close_by_kind(self):
        self.assertIsNone(recheck_after_close("one_time", None, [], TODAY))
        self.assertEqual(recheck_after_close("periodic", [10], [], TODAY), date(2027, 9, 1))
        self.assertEqual(recheck_after_close("permanent", None, [], TODAY), date(2026, 9, 24))
        self.assertEqual(recheck_after_close(None, None, [], TODAY), date(2026, 10, 17))

    def test_expiry(self):
        self.assertTrue(is_expired({"deadline": "2026-09-16"}, TODAY))
        self.assertFalse(is_expired({"deadline": "2026-09-17"}, TODAY))
        # Табір, що триває, не закривається через минулий початок.
        self.assertFalse(is_expired({"event_start_date": "2026-09-01",
                                     "event_end_date": "2026-09-30"}, TODAY))
        # Лише дата початку — раніше такий запис не закривався ніколи.
        self.assertTrue(is_expired({"event_start_date": "2026-09-01"}, TODAY))
        # Лише дата розіграшу — закривається після неї.
        self.assertTrue(is_expired({"results_date": "2026-09-16"}, TODAY))
        self.assertFalse(is_expired({"results_date": "2026-09-30"}, TODAY))
        self.assertFalse(is_expired({"deadline": "2026-10-01", "results_date": "2026-09-01"}, TODAY))

    def test_spread_is_stable_and_in_range(self):
        d = spread_date("abc", TODAY, 30)
        self.assertEqual(d, spread_date("abc", TODAY, 30))
        self.assertTrue(date(2026, 9, 18) <= d <= date(2026, 10, 17))

if __name__ == "__main__":
    unittest.main()
