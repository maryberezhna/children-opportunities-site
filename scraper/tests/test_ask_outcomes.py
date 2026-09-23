"""Відбір кандидатів для питання «чим закінчилось» (23.09.2026).

Правила Марії, які тримають ці тести:
  • питаємо через три дні після того, як можливість минула, — не раніше;
  • постійні й безстрокові не питаємо ніколи;
  • не більше одного питання на людину на день;
  • про одну можливість — рівно один раз, а якщо за тиждень минуло кілька,
    беремо найсвіжішу, решту глушимо, щоб не питати заднім числом.
"""
import pathlib
import sys
import types
import unittest
from datetime import date, datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import httpx  # noqa: F401
except ImportError:  # локально без залежностей скрапера
    sys.modules["httpx"] = types.ModuleType("httpx")

import ask_outcomes as ao  # noqa: E402

TODAY = date(2026, 9, 23)
NOW = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)
OPP = "11111111-2222-3333-4444-555555555555"
OPP2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
OPP3 = "99999999-8888-7777-6666-555555555555"


def opp(oid=OPP, **fields):
    base = {"id": oid, "title": "Конкурс", "slug": "konkurs", "deadline": None,
            "event_start_date": None, "event_end_date": None, "results_date": None,
            "timing_kind": None, "recurrence": None}
    base.update(fields)
    return base


class LatestDate(unittest.TestCase):
    def test_takes_the_latest_of_the_three(self):
        o = opp(deadline="2026-09-01", event_end_date="2026-09-10", results_date="2026-09-15")
        self.assertEqual(ao.last_date(o), (date(2026, 9, 15), "results"))

    def test_event_wins_when_it_is_later_than_the_deadline(self):
        o = opp(deadline="2026-09-01", event_start_date="2026-09-08", event_end_date="2026-09-09")
        self.assertEqual(ao.last_date(o), (date(2026, 9, 9), "event"))

    def test_deadline_alone_is_enough(self):
        self.assertEqual(ao.last_date(opp(deadline="2026-09-20")), (date(2026, 9, 20), "deadline"))

    def test_no_dates_at_all(self):
        self.assertIsNone(ao.last_date(opp()))


class ThreeDayRule(unittest.TestCase):
    def test_asks_only_after_three_days(self):
        # 20 вересня + 3 дні = 23-тє: сьогодні вже можна.
        self.assertEqual(ao.past_by(opp(deadline="2026-09-20"), TODAY),
                         (date(2026, 9, 20), "deadline"))

    def test_two_days_is_too_early(self):
        self.assertIsNone(ao.past_by(opp(deadline="2026-09-21"), TODAY))

    def test_future_is_not_past(self):
        self.assertIsNone(ao.past_by(opp(deadline="2026-10-20"), TODAY))

    def test_the_question_names_what_exactly_passed(self):
        text = ao.build_question("Конкурс «Дивосвіт»", date(2026, 9, 20), "deadline", TODAY)
        self.assertIn("подача закрилась 20 вересня", text)
        self.assertIn("Ви скористалися цією можливістю?", text)
        self.assertIn("<b>Конкурс «Дивосвіт»</b>", text)
        self.assertIn("подія пройшла", ao.build_question("X", date(2026, 9, 1), "event", TODAY))
        self.assertIn("результати оголосили", ao.build_question("X", date(2026, 9, 1), "results", TODAY))

    def test_title_is_escaped(self):
        self.assertIn("ISEF &lt;Ukraine&gt;",
                      ao.build_question("ISEF <Ukraine>", date(2026, 9, 1), "deadline", TODAY))

    def test_buttons_fit_telegram_limit(self):
        for row in ao.keyboard(OPP)["inline_keyboard"]:
            for button in row:
                self.assertLessEqual(len(button["callback_data"].encode()), 64)
        texts = [b["text"] for b in ao.keyboard(OPP)["inline_keyboard"][0]]
        self.assertEqual(texts, ["Так", "Ні"])


class OpenEnded(unittest.TestCase):
    def test_permanent_is_never_asked(self):
        o = opp(timing_kind="permanent", deadline="2026-01-01")
        self.assertTrue(ao.is_open_ended(o))
        self.assertIsNone(ao.past_by(o, TODAY))

    def test_ongoing_without_dates_is_never_asked(self):
        o = opp(recurrence="ongoing")
        self.assertTrue(ao.is_open_ended(o))
        self.assertIsNone(ao.past_by(o, TODAY))

    def test_ongoing_with_a_real_date_is_asked(self):
        # Безстроковий набір, але конкретна подія вже пройшла — питати можна.
        o = opp(recurrence="ongoing", event_end_date="2026-09-10")
        self.assertFalse(ao.is_open_ended(o))
        self.assertEqual(ao.past_by(o, TODAY), (date(2026, 9, 10), "event"))


class PickForSubscriber(unittest.TestCase):
    def setUp(self):
        self.due = ao.due_map([
            opp(OPP, deadline="2026-09-20"),
            opp(OPP2, deadline="2026-09-10"),
            opp(OPP3, timing_kind="permanent", deadline="2026-09-18"),
        ], TODAY)

    def test_permanent_never_reaches_the_shortlist(self):
        self.assertNotIn(OPP3, self.due)

    def test_freshest_is_asked_and_the_rest_are_silenced(self):
        ask, skip = ao.pick_for_subscriber({OPP, OPP2, OPP3}, [], self.due, NOW)
        self.assertEqual(ask[0], OPP)                 # 20 вересня свіжіше за 10-те
        self.assertEqual(skip, [OPP2])                # питати заднім числом не будемо
        self.assertNotIn(OPP3, skip)

    def test_never_asks_about_the_same_opportunity_twice(self):
        rows = [{"opportunity_id": OPP, "stage": "used",
                 "asked_at": "2026-09-01T10:00:00+00:00"}]
        ask, skip = ao.pick_for_subscriber({OPP, OPP2}, rows, self.due, NOW)
        self.assertEqual(ask[0], OPP2)
        self.assertEqual(skip, [])

    def test_one_question_per_person_per_day(self):
        rows = [{"opportunity_id": OPP3, "stage": "asked",
                 "asked_at": (NOW - timedelta(hours=5)).isoformat()}]
        self.assertEqual(ao.pick_for_subscriber({OPP, OPP2}, rows, self.due, NOW), (None, []))

    def test_yesterdays_question_does_not_block_today(self):
        rows = [{"opportunity_id": OPP3, "stage": "asked",
                 "asked_at": (NOW - timedelta(hours=30)).isoformat()}]
        ask, _ = ao.pick_for_subscriber({OPP, OPP2}, rows, self.due, NOW)
        self.assertEqual(ask[0], OPP)

    def test_nothing_marked_nothing_asked(self):
        self.assertEqual(ao.pick_for_subscriber(set(), [], self.due, NOW), (None, []))


class MarkedBy(unittest.TestCase):
    """Ключі різні: 👍 лежить за telegram_user_id, «Подаємося» — за uuid підписника."""

    def test_thumbs_up_and_applying_both_count(self):
        sub = {"id": "sub-1", "telegram_chat_id": "42"}
        rows = [{"opportunity_id": OPP, "stage": "applying"},
                {"opportunity_id": OPP3, "stage": "used"}]
        liked = {"42": {OPP2}}
        self.assertEqual(ao.marked_by(sub, rows, liked), {OPP, OPP2})

    def test_someone_elses_thumbs_up_is_not_ours(self):
        sub = {"id": "sub-1", "telegram_chat_id": "42"}
        self.assertEqual(ao.marked_by(sub, [], {"77": {OPP2}}), set())


if __name__ == "__main__":
    unittest.main()
