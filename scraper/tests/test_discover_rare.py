"""Флоу «рідкісне за кордоном»: свої теми, лише закордон, фокус на незвичному.

Рішення Марії 14.09.2026. Зразок — тенісний табір Фонду Марти Костюк в Іспанії.
"""
import importlib
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import keywords  # noqa: E402


def _reload(module, **env):
    for k in ("DISCOVER_PROFILE", "DISCOVER_KEYWORD", "DISCOVER_REGION",
              "DISCOVER_SOURCES_PROFILE", "DISCOVER_SOURCES_THEME"):
        os.environ.pop(k, None)
    os.environ.update(env)
    return importlib.reload(importlib.import_module(module))


class RareLists(unittest.TestCase):
    def test_no_ukraine_regions(self):
        names = {r["name"] for r in keywords.RARE_ABROAD_REGIONS}
        self.assertNotIn("Україна", names)
        self.assertTrue({"Іспанія", "США і Канада", "Світ"} <= names)

    def test_audience_is_children_living_in_ukraine(self):
        for reg in keywords.RARE_ABROAD_REGIONS:
            self.assertIn("живуть в Україні", reg["audience"])

    def test_themes_are_unusual_not_clubs(self):
        self.assertIn("тенісний табір для українських дітей", keywords.RARE_ABROAD_KEYWORDS)
        for w in keywords.RARE_ABROAD_KEYWORDS:
            self.assertNotIn("гурток", w)


class RareProfile(unittest.TestCase):
    def tearDown(self):
        _reload("discover_agent")
        _reload("discover_sources")

    def test_rare_profile_picks_rare_theme_and_abroad_region(self):
        da = _reload("discover_agent", DISCOVER_PROFILE="rare_abroad")
        self.assertIn(da.keyword_of_day(), keywords.RARE_ABROAD_KEYWORDS)
        self.assertNotEqual(da.region_of_day()["name"], "Україна")

    def test_rare_prompt_demands_ukrainian_eligibility(self):
        da = _reload("discover_agent", DISCOVER_PROFILE="rare_abroad")
        p = da._prompt("тенісний табір для українських дітей", keywords.RARE_ABROAD_REGIONS[0])
        self.assertIn("Марти Костюк", p)
        self.assertIn("можуть подаватися діти з України", p)

    def test_default_profile_unchanged(self):
        da = _reload("discover_agent")
        self.assertIn(da.keyword_of_day(), keywords.DISCOVER_KEYWORDS)
        self.assertNotIn("Марти Костюк", da._prompt("олімпіада", keywords.REGION_ROTATION[0]))

    def test_forced_region_works_in_rare_profile(self):
        da = _reload("discover_agent", DISCOVER_PROFILE="rare_abroad", DISCOVER_REGION="Світ")
        self.assertEqual(da.region_of_day()["name"], "Світ")

    def test_foundations_profile_picks_foundation_theme(self):
        ds = _reload("discover_sources", DISCOVER_SOURCES_PROFILE="foundations")
        self.assertIn(ds.theme_of_day(), ds.FOUNDATION_THEMES)


if __name__ == "__main__":
    unittest.main()
