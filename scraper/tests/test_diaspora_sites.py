"""Сайти організацій діаспори (28.09.2026): відсів до моделі й реєстр.

Змішані стрічки (Український дім у Дрездені, єпархія УГКЦ) здебільшого про
дорослих; у модель має йти лише те, де названо дитину, школу чи дитячий вік
будь-якою мовою напряму.
"""
import json
import os
import pathlib
import re
import sys
import unittest
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scrapers.diaspora_sites import (  # noqa: E402
    SITES, clean_title, is_for_children, is_report, keep_wp_entry, mec_last_date,
    page_text, trim, ucci_calendar, group_key, merge_age_groups, SITES_BY_KEY,
)
import db  # noqa: E402

MIGRATION = (pathlib.Path(__file__).resolve().parents[2]
             / "supabase" / "migrations" / "20260928_diaspora_sites.sql")
NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


class ChildMarker(unittest.TestCase):
    def test_children_in_every_language(self):
        for text in ("Ukrainische Schule: Schülerinnen und Schüler der 1.–4. Klasse",
                     "Kreative Frühförderung für Kinder im Vorschulalter",
                     "58. Dziecięcy Festiwal Kultury Ukraińskiej",
                     "Танцювальна студія: запрошуємо дітей віком від 4 до 18 років",
                     "Kinderklub (für ukrainische Kinder, 7-15 Jahre)",
                     "groepen voor kinderen", "curso para niños"):
            with self.subTest(text=text):
                self.assertTrue(is_for_children(text))

    def test_adult_events_do_not_pass(self):
        for text in ("Seniorentreff – Die fitten 60+ jeden Donnerstag",
                     "Job-Matching-Konferenz im Bereich Hotellerie",
                     "Майстер-клас з петриківського розпису для дорослих",
                     "Maks Kidruk geht mit seinem Roman auf Welttournee"):
            with self.subTest(text=text):
                self.assertFalse(is_for_children(text))

    def test_child_word_deep_in_a_sermon_does_not_count(self):
        sermon = "Проповідь владики. " + "Слово про віру і надію. " * 60 + "молитва за дітей"
        self.assertTrue(is_for_children(sermon))
        self.assertFalse(is_for_children(sermon, 700))


class Reports(unittest.TestCase):
    def test_past_event_titles(self):
        for title in ("У Команчі відбувся І тур табору «Сарепта»",
                      "Am 31. August fand „Dresden is(s)t bunt“ statt",
                      "Festiwal odbył się w Elblągu"):
            with self.subTest(title=title):
                self.assertTrue(is_report(title))
        self.assertFalse(is_report("51 Festiwal ukraińskich zespołów dziecięcych"))

    def test_placeholder_title_becomes_first_sentence(self):
        self.assertEqual(clean_title("Авточернетка", "Вечір поезії. Приходьте всі."),
                         "Вечір поезії.")
        self.assertEqual(clean_title("SCHOOL UCCI KIDS", "…"), "SCHOOL UCCI KIDS")


class WordPressEntries(unittest.TestCase):
    SITE = {"skip_text": r"^SCHOOL UCCI KIDS\s"}

    def entry(self, title, text, modified="2026-09-01T10:00:00"):
        return {"title": {"rendered": title}, "content": {"rendered": f"<p>{text}</p>"},
                "modified_gmt": modified, "link": "https://x.ie/a/"}

    def test_stale_catalog_page_is_skipped(self):
        stats = {}
        got = keep_wp_entry(self.entry("Бальні танці для дітей", "для дітей",
                                       modified="2025-06-27T10:00:00"),
                            {"catalog": True}, self.SITE, NOW, stats)
        self.assertIsNone(got)
        self.assertEqual(stats, {"stale": 1})

    def test_lesson_inside_saturday_school_is_part_of_the_school(self):
        stats = {}
        got = keep_wp_entry(self.entry("Вокал", "SCHOOL UCCI KIDS Вокал Вік: 6–12"),
                            {"catalog": True}, self.SITE, NOW, stats)
        self.assertIsNone(got)
        self.assertEqual(stats, {"school_part": 1})

    def test_adult_course_is_skipped_children_category_is_not(self):
        adult = self.entry("UCCI Excel Pro", "Курс Excel для роботи")
        self.assertIsNone(keep_wp_entry(adult, {}, self.SITE, NOW, {}))
        self.assertIsNotNone(keep_wp_entry(adult, {"children_only": True}, self.SITE, NOW, {}))

    def test_children_post_is_kept(self):
        got = keep_wp_entry(self.entry("Танцювальна студія «Мрія»", "набір 4–18 років"),
                            {"catalog": True}, self.SITE, NOW, {})
        self.assertEqual(got[0], "Танцювальна студія «Мрія»")


class Pages(unittest.TestCase):
    def test_google_sites_chrome_is_cut(self):
        html = ("<html><body><div>Рідна школа Search this site Embedded Files "
                "Реєстрація на 2026/2027. Вартість 1800 корун</div>"
                "<div>Google Sites Report abuse Page details</div></body></html>")
        self.assertEqual(page_text(html), "Реєстрація на 2026/2027. Вартість 1800 корун")

    def test_forms_and_dropped_blocks_are_gone(self):
        html = ("<main><p>Вік 6-8</p><form>Згода на обробку даних</form>"
                "<div class='mec-single-event-date'>Дата Вер 28 2026</div></main>")
        self.assertEqual(page_text(html, "main", (".mec-single-event-date",)), "Вік 6-8")

    def test_trim(self):
        self.assertEqual(trim("меню Зареєструватись Суть Copyright Dzherelo 2024",
                              "Зареєструватись", "Copyright Dzherelo"), "Суть")
        self.assertEqual(trim("без маркерів", "А", "Б"), "без маркерів")

    def test_mec_next_date(self):
        html = ("<div class='mec-single-event-date'><h3>Дата</h3>"
                "<span class='mec-start-date-label'>Вер 28 2026</span></div>")
        self.assertEqual(mec_last_date(html), date(2026, 9, 28))
        self.assertIsNone(mec_last_date("<p>нічого</p>"))

    def test_ucci_calendar_line_without_weekly_date(self):
        html = ("<table><thead><tr><th>Час</th><th>Субота 26 вер.</th></tr></thead>"
                "<tbody><tr><td class='time-cell'>10:00</td><td>"
                "<div class='calendar-event-card'><span>10:00-15:00</span>"
                "<a class='event-title' href='https://ucci.ie/our-projects/school-ucc-kids/'>"
                "SCHOOL UCCI KIDS</a><span>26 School St, Dublin 8</span></div>"
                "</td></tr></tbody></table>")
        self.assertEqual(ucci_calendar(html), {
            "https://ucci.ie/our-projects/school-ucc-kids/":
                ["Субота 10:00-15:00 SCHOOL UCCI KIDS 26 School St, Dublin 8"]})


class Registry(unittest.TestCase):
    def rows(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        found = {}
        for name, config in re.findall(r"\(\s*'((?:[^']|'')+)',\s*'python'.*?'(\{\"module\".*?\})'",
                                       sql, re.S):
            found[name.replace("''", "'")] = json.loads(config)
        return found

    def test_every_site_has_a_row_with_the_same_place(self):
        rows = self.rows()
        self.assertEqual(set(rows), {s["name"] for s in SITES})
        for site in SITES:
            with self.subTest(site=site["key"]):
                cfg = rows[site["name"]]
                self.assertEqual(cfg["site"], site["key"])
                self.assertEqual(cfg["default_countries"], [site["country"]])
                self.assertEqual(cfg.get("default_city"), site.get("city"))

    def test_no_competitor_aggregators(self):
        blob = json.dumps(SITES, ensure_ascii=False)
        for host in ("espanaua.es", "ua.pl/", "afisha.it", "t.me/"):
            self.assertNotIn(host, blob)


class FakeTable:
    def __init__(self, row, sink):
        self.row, self.sink = row, sink

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def limit(self, *_):
        return self

    def update(self, patch):
        self.sink.update(patch)
        return self

    def execute(self):
        return type("R", (), {"data": [self.row]})()


class FakeClient:
    def __init__(self, row):
        self.row, self.patch = row, {}

    def table(self, _):
        return FakeTable(self.row, self.patch)


class PinnedInterval(unittest.TestCase):
    def test_weekly_pinned_stays_weekly_after_new_items(self):
        client = FakeClient({"crawl_interval_days": 7, "pin_interval": True})
        db.record_crawl_result(client, "x", ok=True, new_items=5)
        self.assertEqual(client.patch["crawl_interval_days"], 7)
        nxt = datetime.fromisoformat(client.patch["next_crawl_at"])
        self.assertAlmostEqual((nxt - datetime.now(timezone.utc)).days, 6, delta=1)

    def test_daily_pinned_is_unchanged(self):
        client = FakeClient({"crawl_interval_days": 1, "pin_interval": True})
        db.record_crawl_result(client, "x", ok=True, new_items=0)
        self.assertEqual(client.patch["crawl_interval_days"], 1)

    def test_failed_weekly_retries_tomorrow(self):
        client = FakeClient({"crawl_interval_days": 7, "pin_interval": True})
        db.record_crawl_result(client, "x", ok=False, new_items=0)
        nxt = datetime.fromisoformat(client.patch["next_crawl_at"])
        self.assertLessEqual((nxt - datetime.now(timezone.utc)).days, 1)


def _it(title, slug, text=None):
    return {"source": "Осередок", "source_url": f"https://oseredok-leipzig.de/uk/events/{slug}/",
            "raw_title": title, "raw_text": text or f"{title} Вік … Вартість (місяць) €20.00"}


class AgeGroups(unittest.TestCase):
    """Осередок (Лейпциг): той самий гурток для різних віків — одна картка."""

    def test_group_titles_share_a_key(self):
        same = [
            ("Паперове диво, Група 1 (4-6 років)", "Паперове диво, Група 2 (6-8 років)"),
            ("Українознавство/ Група 1 (6-7 років)", "Українознавство/Група 2. 7-8 роки"),
            ("Ранній музичний розвиток, Група 1 (1,5-3 роки)", "Ранній музичний розвиток, Група 3 (5-7 років)"),
            ("Ментальна арифметика 1 група (7-10 років)", "Ментальна арифметика 2 група (7-10 років)"),
            ("Групові Логопедичні Заняття – Сходинки Мовлення (6-8 Років)",
             "Групові Логопедичні Заняття – Сходинки Мовлення (5-6 Років)"),
        ]
        for a, b in same:
            self.assertEqual(group_key(a), group_key(b), (a, b))
        # Різні гуртки й різні дати — різні картки.
        self.assertNotEqual(group_key("Дитячі танці-KIDS- 6-8р."), group_key("Дитячі танці- MINIS- 3-5р."))
        self.assertNotEqual(group_key("Дитяче читання 4.10.2026 о 14:00, книжка «Віка»"),
                            group_key("Дитяче читання 11.10.2026 о 14:00, книжка «Віка»"))

    def test_merge_keeps_every_group_in_the_text(self):
        items = [
            _it("Креативне малювання, Група 3 (8-10 років)", "km-3", "Вік 8-10 років Вартість 20"),
            _it("Курс гри на гітарі", "gitara"),
            _it("Креативне малювання, Група 1 (6-7 років)", "km-1", "Вік 6-7 років Вартість 20"),
            _it("Креативне малювання, Група 2 (7-9 років)", "km-2", "Вік 7-9 років Вартість 20"),
        ]
        out = merge_age_groups(items)
        self.assertEqual(len(out), 2)
        card = out[0]
        self.assertEqual(card["raw_title"], "Креативне малювання")
        # Адреса — першої групи; вік кожної групи — словами сторінки, по порядку.
        self.assertTrue(card["source_url"].endswith("/km-1/"))
        text = card["raw_text"]
        for age in ("Вік 6-7 років", "Вік 7-9 років", "Вік 8-10 років"):
            self.assertIn(age, text)
        self.assertLess(text.index("Група 1"), text.index("Група 2"))
        self.assertLess(text.index("Група 2"), text.index("Група 3"))
        self.assertIs(out[1], items[1])  # одиночний запис не чіпаємо

    def test_only_oseredok_merges(self):
        self.assertTrue(SITES_BY_KEY["oseredok"].get("merge_groups"))
        self.assertEqual([s["key"] for s in SITES if s.get("merge_groups")], ["oseredok"])


if __name__ == "__main__":
    unittest.main()
