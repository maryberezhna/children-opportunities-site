"""Сайти організаторів (29.09.2026): список у коді й рядки в sources не розходяться,
а заголовки для дорослих і звіти до моделі не йдуть."""
import os
import pathlib
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main  # noqa: E402
from scrapers.diaspora_sites import is_report, skipped_title  # noqa: E402
from scrapers.organizer_sites import SITES, SITES_BY_KEY, scrapers  # noqa: E402

MIGRATION = (pathlib.Path(__file__).resolve().parents[2]
             / "supabase" / "migrations" / "20260929_organizer_sites.sql")


class Registry(unittest.TestCase):
    def test_every_site_has_a_sources_row(self):
        sql = MIGRATION.read_text()
        for site in SITES:
            with self.subTest(site=site["key"]):
                self.assertIn(f"'{site['name']}'", sql)
                self.assertIn(f'"site": "{site["key"]}"', sql)

    def test_sites_run_in_the_nightly_scrape(self):
        names = {s[0] for s in main.SCRAPERS}
        for name, _mod, tag in scrapers():
            self.assertIn(name, names)
            self.assertEqual(tag, "thematic")

    def test_no_aggregators_or_telegram(self):
        # Правило «джерело — сторінка організатора»: жодних t.me і добірок.
        for site in SITES:
            urls = " ".join((site.get("links") or {}).get("lists", []) + site.get("rss", []))
            self.assertNotRegex(urls, r"t\.me|telegram|eurodesk|euneighbours|prostir")


class Titles(unittest.TestCase):
    def test_teacher_events_are_skipped(self):
        site = SITES_BY_KEY["man-events"]
        for title in ("Тренінг-практикум «Розвиток природничих компетентностей учнів»",
                      "Старт нового проєкту «МАН. Освітянська»",
                      "Лекція «Українська музика під радянською цензурою»"):
            self.assertTrue(skipped_title(site, title), title)

    def test_student_events_pass(self):
        site = SITES_BY_KEY["man-events"]
        for title in ("Всеукраїнська осіння школа «STEM JAS.UA»",
                      "Всеукраїнський конкурс есе імені Сергія Кемського",
                      "Хакатон «Свідомі: відбудовувати країну»"):
            self.assertFalse(skipped_title(site, title) or is_report(title), title)
        news = SITES_BY_KEY["man-news"]
        for title in ("Стартує сезон Всеукраїнського конкурсу ISEF Ukraine — 2027",
                      "Розпочинається новий сезон GENIUS Olympiad Ukraine"):
            self.assertFalse(skipped_title(news, title), title)
        self.assertTrue(skipped_title(news, "Розпочинається новий сезон конкурсу «Учитель року»"))

    def test_finished_programmes_are_skipped(self):
        site = SITES_BY_KEY["klitschko"]
        self.assertTrue(skipped_title(site, "School of Resilience завершено: учасники представили проєкти"))
        self.assertFalse(skipped_title(
            site, "Klitschko Foundation відкриває набір на проєкт School of Resilience для українських підлітків"))


if __name__ == "__main__":
    unittest.main()
