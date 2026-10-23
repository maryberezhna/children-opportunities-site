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
    MANUAL_MARK, PAGE_CHARS, UNREADABLE_MARK, decide_check, focus_text, pick_spare, plan_bootstrap,
    plan_close, plan_unreadable,
)

TODAY = date(2026, 9, 17)


def row(**over):
    base = {"id": "r1", "title": "t", "status": "active", "opportunity_type": "competition",
            "timing_kind": None, "season_months": None, "deadline": None,
            "event_start_date": None, "event_end_date": None, "recheck_at": None,
            "verified_at": None, "admin_comment": None, "source_url": "https://x.org/p",
            "timing_assumed": False}
    base.update(over)
    return base


class CloseByDate(unittest.TestCase):
    def test_every_kind_closes_then_page_is_read_once_in_two_days(self):
        # Sikorsky Challenge (07.10.2026): закрився 30.09 без жодної перевірки,
        # а подачу подовжили до 20.10. Тепер за 2 дні сторінку читають.
        for kind in ("one_time", "periodic", "permanent", None):
            patch = plan_close(row(timing_kind=kind, season_months=[9],
                                   deadline="2026-09-15"), TODAY)
            self.assertEqual(patch["status"], "closed")
            self.assertEqual(patch["recheck_at"], "2026-09-19")
            self.assertIn("чи не подовжили", patch["admin_comment"])

    def test_competition_with_past_deadline_no_longer_stays_active(self):
        # Раніше: дедлайн стирався, запис лишався «🔄 щорічно».
        patch = plan_close(row(deadline="2026-09-01"), TODAY)
        self.assertEqual(patch["status"], "closed")

    def test_future_or_closed_records_untouched(self):
        self.assertIsNone(plan_close(row(deadline="2026-10-01"), TODAY))
        self.assertIsNone(plan_close(row(status="closed", deadline="2026-09-01"), TODAY))
        self.assertIsNone(plan_close(row(status="draft", deadline="2026-09-01"), TODAY))


QUOTE_OPEN = "Реєстрація на І етап триває до 30 жовтня 2026 року."
QUOTE_EXTENDED = "Прийом заявок на Конкурс - до 20 ЖОВТНЯ 2026р."


class FocusText(unittest.TestCase):
    """Довга сторінка: модель мусить бачити дату, навіть якщо вона далеко."""

    def test_short_page_goes_whole(self):
        self.assertEqual(focus_text("коротко"), "коротко")

    def test_date_beyond_the_cut_reaches_the_model(self):
        # Sikorsky Challenge, 07.10.2026: «до 20 жовтня» на 9 960-му символі.
        filler = "1.1. Загальні засади конкурсу. 2.5. Пункт положення. " * 220
        page = filler + "Подання заявок ( 1 січня 2026 року - 20 жовтня 2026р . )." + " кінець" * 50
        out = focus_text(page)
        self.assertGreater(page.find("20 жовтня"), PAGE_CHARS)
        self.assertIn("20 жовтня 2026", out)
        self.assertLessEqual(len(out), PAGE_CHARS)

    def test_section_numbers_are_not_dates(self):
        page = "Вступ. " * 1500 + " 2.5. Пункт. 2.14. Пункт. " * 40
        self.assertEqual(focus_text(page), page[:PAGE_CHARS])


class SpareSlots(unittest.TestCase):
    def test_fills_free_slots_skipping_due_and_unreadable(self):
        rows = [{"id": "a"}, {"id": "b", "admin_comment": f"… {UNREADABLE_MARK} …"},
                {"id": "c", "admin_comment": MANUAL_MARK}, {"id": "d"}, {"id": "e"}]
        picked = pick_spare(rows, {"a"}, 2)
        self.assertEqual([r["id"] for r in picked], ["d", "e"])

    def test_no_free_slots_no_extra(self):
        self.assertEqual(pick_spare([{"id": "x"}], set(), 0), [])


class ConfirmAfterClose(unittest.TestCase):
    """Друга половина plan_close: що вирішує перечитування за 2 дні."""

    def just_closed_row(self, kind):
        return row(status="closed", timing_kind=kind, season_months=[9], deadline="2026-09-15")

    def test_extended_deadline_reopens(self):
        out = {"state": "open", "deadline": "2026-10-20", "evidence": QUOTE_EXTENDED}
        patch = decide_check(self.just_closed_row("one_time"), out, QUOTE_EXTENDED, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["deadline"], "2026-10-20")

    def test_foreign_post_does_not_reopen(self):
        # 09.10.2026: повернення на сайт — ті самі ворота, що в кнопок адмінки.
        out = {"state": "open", "deadline": "2026-10-20", "evidence": QUOTE_EXTENDED}
        r = dict(self.just_closed_row("one_time"), source_url="https://t.me/tviyspace/1")
        patch = decide_check(r, out, QUOTE_EXTENDED, TODAY)
        self.assertEqual(patch["status"], "draft")
        self.assertIn("Telegram", patch["admin_comment"])

    def test_unclear_falls_back_to_the_old_schedule(self):
        out = {"state": "unclear"}
        one = decide_check(self.just_closed_row("one_time"), out, "текст", TODAY)
        self.assertIsNone(one["recheck_at"])
        self.assertNotIn("status", one)
        per = decide_check(self.just_closed_row("periodic"), out, "текст", TODAY)
        self.assertEqual(per["recheck_at"], "2027-08-01")

    def test_open_without_a_new_date_goes_to_the_queue(self):
        # Вистави, заняття з вільним записом: закрились через одну дату, а
        # сторінка каже, що набір триває. Не мовчати й не вигадувати дату.
        r = row(status="closed", timing_kind="one_time", deadline="2026-08-20")
        patch = decide_check(r, {"state": "open", "evidence": "Запис триває"}, "Запис триває", TODAY)
        self.assertEqual(patch["status"], "draft")
        self.assertIsNone(patch["recheck_at"])
        self.assertIn("набір триває", patch["admin_comment"])

    def test_open_without_date_long_closed_is_not_queued(self):
        r = row(status="closed", timing_kind="periodic", deadline="2025-10-30")
        patch = decide_check(r, {"state": "open", "evidence": "x"}, "x", TODAY)
        self.assertNotIn("status", patch)

    def test_old_closed_record_still_retries_in_two_weeks(self):
        # Сезонна перевірка давно закритого запису — як і раніше, RETRY_DAYS.
        r = row(status="closed", timing_kind="periodic", deadline="2025-10-30")
        patch = decide_check(r, {"state": "unclear"}, "текст", TODAY)
        self.assertEqual(patch["recheck_at"], "2026-10-01")

PROVEN_BUT_DATE = {"age": "для учнів 8–11 класів", "cost": "участь безкоштовна",
                   "type": "Всеукраїнський конкурс", "place": "онлайн"}


class PlannedCheck(unittest.TestCase):
    def test_new_season_reopens_with_fresh_dates(self):
        r = row(status="closed", timing_kind="periodic", deadline="2025-10-30",
                evidence=PROVEN_BUT_DATE)
        out = {"state": "open", "deadline": "2026-10-30", "evidence": QUOTE_OPEN,
               "timing_kind": "periodic"}
        patch = decide_check(r, out, QUOTE_OPEN, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["deadline"], "2026-10-30")
        self.assertIsNone(patch["recheck_at"])
        # Цитата нового сезону стає доказом дати, решта цитат не губиться.
        self.assertEqual(patch["evidence"]["date"], QUOTE_OPEN)
        self.assertEqual(patch["evidence"]["age"], PROVEN_BUT_DATE["age"])

    def test_new_season_with_a_date_reopens_without_quotes(self):
        # 28.09.2026–03.10.2026 новий сезон без цитат на все йшов чернеткою до
        # людини. З 03.10.2026 тримає лише брак дати, а новий сезон її й приніс.
        r = row(status="closed", timing_kind="periodic", deadline="2025-10-30")
        out = {"state": "open", "deadline": "2026-10-30", "evidence": QUOTE_OPEN,
               "timing_kind": "periodic"}
        patch = decide_check(r, out, QUOTE_OPEN, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["deadline"], "2026-10-30")
        self.assertNotIn("у чергу людині", patch["admin_comment"])

    def test_live_record_stays_live_without_new_proof(self):
        # Уже на сайті — перевірка не стягує його в чернетку (модель від 22.09:
        # те, що живе, перевіряється по черзі, а не знімається).
        r = row(status="active", timing_kind="periodic", deadline="2026-09-20")
        out = {"state": "open", "deadline": "2026-10-30", "evidence": QUOTE_OPEN,
               "timing_kind": "periodic"}
        self.assertEqual(decide_check(r, out, QUOTE_OPEN, TODAY)["status"], "active")

    def test_dateless_annual_between_seasons_is_closed(self):
        # Euroquiz, 22.10.2026: активна щорічна без жодної дати, сторінка про
        # набір мовчить — «Щорічно — стежте за новим набором» біля кнопки подачі.
        r = row(status="active", timing_kind="periodic", season_months=[2])
        patch = decide_check(r, {"state": "unclear", "evidence": "Кожного дня три спроби"},
                             "Кожного дня три спроби", TODAY)
        self.assertEqual(patch["status"], "closed")
        self.assertEqual(patch["recheck_at"], "2027-01-01")
        self.assertIn("щорічна без дат", patch["admin_comment"])

    def test_dateless_annual_with_open_intake_stays(self):
        # «Набір на 2026-2027 навчальний рік» без дати — не закривати живе.
        r = row(status="active", timing_kind="periodic")
        patch = decide_check(r, {"state": "open", "evidence": "Набір відкрито"},
                             "Набір відкрито", TODAY)
        self.assertNotIn("status", patch)

    def test_dated_or_permanent_active_is_not_closed_as_between_seasons(self):
        dated = row(status="active", timing_kind="periodic", results_date="2026-12-01")
        perm = row(status="active", timing_kind="permanent")
        for r in (dated, perm):
            self.assertNotIn("status", decide_check(r, {"state": "unclear"}, "текст", TODAY))

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

    def test_permanent_still_open_is_checked_again_in_three_months(self):
        r = row(timing_kind="permanent", opportunity_type="club")
        quote = "Запис до гуртка відкритий протягом усього року."
        patch = decide_check(r, {"state": "open", "evidence": quote,
                                 "timing_kind": "permanent"}, quote, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["recheck_at"], "2026-12-16")

    def test_assumed_permanent_is_checked_again_in_a_month(self):
        # «Набір постійний» за замовчуванням — здогад, а не факт зі сторінки:
        # 610 гуртків станом на 20.09.2026 тримаються саме на ньому.
        r = row(timing_kind="permanent", opportunity_type="club", timing_assumed=True)
        quote = "Гурток робототехніки для дітей 10–16 років."
        patch = decide_check(r, {"state": "open", "evidence": quote}, quote, TODAY)
        self.assertEqual(patch["status"], "active")
        self.assertEqual(patch["recheck_at"], "2026-10-17")

    def test_quote_turns_assumption_into_fact(self):
        r = row(timing_kind="permanent", opportunity_type="club", timing_assumed=True)
        quote = "Запис до гуртка відкритий протягом усього року."
        patch = decide_check(r, {"state": "open", "evidence": quote,
                                 "timing_kind": "permanent",
                                 "kind_evidence": quote}, quote, TODAY)
        self.assertFalse(patch["timing_assumed"])
        self.assertEqual(patch["recheck_at"], "2026-12-16")

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

    def test_permanent_spread_over_three_months(self):
        when = plan_bootstrap(row(timing_kind="permanent"), TODAY)
        self.assertTrue("2026-09-18" <= when <= "2026-12-16")

    def test_assumed_permanent_spread_over_one_month(self):
        when = plan_bootstrap(row(timing_kind="permanent", timing_assumed=True), TODAY)
        self.assertTrue("2026-09-18" <= when <= "2026-10-17")

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


class NoFalseClose(unittest.TestCase):
    """21.09.2026: бізнес-програму з дедлайном 24.09 закрили 21.09 — «доказом»
    модель записала власний висновок «дедлайн уже минув»."""

    PAGE = ("Безкоштовна бізнес-програма. Дедлайн: 24 вересня 2026 року. "
            "Старт навчання 28 вересня.")

    def test_reasoning_instead_of_quote_does_not_close(self):
        r = row(deadline="2026-09-24", event_start_date="2026-09-28")
        out = {"state": "ended",
               "evidence": "Дедлайн: 24 вересня 2026 року. Сьогодні 2026-09-21, дедлайн уже минув."}
        patch = decide_check(r, out, self.PAGE, TODAY)
        self.assertNotIn("status", patch)
        self.assertIn("не закрито", patch["admin_comment"])

    def test_future_date_without_closing_words_does_not_close(self):
        r = row(deadline="2026-09-24")
        out = {"state": "ended", "evidence": "Дедлайн: 24 вересня 2026 року."}
        patch = decide_check(r, out, self.PAGE, TODAY)
        self.assertNotIn("status", patch)
        self.assertIn("майбутня дата", patch["admin_comment"])

    def test_real_closure_still_closes(self):
        page = "Реєстрацію завершено. Дякуємо всім учасникам!"
        r = row(deadline="2026-09-24")
        out = {"state": "ended", "evidence": "Реєстрацію завершено."}
        patch = decide_check(r, out, page, TODAY)
        self.assertEqual(patch["status"], "closed")


class AdaptiveRhythm(unittest.TestCase):
    """«Як гугл»: сторінка змінюється — перевіряємо частіше, ні — рідше
    (Марія, 21.09.2026). Модель не кличемо, лише коли постійний відкритий
    запис має дослівно той самий текст, що й минулого разу."""

    PAGE = "Гурток робототехніки. Запис відкритий протягом усього року."

    def setUp(self):
        from lifecycle import page_fingerprint
        self.fp = page_fingerprint(self.PAGE)

    def test_fingerprint_ignores_spacing_and_case_but_not_dates(self):
        from lifecycle import page_fingerprint
        self.assertEqual(page_fingerprint("  ГУРТОК   робототехніки.\nЗапис відкритий протягом усього року."),
                         page_fingerprint("гурток робототехніки. запис відкритий протягом усього року."))
        self.assertNotEqual(page_fingerprint("Подача до 1 жовтня"), page_fingerprint("Подача до 15 жовтня"))
        self.assertIsNone(page_fingerprint("   "))

    def test_only_permanent_open_with_same_text_skips_the_model(self):
        from lifecycle import unchanged_open
        ok = row(timing_kind="permanent", page_hash=self.fp)
        self.assertTrue(unchanged_open(ok, self.fp))
        self.assertFalse(unchanged_open(ok, "інший"))
        # Стан сезонного чи датованого запису залежить від сьогоднішньої дати.
        self.assertFalse(unchanged_open(row(timing_kind="periodic", page_hash=self.fp), self.fp))
        self.assertFalse(unchanged_open(row(timing_kind="permanent", status="closed",
                                            page_hash=self.fp), self.fp))
        self.assertFalse(unchanged_open(row(timing_kind="permanent", page_hash=None), None))

    def test_unchanged_page_is_checked_twice_as_rarely_up_to_three_months(self):
        # «До тижня найчастіше і раз в 3 місяці найдовше» (Марія, 21.09.2026).
        from lifecycle import plan_unchanged
        p = plan_unchanged(row(timing_kind="permanent", timing_assumed=True), TODAY)
        self.assertEqual((p["check_interval_days"], p["recheck_at"]), (60, "2026-11-16"))
        p = plan_unchanged(row(timing_kind="permanent", check_interval_days=60), TODAY)
        self.assertEqual((p["check_interval_days"], p["recheck_at"]), (90, "2026-12-16"))
        self.assertIn("content_checked_at", p)
        self.assertNotIn("status", p)

    def test_first_check_stores_fingerprint_and_starting_interval(self):
        r = row(timing_kind="permanent", opportunity_type="club", timing_assumed=True)
        patch = decide_check(r, {"state": "open", "evidence": "Запис відкритий"}, self.PAGE,
                             TODAY, self.fp)
        self.assertEqual(patch["page_hash"], self.fp)
        self.assertEqual((patch["check_interval_days"], patch["recheck_at"]), (30, "2026-10-17"))

    def test_changed_page_is_checked_twice_as_often_but_not_more_than_weekly(self):
        r = row(timing_kind="permanent", page_hash="старий", check_interval_days=90)
        patch = decide_check(r, {"state": "open", "evidence": "Запис відкритий"}, self.PAGE,
                             TODAY, self.fp)
        self.assertEqual(patch["check_interval_days"], 45)
        r = row(timing_kind="permanent", page_hash="старий", check_interval_days=10)
        patch = decide_check(r, {"state": "open", "evidence": "Запис відкритий"}, self.PAGE,
                             TODAY, self.fp)
        self.assertEqual(patch["check_interval_days"], 7)

    def test_any_other_verdict_forgets_the_fingerprint(self):
        r = row(timing_kind="permanent", page_hash=self.fp, check_interval_days=60)
        for out in ({"state": "unclear", "evidence": ""},
                    {"state": "gone", "evidence": "Гурток робототехніки."},
                    {"state": "ended", "evidence": "без цитати зі сторінки"}):
            patch = decide_check(r, out, self.PAGE, TODAY, self.fp)
            self.assertIsNone(patch["page_hash"], out)

    def test_without_fingerprint_nothing_about_it_is_written(self):
        # Старі виклики (і ручні скрипти) колонок відбитка не чіпають.
        r = row(timing_kind="permanent", opportunity_type="club")
        patch = decide_check(r, {"state": "open", "evidence": "Запис відкритий"}, self.PAGE, TODAY)
        self.assertNotIn("page_hash", patch)
        self.assertNotIn("check_interval_days", patch)
        self.assertEqual(patch["recheck_at"], "2026-12-16")


class EffectiveStateForPublisher(unittest.TestCase):
    """23.10.2026: відкриті можливості випадали з ранкового поста як «ended»."""

    PAGE = ("Competition open. Submission timeline August 3, 2026 Competition opens "
            "October 25, 2026 Competition closes November 9, 2026 Results announced")

    def test_rejected_ended_with_future_date_is_open(self):
        from lifecycle import effective_state
        row = {"status": "active", "deadline": "2026-10-25"}
        self.assertEqual(effective_state("ended", row, "October 25, 2026 Competition closes",
                                         self.PAGE, "2026-10-23"), "open")

    def test_ended_without_literal_quote_is_unclear(self):
        from lifecycle import effective_state
        row = {"status": "active", "deadline": "2026-10-25"}
        self.assertEqual(effective_state("ended", row, "Конкурс уже завершився", self.PAGE,
                                         "2026-10-23"), "unclear")

    def test_real_ended_stays_ended(self):
        from lifecycle import effective_state
        page = "Applications are closed. See you next year."
        row = {"status": "active", "deadline": "2026-10-25"}
        self.assertEqual(effective_state("ended", row, "Applications are closed", page,
                                         "2026-10-23"), "ended")
        self.assertEqual(effective_state("open", row, "", page, "2026-10-23"), "open")
