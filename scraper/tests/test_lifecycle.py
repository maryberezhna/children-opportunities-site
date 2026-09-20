"""Планова перевірка: закриття за видом, повернення сезону, перший розклад.

Кейси з аудиту «Дедлайн, подія, сезон» (17.09.2026): Всеукраїнські олімпіади,
що закрились назавжди; конкурси з минулим дедлайном, які висіли активними як
«щорічні»; запис лише з датою початку, що не закривався ніколи.
"""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lifecycle import (  # noqa: E402
    MANUAL_MARK, decide_check, plan_bootstrap, plan_close, plan_unreadable,
)

TODAY = date(2026, 9, 17)


def row(**over):
    base = {"id": "r1", "title": "t", "status": "active", "opportunity_type": "competition",
            "timing_kind": None, "season_months": None, "deadline": None,
            "event_start_date": None, "event_end_date": None, "recheck_at": None,
            "verified_at": None, "admin_comment": None, "source_url": "https://x.org/p"}
    base.update(over)
    return base


class CloseByDate(unittest.TestCase):
    def test_one_time_closes_for_good(self):
        patch = plan_close(row(timing_kind="one_time", deadline="2026-09-10"), TODAY)
        self.assertEqual(patch["status"], "closed")
        self.assertIsNone(patch["recheck_at"])

    def test_periodic_closes_with_next_season_check(self):
        patch = plan_close(row(timing_kind="periodic", season_months=[9],
                               deadline="2026-09-15"), TODAY)
        self.assertEqual(patch["status"], "closed")
        self.assertEqual(patch["recheck_at"], "2027-08-01")

    def test_competition_with_past_deadline_no_longer_stays_active(self):
        # Раніше: дедлайн стирався, запис лишався «🔄 щорічно».
        patch = plan_close(row(deadline="2026-09-01"), TODAY)
        self.assertEqual(patch["status"], "closed")
        self.assertEqual(patch["recheck_at"], "2026-10-17")

    def test_future_or_closed_records_untouched(self):
        self.assertIsNone(plan_close(row(deadline="2026-10-01"), TODAY))
        self.assertIsNone(plan_close(row(status="closed", deadline="2026-09-01"), TODAY))
        self.assertIsNone(plan_close(row(status="draft", deadline="2026-09-01"), TODAY))


QUOTE_OPEN = "Реєстрація на І етап триває до 30 жовтня 2026 року."


class PlannedCheck(unittest.TestCase):
    def test_new_season_reopens_with_fresh_dates(self):
        r = row(status="closed", timing_kind="periodic", deadline="2025-10-30")
        out = {"state": "open", "deadline": "2026-10-30", "evidence": QUOTE_OPEN,
               "timing_kind": "periodic"}
        patch = decide_check(r, out, QUOTE_OPEN, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["deadline"], "2026-10-30")
        self.assertIsNone(patch["recheck_at"])

    def test_open_without_date_in_quote_is_not_reopened(self):
        r = row(status="closed", timing_kind="periodic")
        out = {"state": "open", "deadline": "2026-10-30",
               "evidence": "Реєстрація відкрита!", "timing_kind": "periodic"}
        patch = decide_check(r, out, "Реєстрація відкрита!", TODAY)
        self.assertNotIn("status", patch)
        self.assertEqual(patch["recheck_at"], "2026-10-01")

    def test_past_dates_are_never_written(self):
        r = row(status="closed", timing_kind="periodic")
        quote = "Олімпіада пройшла 12 травня 2026 року."
        out = {"state": "ended", "deadline": "2026-05-12", "evidence": quote,
               "timing_kind": "periodic"}
        patch = decide_check(r, out, quote, TODAY)
        self.assertNotIn("deadline", patch)
        self.assertEqual(patch["status"], "closed")

    def test_permanent_still_open_is_checked_again_in_four_months(self):
        r = row(timing_kind="permanent", opportunity_type="club")
        quote = "Запис до гуртка відкритий протягом усього року."
        patch = decide_check(r, {"state": "open", "evidence": quote,
                                 "timing_kind": "permanent"}, quote, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["recheck_at"], "2027-01-15")

    def test_gone_goes_to_moderator(self):
        patch = decide_check(row(), {"state": "gone", "evidence": "Проєкт завершено назавжди.",
                                     "timing_kind": "unknown"}, "Проєкт завершено назавжди.", TODAY)
        self.assertEqual(patch["status"], "closed")
        self.assertIsNone(patch["recheck_at"])
        self.assertIn("перевір", patch["admin_comment"])

    def test_kind_taken_only_with_real_quote(self):
        page = "VII Всеукраїнський турнір. Реєстрація триває до 30 жовтня 2026 року."
        out = {"state": "open", "deadline": "2026-10-30", "evidence": page,
               "timing_kind": "periodic", "kind_evidence": "VII Всеукраїнський турнір",
               "season_months": [10]}
        patch = decide_check(row(status="closed"), out, page, TODAY)
        self.assertEqual(patch["timing_kind"], "periodic")
        self.assertEqual(patch["season_months"], [10])
        out2 = dict(out, kind_evidence="турніри зазвичай щорічні")
        self.assertNotIn("timing_kind", decide_check(row(status="closed"), out2, page, TODAY))


class Unreadable(unittest.TestCase):
    """mon.gov.ua віддає серверам GitHub 403 — олімпіади не мали б як повернутись."""

    def test_first_failure_retries_in_two_weeks(self):
        patch = plan_unreadable(row(), "HTTP 403", TODAY)
        self.assertEqual(patch["recheck_at"], "2026-10-01")
        self.assertNotIn(MANUAL_MARK, patch["admin_comment"])

    def test_second_failure_asks_human_once(self):
        first = plan_unreadable(row(), "HTTP 403", TODAY)
        second = plan_unreadable(row(admin_comment=first["admin_comment"]), "HTTP 403", TODAY)
        self.assertIn(MANUAL_MARK, second["admin_comment"])
        self.assertEqual(second["recheck_at"], "2026-10-17")
        third = plan_unreadable(row(admin_comment=second["admin_comment"]), "HTTP 403", TODAY)
        self.assertNotIn("admin_comment", third)


class SeasonMonths(unittest.TestCase):
    def test_periodic_without_months_learns_them_from_quote(self):
        page = "The Bloomsday competition runs every year, entries close on 16 June."
        out = {"state": "ended", "evidence": page, "timing_kind": "periodic",
               "kind_evidence": "runs every year", "season_months": [5, 6]}
        patch = decide_check(row(status="closed", timing_kind="periodic"), out, page, TODAY)
        self.assertEqual(patch["season_months"], [5, 6])
        self.assertEqual(patch["recheck_at"], "2027-04-01")

class Bootstrap(unittest.TestCase):
    def test_closed_olympiad_without_season_is_checked_within_three_weeks(self):
        when = plan_bootstrap(row(status="closed", timing_kind="periodic",
                                  opportunity_type="olympiad"), TODAY)
        self.assertTrue("2026-09-18" <= when <= "2026-10-08")

    def test_permanent_spread_over_four_months(self):
        when = plan_bootstrap(row(timing_kind="permanent"), TODAY)
        self.assertTrue("2026-09-18" <= when <= "2027-01-15")

    def test_dated_active_waits_for_close_by_date(self):
        self.assertIsNone(plan_bootstrap(row(deadline="2026-10-01"), TODAY))

    def test_closed_one_time_is_left_alone(self):
        self.assertIsNone(plan_bootstrap(row(status="closed", timing_kind="one_time"), TODAY))

    def test_existing_recheck_is_kept(self):
        self.assertIsNone(plan_bootstrap(row(timing_kind="permanent",
                                             recheck_at="2026-12-01"), TODAY))


if __name__ == "__main__":
    unittest.main()


class InvariantEveryActiveHasAnEnding(unittest.TestCase):
    """20.09.2026, ревізія Марії: активний запис мусить мати або майбутню
    дату, якою закриється сам, або дату планової перевірки. Інакше він не
    протухне ніколи. Блок C у lifecycle тепер бігає щодня саме заради цього."""

    def test_dateless_active_always_gets_a_check(self):
        for kind in (None, "permanent", "periodic", "one_time"):
            with self.subTest(kind=kind):
                when = plan_bootstrap(row(timing_kind=kind), TODAY)
                self.assertIsNotNone(when, f"вид {kind} лишився без перевірки")
                self.assertGreater(when, TODAY.isoformat())

    def test_record_with_future_date_needs_no_check(self):
        # Такий закриється сам — блоком A, за датою.
        self.assertIsNone(plan_bootstrap(row(deadline="2026-12-01"), TODAY))

    def test_existing_check_is_not_overwritten(self):
        self.assertIsNone(plan_bootstrap(row(recheck_at="2026-10-01"), TODAY))
