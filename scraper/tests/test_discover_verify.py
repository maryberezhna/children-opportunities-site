"""Перевірка кандидата «рідкісне за кордоном» сторінкою.

14.09.2026 перший прогін запропонував «дитячий хор Palianycia для українських
дітей»: на сторінці не було ні дітей, ні України. І шкільний оркестр — справжній,
відкритий для всіх, але це звичайний гурток.
"""
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from discover_agent import decide_current, decide_verified  # noqa: E402
from normalizer import summary_says_over  # noqa: E402

KOSTYUK = ("Фонд Марти Костюк запрошує українських дітей віком 10–14 років на безкоштовний "
           "тенісний табір у Салоу. Табір для дітей з України, які займаються тенісом.")
HARMONIE = ("Orchestr NF Harmonie. Přijímáme děti od 1. do 7. třídy. Program je otevřen všem "
            "dětem bez rozdílu původu. Lekce i zapůjčené nástroje jsou bezplatné.")
PALIANYCIA = "Palianycia. Live Music. Our concerts. Praha. Get Started!"


def out(**kw):
    base = {"page_kind": "one_opportunity", "for_children": True,
            "children_evidence": "українських дітей віком 10–14 років",
            "eligibility": "for_ukrainians",
            "eligibility_evidence": "Табір для дітей з України, які займаються тенісом",
            "kind": "unusual"}
    base.update(kw)
    return base


class DecideVerified(unittest.TestCase):
    def test_kostyuk_camp_is_accepted(self):
        ok, why = decide_verified(out(), KOSTYUK)
        self.assertTrue(ok)
        self.assertIn("для дітей з України", why)

    def test_palianycia_without_children_is_rejected(self):
        ok, why = decide_verified(out(for_children=False, children_evidence="",
                                      eligibility="not_stated", eligibility_evidence=""), PALIANYCIA)
        self.assertFalse(ok)
        self.assertIn("для дітей", why)

    def test_invented_quote_is_rejected(self):
        # Модель «процитувала» те, чого на сторінці немає.
        ok, why = decide_verified(out(children_evidence="дитячий хор для українських дітей 6–14 років"), PALIANYCIA)
        self.assertFalse(ok)
        self.assertIn("цитати про дітей", why)

    def test_eligibility_not_stated_is_rejected(self):
        ok, why = decide_verified(out(eligibility="not_stated", eligibility_evidence=""), KOSTYUK)
        self.assertFalse(ok)
        self.assertIn("діти з України", why)

    def test_regular_club_open_to_all_is_rejected(self):
        ok, why = decide_verified(out(children_evidence="Přijímáme děti od 1. do 7. třídy",
                                      eligibility="open_to_all",
                                      eligibility_evidence="Program je otevřen všem dětem bez rozdílu původu",
                                      kind="regular_club"), HARMONIE)
        self.assertFalse(ok)
        self.assertIn("гурток", why)

    def test_listing_page_is_rejected(self):
        ok, _ = decide_verified(out(page_kind="listing_or_org"), KOSTYUK)
        self.assertFalse(ok)



class Actuality(unittest.TestCase):
    """Контрольний прогін 14.09.2026 приніс новину 2023 року про давно минулий табір."""
    TODAY = date(2026, 9, 14)
    NEWS_2023 = ("16/08/2023. 50 niños ucranianos vendrán a Extremadura para olvidar la guerra "
                 "en un campamento solidario. Niños y jóvenes de 8 a 17 años llegados de Ucrania.")

    def base(self, **kw):
        o = out(children_evidence="Niños y jóvenes de 8 a 17 años",
                eligibility="for_ukrainians",
                eligibility_evidence="50 niños ucranianos vendrán a Extremadura")
        o.update(kw)
        return o

    def test_old_news_rejected_even_if_model_says_current(self):
        ok, why = decide_verified(self.base(is_current="current", date_evidence="16/08/2023"),
                                  self.NEWS_2023, today=self.TODAY)
        self.assertFalse(ok)
        self.assertIn("дата в минулому", why)

    def test_past_rejected(self):
        ok, why = decide_verified(self.base(is_current="past", date_evidence="16/08/2023"),
                                  self.NEWS_2023, today=self.TODAY)
        self.assertFalse(ok)
        self.assertIn("минуло", why)

    def test_date_quote_not_on_page_rejected(self):
        ok, why = decide_verified(out(is_current="current", date_evidence="заявки до 30 жовтня 2026"),
                                  KOSTYUK, today=self.TODAY)
        self.assertFalse(ok)
        self.assertIn("з датою", why)

    def test_current_with_date_accepted_and_noted(self):
        page = KOSTYUK + " Реєстрація триває до 30 жовтня 2026 року."
        ok, why = decide_verified(out(is_current="current", date_evidence="Реєстрація триває до 30 жовтня 2026 року"),
                                  page, today=self.TODAY)
        self.assertTrue(ok)
        self.assertIn("дата:", why)

    def test_no_date_accepted_with_warning(self):
        ok, why = decide_verified(out(is_current="unknown", date_evidence=""), KOSTYUK, today=self.TODAY)
        self.assertTrue(ok)
        self.assertIn("дату на сторінці не видно", why)



class BloomsdayOverThisYear(unittest.TestCase):
    """17.09.2026: щоденний агент поклав у чергу «Bloomsday Young Authors»
    (Ірландія) з власним описом «сезон 2026 року вже завершено»."""
    SUMMARY = ("Щорічний конкурс творчого письма для дітей та підлітків, організований "
               "The Museum of Childhood Ireland у Дубліні. Проводиться щороку до/на "
               "Bloomsday (16 червня), сезон 2026 року вже завершено.")
    PAGE = "Bloomsday 2026 Creative Writing Competition. Entries closed on 16 June 2026."

    def test_summary_saying_over_is_caught(self):
        self.assertTrue(summary_says_over(self.SUMMARY))
        self.assertTrue(summary_says_over("Реєстрацію закрито."))

    def test_ordinary_words_are_not_caught(self):
        self.assertFalse(summary_says_over("Після завершення курсу — сертифікат."))
        self.assertFalse(summary_says_over("Сезон 2026 завершено, реєстрація на 2027 відкрита."))
        self.assertFalse(summary_says_over(None))

    def test_past_this_year_rejected_when_model_knows_today(self):
        # Рік 2026 = поточний, тож перевірка року сама не ловить; вирішує
        # висновок моделі, якій тепер передається сьогоднішня дата.
        ok, why = decide_current({"is_current": "past",
                                  "date_evidence": "Entries closed on 16 June 2026"},
                                 self.PAGE, today=date(2026, 9, 17))
        self.assertFalse(ok)
        self.assertIn("минуло", why)

    def test_current_passes_with_quote(self):
        page = "Entries open until 30 November 2026."
        ok, why = decide_current({"is_current": "current",
                                  "date_evidence": "Entries open until 30 November 2026"},
                                 page, today=date(2026, 9, 17))
        self.assertTrue(ok)
        self.assertIn("актуально", why)


class ReachableFromUkraine(unittest.TestCase):
    """Уточнення Марії 14.09.2026: можливість має бути доступна дитині, яка живе в Україні."""
    DARUJEME = ("Darujeme kroužky dětem. Rodiny ukrajinských uprchlíků s dětmi ve věku 3–18 let, "
                "které pobývají v ČR na základě víza za účelem strpění, mohou žádat o příspěvek.")

    def test_residents_only_is_rejected(self):
        o = out(children_evidence="s dětmi ve věku 3–18 let", eligibility="for_ukrainians",
                eligibility_evidence="Rodiny ukrajinských uprchlíků s dětmi ve věku 3–18 let",
                kind="unusual", residency="residents_only",
                residency_evidence="které pobývají v ČR na základě víza za účelem strpění")
        ok, why = decide_verified(o, self.DARUJEME, today=date(2026, 9, 14))
        self.assertFalse(ok)
        self.assertIn("треба жити в країні", why)

    def test_open_from_ukraine_with_quote_is_accepted(self):
        page = KOSTYUK + " Діти приїдуть з різних міст України, дорогу оплачує фонд."
        o = out(residency="open_from_ukraine", residency_evidence="Діти приїдуть з різних міст України")
        ok, why = decide_verified(o, page, today=date(2026, 9, 14))
        self.assertTrue(ok)
        self.assertIn("з України:", why)

    def test_invented_residency_quote_is_rejected(self):
        o = out(residency="open_from_ukraine", residency_evidence="Приймаємо заявки з будь-якої країни світу")
        ok, why = decide_verified(o, KOSTYUK, today=date(2026, 9, 14))
        self.assertFalse(ok)
        self.assertIn("з України", why)

    def test_unknown_residency_goes_to_moderation_with_flag(self):
        ok, why = decide_verified(out(residency="unknown", residency_evidence=""), KOSTYUK, today=date(2026, 9, 14))
        self.assertTrue(ok)
        self.assertIn("не видно, чи можна скористатися з України", why)


if __name__ == "__main__":
    unittest.main()
