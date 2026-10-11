"""Стаття — не можливість (Марія, 11.10.2026, «Школа юного дипломата»).

Сама публікується лише сторінка, з якої видно, як потрапити; звіт про подію
й зламана розмітка моделі — ні.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auto_review  # noqa: E402
from page_signals import action_quote, broken_markup, report_reason  # noqa: E402

# Дослівно зі сторінки КМАН, з якої 08.10.2026 сам опублікувався запис.
KMAN_URL = "https://kman.kyiv.ua/ua/novyny/Trivae-kurs-Shkola-unoho-diplomata"
KMAN = ("Триває курс «Школа юного дипломата» для вихованців студії «ВундерМАНи» під "
        "керівництвом спікерки циклу Вероніки Василівни Чекалюк. Наші юні учасники "
        "продовжують опановувати мистецтво спілкування, міжнародної комунікації та м'якої "
        "сили, занурившись у світ дипломатії. Ось як проходили зустрічі: Розпочали з "
        "базового, але ключового поняття: дипломат — це людина, яка допомагає країнам "
        "домовлятися. Дякуємо всім учасникам за активність, мудрі думки та чудову "
        "атмосферу! До наступних зустрічей щосереди. Версія для друку Опубліковано: "
        "06 Жовтня 2026 E-mail: kman@kyivcity.gov.ua ; Телефон приймальні: (044) 298-47-55")

# Оголошення МАН теж новина — але з подачею.
MAN_NEWS_URL = "https://man.gov.ua/news/startuye-konkurs-ese"
MAN_NEWS = ("Стартує Всеукраїнський конкурс есе для учнів 13–18 років. Щоб узяти участь, "
            "зареєструйтеся та надішліть мотиваційний лист до 10 жовтня.")


class Report(unittest.TestCase):
    def test_kman_report_is_caught(self):
        reason = report_reason(KMAN_URL, KMAN)
        self.assertIn("звіт", reason)

    def test_announcement_on_a_news_url_is_not_a_report(self):
        self.assertEqual(report_reason(MAN_NEWS_URL, MAN_NEWS), "")

    def test_one_report_word_in_an_announcement_is_not_enough(self):
        # Klitschko Foundation: анонс реєстрації згадує, що минулий заїзд «відбувся».
        text = "Минулий заїзд відбувся у серпні. Відкриваємо реєстрацію на два нові заїзди."
        self.assertEqual(report_reason("https://klitschkofoundation.org/news/school", text), "")

    def test_report_words_on_a_program_page_are_not_enough(self):
        # Положення конкурсу: «підсумки конкурсу» — про майбутнє, і адреса не новина.
        text = "Підсумки конкурсу оголошують 20 грудня. Заявки до 1 грудня."
        self.assertEqual(report_reason("https://example.org/konkurs/polozhennia", text), "")


class Action(unittest.TestCase):
    def test_kman_report_has_no_action(self):
        # Пошта й телефон приймальні в підвалі — не контакт для запису.
        self.assertIsNone(action_quote(KMAN))

    def test_registration_words_count(self):
        self.assertIsNotNone(action_quote(MAN_NEWS))
        self.assertIsNotNone(action_quote("Набір триває до 20 вересня."))
        self.assertIsNotNone(action_quote("Подати заявку можна до 1 листопада."))

    def test_apply_url_counts(self):
        self.assertIsNotNone(action_quote("", "https://forms.gle/abc"))

    def test_form_link_counts(self):
        self.assertIsNotNone(action_quote("Деталі тут https://docs.google.com/forms/d/e/1/viewform"))

    def test_contact_near_participation_counts(self):
        text = "Для участі пишіть на studio@example.org або телефонуйте +380 67 123 45 67."
        self.assertIsNotNone(action_quote(text))

    def test_club_with_price_counts(self):
        # Осередок у Лейпцигу: запис — у центрі, на сторінці ціна й місця.
        self.assertIsNotNone(action_quote("Вартість на місяць — 30,00 € Макс. кількість учасників 8"))

    def test_foreign_pages(self):
        self.assertIsNotNone(action_quote("Applications are open until 1 March."))
        self.assertIsNotNone(action_quote("Zgłoszenia przyjmujemy do 30 listopada."))
        self.assertIsNotNone(action_quote("Anmeldung bis zum 15. Mai."))


class BrokenMarkup(unittest.TestCase):
    def test_tool_call_leak(self):
        # Дослівно summary «Школи юного дипломата».
        leaked = ("Заняття проходять щосереди і включають практичні завдання.</summary>\n"
                  '<parameter name="age_from">7')
        self.assertTrue(broken_markup(leaked))

    def test_normal_text(self):
        self.assertFalse(broken_markup("Табір для дітей 7–12 років <3", None, "Вік: 7–12"))

    def test_mechanical_sends_it_to_the_bin(self):
        row = {"title": "Школа юного дипломата", "summary": 'Курс.</summary><parameter name="age_from">7',
               "link_status": "ok"}
        corridor, reason = auto_review.mechanical(row)
        self.assertEqual(corridor, auto_review.RED)
        self.assertIn("розмітка", reason)


class Review(unittest.TestCase):
    """Сторінка перед суддею: без дії чи зі звітом — у чергу людині, суддю не питаємо."""

    def setUp(self):
        self._fetch = auto_review.FETCH

    def tearDown(self):
        auto_review.FETCH = self._fetch

    def row(self, **over):
        data = {
            "id": "opp-1", "slug": "shkola", "title": "Школа юного дипломата для школярів",
            "summary": "Курс для дітей 7–17 років: спілкування, міжнародна комунікація, дипломатія, щосереди.",
            "age_from": 7, "age_to": 17, "opportunity_type": "course", "timing_kind": "ongoing",
            "link_status": "ok", "status": "draft", "source": "КМАН", "source_url": KMAN_URL,
            "evidence": {"age": "7–17", "type": "Курс"},
        }
        data.update(over)
        return data

    def judge_never_called(self):
        class Boom:
            class messages:  # noqa: N801
                @staticmethod
                def create(**kw):
                    raise AssertionError("суддю не мали питати")
        return Boom()

    def test_kman_report_stays_a_draft(self):
        auto_review.FETCH = lambda url: (KMAN, "HTTP 200")
        corridor, reason, _, _ = auto_review.review(self.row(), self.judge_never_called())
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("звіт", reason)

    def test_page_without_action_stays_a_draft(self):
        text = "Курс дипломатії для дітей. Діти вчаться слухати й домовлятися. " * 5
        auto_review.FETCH = lambda url: (text, "HTTP 200")
        corridor, reason, _, _ = auto_review.review(
            self.row(source_url="https://example.org/kurs"), self.judge_never_called())
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("як потрапити", reason)

    def test_unreadable_page_stays_a_draft(self):
        auto_review.FETCH = lambda url: (None, "HTTP 403")
        corridor, reason, _, _ = auto_review.review(self.row(), self.judge_never_called())
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("не прочитали", reason)

    def test_judge_sees_the_page(self):
        seen = {}

        class LLM:
            class messages:  # noqa: N801
                @staticmethod
                def create(**kw):
                    seen["content"] = kw["messages"][0]["content"]
                    raise RuntimeError("стоп")
        auto_review.FETCH = lambda url: (MAN_NEWS * 3, "HTTP 200")
        auto_review.review(self.row(source_url=MAN_NEWS_URL), LLM())
        self.assertIn("Текст сторінки", seen["content"])
        self.assertIn("зареєструйтеся", seen["content"])


if __name__ == "__main__":
    unittest.main()


class AgeAndPrimarySource(unittest.TestCase):
    """Марія, 11.10.2026: «0–18 не буває, крім виплат»; «анонс у медіа — знахідка»."""

    def test_zero_to_eighteen_is_held_even_with_a_quote(self):
        row = {"age_from": 0, "age_to": 18, "opportunity_type": "club",
               "evidence": {"age": "для дітей", "type": "гурток"}}
        self.assertIn("0–18", auto_review.placeholder_reason(row))

    def test_zero_to_eighteen_is_fine_for_payments(self):
        for row in ({"age_from": 0, "age_to": 18, "opportunity_type": "allowance", "evidence": {"age": "до 18"}},
                    {"age_from": 0, "age_to": 18, "opportunity_type": "club", "aid_type": "discount",
                     "evidence": {"age": "до 18", "type": "знижка"}}):
            self.assertEqual(auto_review.placeholder_reason(row), "")

    def test_media_source_is_a_lead_not_an_opportunity(self):
        from first_source import source_problem
        for url in ("https://chmr.golos.net.ua/news/stypendiya", "https://www.mig.com.ua/artterapiia/",
                    "https://programmes.eurodesk.eu/x", "https://gurtok.org/psyhologiya"):
            with self.subTest(url=url):
                self.assertTrue(source_problem({"source_url": url}))

    def test_organizer_pages_pass(self):
        from first_source import source_problem
        for url in ("https://man.gov.ua/events/kurs", "https://osvita.diia.gov.ua/courses/ai",
                    "https://aikom.iea.gov.ua/cell/cell/view?cellId=1"):
            with self.subTest(url=url):
                self.assertEqual(source_problem({"source_url": url}), "")
