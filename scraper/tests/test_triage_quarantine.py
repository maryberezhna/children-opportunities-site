"""Пакетний розбір карантину (23.09.2026).

Черга карантину росла швидше, ніж Марія встигала її розбирати (13 → 97 за два
дні), і машина почала розбирати її за правилами Марії. Тест тримає те, чим
така машина небезпечна: тихе відхилення справжньої можливості.

Головне тут — запобіжники вміють лише ОПУСКАТИ рішення до 'human'. Жоден із
них не перетворює сумнів на вердикт, а 'human' не чіпає в базі нічого.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from triage_quarantine import (ACCEPT, HUMAN, MIN_ACCEPT, MIN_REJECT,  # noqa: E402
                               REJECT, decide, touches_eighteen, verdict_patch)

# Сирий текст із карантину: слово про дітей є, цитата береться звідси.
CAMP = ("Літній мовний табір для школярів 10–15 років у Карпатах. "
        "Заявки приймаємо до 20 жовтня 2026 року, участь безкоштовна.")
# Те, через що Марія 21.09.2026 помилково видалила ESC: вік 18–30.
ESC = ("European Solidarity Corps: волонтерство за кордоном для молоді. "
       "Брати участь можуть охочі віком 18–30 років. Реєстрація відкрита цілий рік.")
# Грант для дорослих: діти лише умова участі.
TEACHERS = ("Грант на підвищення кваліфікації для вчителів початкових класів. "
            "Подати заявку може педагог зі стажем від трьох років.")


def answer(verdict, quote, confidence=0.95, reason="причина"):
    return {"verdict": verdict, "quote": quote, "confidence": confidence, "reason": reason}


class Decisions(unittest.TestCase):
    def test_accept_goes_back_to_the_queue(self):
        verdict, _, quote = decide(answer(ACCEPT, "Літній мовний табір для школярів"), CAMP)
        self.assertEqual(verdict, ACCEPT)
        patch = verdict_patch(verdict, "табір для школярів 10–15", quote)
        self.assertEqual(patch["status"], "pending")
        self.assertEqual(patch["attempts"], 0)
        self.assertEqual(patch["review_verdict"], "accept")
        self.assertIsNone(patch["last_error"])
        self.assertIn("цитата", patch["triage_note"])
        self.assertTrue(patch["reviewed_at"])

    def test_reject_closes_the_record(self):
        verdict, _, quote = decide(
            answer(REJECT, "Грант на підвищення кваліфікації для вчителів"), TEACHERS)
        self.assertEqual(verdict, REJECT)
        patch = verdict_patch(verdict, "грант для вчителів", quote)
        self.assertEqual(patch["status"], "rejected")
        self.assertEqual(patch["review_verdict"], "reject")
        # Сліди класифікатора не чіпаємо: за ними міряють, де він вагається.
        self.assertNotIn("reject_reason", patch)
        self.assertNotIn("confidence", patch)


class HumanChangesNothing(unittest.TestCase):
    def test_human_verdict_writes_nothing(self):
        self.assertIsNone(verdict_patch(HUMAN, "не зрозуміло", "цитата"))

    def test_model_says_human(self):
        verdict, _, _ = decide(answer(HUMAN, "Літній мовний табір"), CAMP)
        self.assertEqual(verdict, HUMAN)
        self.assertIsNone(verdict_patch(verdict, "", ""))

    def test_api_failure_never_decides(self):
        for broken in (None, {}, {"verdict": "reject"}, "щось не те"):
            with self.subTest(broken=broken):
                self.assertEqual(decide(broken, CAMP)[0], HUMAN)

    def test_quote_must_be_in_the_source_text(self):
        # Модель переказала своїми словами — це вже не доказ.
        verdict, reason, _ = decide(
            answer(REJECT, "зазвичай такі табори для дорослих"), CAMP)
        self.assertEqual(verdict, HUMAN)
        self.assertIn("цитати немає", reason)

    def test_unsure_model_is_not_a_verdict(self):
        self.assertEqual(
            decide(answer(ACCEPT, "Літній мовний табір", MIN_ACCEPT - 0.01), CAMP)[0], HUMAN)
        self.assertEqual(
            decide(answer(REJECT, "Грант на підвищення кваліфікації", MIN_REJECT - 0.01),
                   TEACHERS)[0], HUMAN)

    def test_accept_needs_a_word_about_children(self):
        text = "Дякуємо, що пройшли цей квіз! Ваші відповіді збережено."
        self.assertEqual(decide(answer(ACCEPT, "Дякуємо, що пройшли цей квіз"), text)[0], HUMAN)


class EighteenIsOurs(unittest.TestCase):
    """Пряма вимога Марії 21.09.2026: «з 18», «16–30», «18–30» — наше."""

    def test_eighteen_plus_is_never_rejected_by_the_machine(self):
        verdict, reason, _ = decide(
            answer(REJECT, "Брати участь можуть охочі віком 18–30 років", 0.99), ESC)
        self.assertEqual(verdict, HUMAN)
        self.assertIn("18", reason)

    def test_age_ranges_that_reach_eighteen(self):
        for text in ("охочі віком 18–30 років", "для молоді 16-30 років",
                     "беремо з 18 років", "програма для учасників 18+ років",
                     "Age: 18 to 30"):
            with self.subTest(text=text):
                self.assertTrue(touches_eighteen(text))

    def test_dates_and_hours_are_not_ages(self):
        for text in ("табір 16–30 вересня", "працюємо з 18 до 20 години",
                     "конкурс для дітей 7–17 років", "діти 21–30 місяців"):
            with self.subTest(text=text):
                self.assertFalse(touches_eighteen(text))

    def test_adults_only_still_get_rejected(self):
        # 21–30 — нижня межа вища за 18, запобіжник не спрацьовує.
        self.assertFalse(touches_eighteen("для учасників 21–30 років"))


if __name__ == "__main__":
    unittest.main()
