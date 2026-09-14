"""Перевірка кандидата «рідкісне за кордоном» сторінкою.

14.09.2026 перший прогін запропонував «дитячий хор Palianycia для українських
дітей»: на сторінці не було ні дітей, ні України. І шкільний оркестр — справжній,
відкритий для всіх, але це звичайний гурток.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from discover_agent import decide_verified  # noqa: E402

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


if __name__ == "__main__":
    unittest.main()
