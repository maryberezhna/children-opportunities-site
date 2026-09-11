"""Перевірка дат по живій сторінці: рішення мусить спиратись на цитату.

Тут стережеться саме те місце, де 11.09.2026 зламалась довіра: LLM
«визначила» вік і мітку, яких у тексті не було, і доросла програма з
простроченим набором опинилась першою на сторінці для дітей захисників.
Тому `decide()` нічого не пише в базу без дослівної цитати зі сторінки.
"""
import pathlib
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from recheck_dates import decide, _valid_date  # noqa: E402

TODAY = date.today()
TODAY_ISO = TODAY.isoformat()
SOON = (TODAY + timedelta(days=30)).isoformat()
PAST = (TODAY - timedelta(days=30)).isoformat()


def quote_for(iso):
    """Цитата, в якій ця дата справді стоїть.

    Правило «дата мусить бути в цитаті» перевіряє саме це, тож фікстура не
    може обійтись довільним реченням — інакше тест перевіряв би не те."""
    y, m, d = iso.split("-")
    return f"Прийом заявок триває до {d}.{m}.{y} включно"


QUOTE = quote_for(SOON)


def row(**over):
    base = {"id": 1, "title": "Конкурс", "opportunity_type": "competition",
            "admin_comment": None}
    base.update(over)
    return base


def out(**over):
    base = {"page_kind": "one_opportunity", "enrollment": "unknown",
            "evidence": QUOTE, "confidence": 0.9}
    base.update(over)
    # Цитата за замовчуванням підтверджує саме ту дату, яку віддали.
    if "evidence" not in over and base.get("deadline"):
        base["evidence"] = quote_for(base["deadline"])
    return base


class EvidenceIsMandatory(unittest.TestCase):
    def test_no_quote_no_write(self):
        patch, _ = decide(row(), out(evidence="", deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_too_short_quote_no_write(self):
        patch, _ = decide(row(), out(evidence="так", deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_low_confidence_no_write(self):
        patch, _ = decide(row(), out(confidence=0.3, deadline=SOON), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_quote_plus_date_writes(self):
        patch, why = decide(row(), out(deadline=SOON), TODAY_ISO)
        self.assertEqual(patch["deadline"], SOON)
        self.assertIn(QUOTE[:20], why)


class ClosingRules(unittest.TestCase):
    def test_page_says_closed(self):
        patch, why = decide(row(), out(enrollment="closed",
                                       evidence="Реєстрацію завершено"), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")
        self.assertIn("набір закрито", why)

    def test_past_deadline_closes(self):
        patch, why = decide(row(), out(deadline=PAST), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")
        self.assertEqual(patch["deadline"], PAST)
        self.assertIn("минув", why)

    def test_past_deadline_of_annual_stays(self):
        # Щорічний конкурс не гасне через торішній дедлайн — він оживе
        # наступного сезону, і сайт уже вміє це показувати.
        patch, _ = decide(row(), out(deadline=PAST, recurrence="annual"), TODAY_ISO)
        self.assertNotIn("status", patch)

    def test_past_deadline_of_annual_is_not_written(self):
        # Торішнє число на картці — саме те, що обурило Марію 11.09.2026.
        # Пишемо періодичність, а не прострочену дату.
        patch, _ = decide(row(), out(deadline=PAST, recurrence="annual"), TODAY_ISO)
        self.assertNotIn("deadline", patch)
        self.assertEqual(patch["recurrence"], "annual")

    def test_seasonal_type_gets_recheck_date(self):
        # Табір закривається чесно, але через ~11 місяців ttl_requeue
        # перечитає сторінку: нова зміна оживить запис.
        patch, _ = decide(row(opportunity_type="camp"),
                          out(enrollment="closed", evidence="Зміну завершено"),
                          TODAY_ISO)
        self.assertIn("recheck_at", patch)

    def test_non_seasonal_type_has_no_recheck(self):
        patch, _ = decide(row(opportunity_type="volunteer"),
                          out(enrollment="closed", evidence="Набір завершено"),
                          TODAY_ISO)
        self.assertNotIn("recheck_at", patch)


class PageKind(unittest.TestCase):
    """Половина записів без дати веде не на можливість, а на головну
    організації або на перелік програм (49 зі 127 станом на 11.09.2026).
    Дати там немає й бути не може — і це діагноз про сам запис, а не про дату."""

    def test_listing_writes_nothing(self):
        patch, why = decide(row(), out(page_kind="listing_or_org",
                                       deadline=SOON, enrollment="open"), TODAY_ISO)
        self.assertEqual(patch, {})
        self.assertIn("головна або перелік", why)

    def test_missing_page_writes_nothing(self):
        patch, why = decide(row(), out(page_kind="not_found",
                                       enrollment="closed"), TODAY_ISO)
        self.assertEqual(patch, {})
        self.assertIn("немає", why)


class DateMustBeInTheQuote(unittest.TestCase):
    """Найтонше місце всієї роботи. У першому прогоні 11.09.2026 модель
    віддала для FLEX дату 30.06.2027 із цитатою «Аплікаційну форму на
    програму FLEX 2026-2027 відкрито!» — числа там немає й близько. Так само
    зʼявились 19 вересня з «у вересні 2026-го» і 1 жовтня з цитати без жодної
    цифри. Тепер і день, і місяць мусять стояти в самій цитаті."""

    def test_year_alone_is_not_a_date(self):
        patch, _ = decide(row(), out(
            deadline="2027-06-30",
            evidence="Аплікаційну форму на програму FLEX 2026-2027 відкрито!"), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_month_alone_is_not_a_date(self):
        patch, _ = decide(row(), out(
            deadline="2026-09-19",
            evidence="У вересні 2026-го він повертається туди, де починався"), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_quote_without_digits_is_not_a_date(self):
        patch, _ = decide(row(), out(
            deadline="2026-10-01",
            evidence="Запрошуємо творчих дітей до участі у конкурсі малюнка"), TODAY_ISO)
        self.assertEqual(patch, {})

    def test_month_name_counts(self):
        patch, _ = decide(row(), out(
            deadline="2026-11-05",
            evidence="Application Deadline is November 5, 2026 at 8pm ET"), TODAY_ISO)
        self.assertEqual(patch["deadline"], "2026-11-05")

    def test_numeric_date_counts(self):
        patch, _ = decide(row(), out(
            deadline="2026-09-30",
            evidence="Табір триває 23.06.2026-30.09.2026 за розкладом"), TODAY_ISO)
        self.assertEqual(patch["deadline"], "2026-09-30")


class ClosedNeedsAClosingWord(unittest.TestCase):
    """Модель позначила закритою стипендіальну програму, яка щойно почалась,
    і навела цитатою розклад занять (11.09.2026). Тепер підстава для
    закриття мусить бути в самій цитаті."""

    def test_schedule_is_not_a_closure(self):
        patch, why = decide(row(), out(
            enrollment="closed",
            evidence="1 червня – 31 липня: Навчання та тестування учасників"), TODAY_ISO)
        self.assertEqual(patch, {})
        self.assertIn("не підтверджує", why)

    def test_closing_word_is(self):
        patch, _ = decide(row(), out(
            enrollment="closed",
            evidence="Прийом заявок на інкубацію наразі закрито"), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")

    def test_english_closing_word_is(self):
        patch, _ = decide(row(), out(
            enrollment="closed",
            evidence="The Award has now closed for entries"), TODAY_ISO)
        self.assertEqual(patch["status"], "closed")


class DateSanity(unittest.TestCase):
    def test_rejects_nonsense(self):
        for bad in (None, "", "квітень", "2026-13-45", 20261001):
            self.assertIsNone(_valid_date(bad), bad)

    def test_rejects_far_past_and_far_future(self):
        self.assertIsNone(_valid_date((TODAY - timedelta(days=500)).isoformat()))
        self.assertIsNone(_valid_date((TODAY + timedelta(days=2000)).isoformat()))

    def test_accepts_reasonable(self):
        self.assertEqual(_valid_date(f" {SOON} "), SOON)

    def test_recurrence_only_when_no_date(self):
        # Майбутня дата сильніша за «щорічність»: вона закриє запис вчасно.
        patch, _ = decide(row(), out(deadline=SOON, recurrence="annual"), TODAY_ISO)
        self.assertEqual(patch.get("deadline"), SOON)
        self.assertNotIn("recurrence", patch)

    def test_recurrence_alone_is_written(self):
        patch, why = decide(row(), out(recurrence="ongoing"), TODAY_ISO)
        self.assertEqual(patch["recurrence"], "ongoing")
        self.assertIn("постійна", why)


if __name__ == "__main__":
    unittest.main()
