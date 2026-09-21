"""Дозаповнення з тексту (Марія, 21.09.2026: «так має бути щодо вартості,
міста і всього, що можна заповнити»). Кожен кейс — або справжній запис із
бази, або пастка, на якій правило колись помилялось би."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import text_fill as tf  # noqa: E402
from normalizer import _sanitize  # noqa: E402


class Cost(unittest.TestCase):
    def test_free(self):
        self.assertEqual(tf.cost_from_text("Участь безкоштовна для всіх."), "free")

    def test_only_partly_free_is_not_free(self):
        for text in ("Багато безкоштовних модулів для початківців.",
                     "Приймає дітей ВПО безкоштовно; для інших категорій — платно.",
                     "Безкоштовна реєстрація на окремі конкурси."):
            self.assertIsNone(tf.cost_from_text(text), text)

    def test_free_trial_is_paid(self):
        # Безкоштовне лише пробне — далі родина платить. Справжні записи бази.
        for text in ("Перший урок доступний безкоштовно для всіх охочих, курс можна "
                     "проходити повністю самостійно онлайн.",
                     "Геймифікований підхід, зрозумілі пояснення. Безкоштовний тестовий період.",
                     "Є безкоштовний пробний/ознайомчий урок. Навчання українською мовою.",
                     "Перше заняття безкоштовне.",
                     "Перший місяць — безкоштовно."):
            self.assertEqual(tf.cost_from_text(text), "paid_affordable", text)

    def test_first_lessons_without_free_are_not_a_trial(self):
        # Гурток ЦПР, безкоштовний: «перші уроки» тут — зміст, а не пробне.
        self.assertIsNone(tf.cost_from_text(
            "Діти 7+ років здобувають та закріплюють перші уроки з шиття."))
        self.assertIsNone(tf.cost_from_text("Запис на пробне заняття за телефоном."))
        # Безкоштовно — усе, а не перший урок: «платно» тут не ставимо.
        self.assertNotEqual(tf.cost_from_text("Усі заняття безкоштовні, перший урок — знайомство."),
                            "paid_affordable")

    def test_paid_only_with_a_fee(self):
        self.assertEqual(tf.cost_from_text("Вартість: 1200 грн на місяць."), "paid_affordable")
        # Гроші, які платить не родина: приз, стипендія, виплата.
        self.assertIsNone(tf.cost_from_text("Призовий фонд 50 000 грн."))
        self.assertIsNone(tf.cost_from_text("Стипендія 2000 грн на місяць."))


class City(unittest.TestCase):
    def test_city_in_any_case(self):
        self.assertEqual(tf.city_from_text("Музична школа №5 (Кривий Ріг)"), "Кривий Ріг")
        self.assertEqual(tf.city_from_text("Позашкільний заклад у Львові"), "Львів")

    def test_region_is_not_a_city(self):
        self.assertIsNone(tf.city_from_text("с. Бабин, Івано-Франківська область"))
        self.assertIsNone(tf.city_from_text("Київська область, програма громади"))

    def test_national_event_is_not_local(self):
        self.assertIsNone(tf.city_from_text("Всеукраїнський конкурс, фінал у Києві"))

    def test_several_cities_is_a_list_not_a_place(self):
        self.assertIsNone(tf.city_from_text("Філії у Києві, Львові та Одесі"))


class Country(unittest.TestCase):
    def test_where_the_child_will_be(self):
        self.assertEqual(tf.country_from_text("Волонтерство в Італії (Казаледжо-Боїро)"), "it")

    def test_language_is_not_a_country(self):
        self.assertIsNone(tf.country_from_text("Курси італійською мовою"))

    def test_people_from_abroad_do_not_move_the_child(self):
        self.assertIsNone(tf.country_from_text("Табір в Україні, волонтери з США"))
        self.assertIsNone(tf.country_from_text("Консультації по навчанню в США"))


class Age(unittest.TestCase):
    def test_range_and_groups(self):
        self.assertEqual(tf.age_from_text("Категорії: 3–5, 6–9, 10–12, 16–18 років."), (3, 18))
        self.assertEqual(tf.age_from_text("для молоді 13–25 років"), (13, 18))

    def test_grades(self):
        self.assertEqual(tf.age_from_text("для учнів 5–11 класів"), (10, 17))

    def test_duration_is_not_age(self):
        self.assertIsNone(tf.age_from_text("Термін навчання 6-8 років."))
        self.assertIsNone(tf.age_from_text("Рекомендований вік для початку — 8-9 років."))

    def test_dates_are_not_age(self):
        self.assertIsNone(tf.age_from_text("Реєстрація 15–20 жовтня."))


class TypeByTitle(unittest.TestCase):
    def test_reliable_words_only(self):
        self.assertEqual(tf.type_from_title("Всеукраїнська олімпіада з біології"), "olympiad")
        self.assertEqual(tf.type_from_title("Гурток «Аквабіотехніка»"), "club")
        # «Допомога» влучає лише в 46% — не вгадуємо.
        self.assertIsNone(tf.type_from_title("Допомога родинам ВПО"))


class InSanitize(unittest.TestCase):
    """Разом у нормалізаторі: заповнюється лише порожнє, з позначкою."""

    def base(self, **over):
        d = {"title": "Музична школа №5 (Кривий Ріг)",
             "summary": "Навчання безкоштовне для дітей 6–15 років.",
             "opportunity_type": "club", "cost_type": None, "format": None,
             "cities": [], "countries": None, "age_from": None, "age_to": None,
             "deadline": None, "recurrence": None, "timing_kind": None}
        d.update(over)
        return d

    def test_fills_what_the_text_says(self):
        d = _sanitize(self.base())
        self.assertEqual(d["cities"], ["Кривий Ріг"])
        self.assertEqual(d["cost_type"], "free")
        self.assertEqual((d["age_from"], d["age_to"]), (6, 15))
        self.assertIn("з тексту", d["admin_comment"])
        self.assertNotIn("бракує", d["admin_comment"])

    def test_in_between_cost_counts_as_empty(self):
        # «Частково безкоштовно» сайт не показує — запис висів із «бракує: вартість».
        d = _sanitize(self.base(
            title="Online lessenreeks нідерландської мови від d-teach",
            summary="Онлайн-курс для дітей. Перший урок доступний безкоштовно для всіх охочих.",
            cost_type="partially_free"))
        self.assertEqual(d["cost_type"], "paid_affordable")
        self.assertIn("пробний", d["admin_comment"])
        self.assertNotIn("вартість", d["admin_comment"].split("бракує", 1)[-1]
                         if "бракує" in d["admin_comment"] else "")

    def test_model_answer_wins(self):
        d = _sanitize(self.base(cost_type="paid_affordable", cities=["Київ"],
                                age_from=10, age_to=12))
        self.assertEqual(d["cost_type"], "paid_affordable")
        self.assertEqual(d["cities"], ["Київ"])
        self.assertEqual((d["age_from"], d["age_to"]), (10, 12))


class Backfill(unittest.TestCase):
    """Прогін по чернетках, що вже в черзі."""

    def test_draft_gets_what_the_text_says(self):
        from fill_from_text import plan
        row = {"id": "x", "title": "Безкоштовна арттерапія для дітей — Запоріжжя",
               "summary": "Заняття для дітей 6–12 років, безкоштовно.",
               "status": "draft", "opportunity_type": "club", "cost_type": None,
               "format": None, "cities": [], "countries": None,
               "age_from": 0, "age_to": 18, "deadline": None, "event_start_date": None,
               "event_end_date": None, "results_date": None, "recurrence": "ongoing",
               "admin_comment": "auto: перед публікацією бракує — вік, вартість, формат або місце; "
                                "вік 0–18 поставлено технічно, перевір, чи це для дітей"}
        patch = plan(row)
        self.assertEqual(patch["cities"], ["Запоріжжя"])
        self.assertEqual(patch["cost_type"], "free")
        self.assertEqual((patch["age_from"], patch["age_to"]), (6, 12))
        self.assertIn("з тексту", patch["admin_comment"])
        self.assertNotIn("status", patch)

    def test_draft_with_partly_free_trial_becomes_paid(self):
        from fill_from_text import plan
        row = {"id": "x", "title": "Online лессенреекс нідерландської мови від d-teach",
               "summary": "Онлайн-курс нідерландської мови для дітей-початківців. Перший урок "
                          "доступний безкоштовно для всіх охочих.",
               "status": "draft", "opportunity_type": "course", "cost_type": "partially_free",
               "format": "online", "cities": [], "countries": ["nl"], "age_from": 6, "age_to": 12,
               "deadline": None, "event_start_date": None, "event_end_date": None,
               "results_date": None, "recurrence": "ongoing", "admin_comment": ""}
        patch = plan(row)
        self.assertEqual(patch["cost_type"], "paid_affordable")
        self.assertNotIn("status", patch)

    def test_nothing_in_text_nothing_changes(self):
        from fill_from_text import plan
        row = {"id": "x", "title": "Escuela interactiva de sábados", "summary": "Щосуботня школа.",
               "status": "draft", "opportunity_type": "club", "cost_type": "free", "format": None,
               "cities": [], "countries": None, "age_from": 6, "age_to": 17, "deadline": None,
               "event_start_date": None, "event_end_date": None, "results_date": None,
               "recurrence": "ongoing", "admin_comment": ""}
        self.assertEqual(plan(row), {})
