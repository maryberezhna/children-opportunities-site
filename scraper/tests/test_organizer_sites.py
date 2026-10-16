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

MIGRATIONS = pathlib.Path(__file__).resolve().parents[2] / "supabase" / "migrations"


class Registry(unittest.TestCase):
    def test_every_site_has_a_sources_row(self):
        # Сайти додаються окремими міграціями (20260929, 20261016…) —
        # шукаємо рядок у будь-якій.
        sql = "\n".join(p.read_text() for p in sorted(MIGRATIONS.glob("*.sql")))
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

    def test_privatbank_keeps_only_child_news(self):
        # Заголовки з privatbank.ua/news/archive, 16.10.2026.
        site = SITES_BY_KEY["privatbank"]
        for title in ("ПриватБанк підвищив ставки за гривневими депозитами до 13,5% річних для фізичних осіб",
                      "ПриватБанк повторно виставив на аукціон Prozorro.Продажі стадіон «Дніпро-Арена»",
                      "ПриватБанк, МВС та ДМС посилюють протидію шахрайству з підробленими документами",
                      "Понад 40 000 учасників у 8 містах: ПриватБанк та Mastercard підбили підсумки JuniorS Games 2026"):
            self.assertTrue(skipped_title(site, title), title)
        for title in ("Запускаємо ПриватКампус — стань амбасадором і отримуй стипендію",
                      "ПриватБанк запрошує школярів на конкурс «Моя банківська картка майбутнього»",
                      "JuniorS Games 2026: фестиваль для дітей стартує в Бучі"):
            self.assertFalse(skipped_title(site, title) or is_report(title), title)


if __name__ == "__main__":
    unittest.main()
