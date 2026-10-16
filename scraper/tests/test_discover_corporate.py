"""Профіль «бізнес для школярів»: свої теми, свої регіони, перевірка віку й кола.

16.10.2026. Привід — «ПриватКампус» ПриватБанку: стипендія 15 000 грн/міс, але
для студентів і лише 16 вишів-партнерів. Два питання, на які цей профіль мусить
відповідати сам: чи це для тих, кому ще немає 19, і кого саме беруть.
"""
import importlib
import os
import pathlib
import sys
import unittest
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import keywords  # noqa: E402
import discover_agent as da  # noqa: E402


def _reload(module, **env):
    for k in ("DISCOVER_PROFILE", "DISCOVER_KEYWORD", "DISCOVER_REGION",
              "DISCOVER_DEFICIT_CELL", "DISCOVER_AGE_BAND"):
        os.environ.pop(k, None)
    os.environ.update(env)
    return importlib.reload(importlib.import_module(module))


class CorporateLists(unittest.TestCase):
    def test_regions_are_business_not_cities(self):
        names = {r["name"] for r in keywords.CORPORATE_REGIONS}
        self.assertEqual(names, {"Український бізнес", "Міжнародні компанії"})

    def test_themes_are_about_companies(self):
        self.assertTrue(keywords.CORPORATE_KEYWORDS)
        for w in keywords.CORPORATE_KEYWORDS:
            self.assertTrue(
                any(s in w for s in ("компані", "бренд", "бізнес", "банк", "фонду")),
                f"тема без організатора-бізнесу: {w}")

    def test_themes_are_for_children(self):
        # Доросла версія — привід цього профілю, а не його зміст.
        for w in keywords.CORPORATE_KEYWORDS:
            self.assertTrue(
                any(s in w for s in ("школяр", "учн", "дітей", "дитяч", "підлітк",
                                     "старшокласник", "юних")),
                f"тема не називає дитину: {w}")
            self.assertNotIn("студент", w)


class CorporateProfile(unittest.TestCase):
    def tearDown(self):
        _reload("discover_agent")

    def test_profile_picks_own_theme_and_region(self):
        mod = _reload("discover_agent", DISCOVER_PROFILE="corporate")
        self.assertIn(mod.keyword_of_day(), keywords.CORPORATE_KEYWORDS)
        self.assertIn(mod.region_of_day()["name"],
                      {"Український бізнес", "Міжнародні компанії"})

    def test_prompt_demands_business_organizer_and_school_age(self):
        mod = _reload("discover_agent", DISCOVER_PROFILE="corporate")
        p = mod._prompt("стипендія від компанії для учнів школи",
                        keywords.CORPORATE_REGIONS[0])
        self.assertIn("ПриватКампус", p)
        self.assertIn("ОБМЕЖЕННЯ КОЛА УЧАСНИКІВ", p)
        self.assertIn("кому ще немає 19", p)
        # Регіон «Український бізнес» — не діаспора: правил про життя в чужій
        # країні тут бути не повинно.
        self.assertNotIn("ЦЕЙ ПОШУК — ДЛЯ ДІАСПОРИ", p)

    def test_page_is_always_read(self):
        mod = _reload("discover_agent", DISCOVER_PROFILE="corporate")
        self.assertTrue(mod.VERIFY)
        self.assertFalse(mod.CHECK_CURRENT)

    def test_admin_comment_marks_the_profile(self):
        mod = _reload("discover_agent", DISCOVER_PROFILE="corporate")
        rec = mod.build_record(
            {"title": "Конкурс", "url": "https://example.com/konkurs"},
            "конкурс для школярів від української компанії з призами",
            keywords.CORPORATE_REGIONS[0])
        self.assertTrue(rec["admin_comment"].startswith("🏢 Бізнес для школярів:"))

    def test_default_profile_unchanged(self):
        mod = _reload("discover_agent")
        self.assertFalse(mod.CORPORATE)
        self.assertIn(mod.keyword_of_day(), keywords.DISCOVER_KEYWORDS)


PAGE = (
    "Конкурс «Юний інженер» від компанії Вектор. До участі запрошуємо учнів "
    "8–11 класів. Подати заявку можуть лише учні шкіл-партнерів Дніпропетровської "
    "області. Заявки приймаємо до 20 листопада 2026 року. Участь безкоштовна."
)

BASE = {
    "page_kind": "one_opportunity",
    "organizer": "Вектор",
    "organizer_kind": "company",
    "audience": "school_children",
    "audience_evidence": "До участі запрошуємо учнів 8–11 класів",
    "for_children": True,
    "scope": "limited",
    "scope_evidence": "Подати заявку можуть лише учні шкіл-партнерів Дніпропетровської області",
    "is_current": "current",
    "date_evidence": "Заявки приймаємо до 20 листопада 2026 року",
}

TODAY = date(2026, 10, 16)


class DecideCorporate(unittest.TestCase):
    def test_limited_scope_passes_but_warns(self):
        ok, why = da.decide_corporate(BASE, PAGE, TODAY)
        self.assertTrue(ok)
        self.assertIn("БЕРУТЬ НЕ ВСІХ", why)
        self.assertIn("шкіл-партнерів", why)
        self.assertIn("Вектор", why)

    def test_students_are_rejected(self):
        # Власне «ПриватКампус»: програма чудова, але не для школярів.
        out = {**BASE, "audience": "students", "for_children": False,
               "audience_evidence": "Подати заявку може студент будь-якого університету-партнера"}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)
        self.assertIn("студентів", why)

    def test_age_quote_must_be_on_the_page(self):
        out = {**BASE, "audience_evidence": "Запрошуємо учнів 1–4 класів"}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)
        self.assertIn("цитати про вік", why)

    def test_limited_without_quote_is_rejected(self):
        out = {**BASE, "scope_evidence": ""}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)
        self.assertIn("беруть не всіх", why)

    def test_open_scope_has_no_warning(self):
        out = {**BASE, "scope": "open", "scope_evidence": ""}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertTrue(ok)
        self.assertNotIn("БЕРУТЬ НЕ ВСІХ", why)
        self.assertNotIn("коло учасників", why)

    def test_scope_not_stated_warns(self):
        out = {**BASE, "scope": "not_stated", "scope_evidence": ""}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertTrue(ok)
        self.assertIn("коло учасників", why)

    def test_state_organizer_is_left_to_the_daily_agent(self):
        out = {**BASE, "organizer_kind": "state_or_ngo"}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)
        self.assertIn("не бізнес", why)

    def test_past_is_rejected(self):
        out = {**BASE, "is_current": "past"}
        ok, why = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)
        self.assertIn("минуло", why)

    def test_listing_page_is_rejected(self):
        out = {**BASE, "page_kind": "listing_or_org"}
        ok, _ = da.decide_corporate(out, PAGE, TODAY)
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
