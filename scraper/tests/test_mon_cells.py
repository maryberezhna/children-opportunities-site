"""Реєстр МОН «Осередки за кордоном» (28.09.2026): що беремо і як дублі."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from db import MIOK_SOURCE, MON_CELLS_SOURCE, school_twin_resolution  # noqa: E402
from proof import quote_in_text  # noqa: E402
from scrapers.mon_cells import SOURCE_NAME, parse_cell, parse_list, to_item, wanted  # noqa: E402

# Скорочена сторінка осередку — та сама розмітка «підпис / значення», що на
# aikom.iea.gov.ua/cell/cell/view?cellId=110051 (28.09.2026).
CELL = """<html><body><header>AIKOM</header><div class="context">
<h1>Українська суботня школа в Гамбурзі</h1>
<table>
<tr><th>Країна</th><td>Німеччина</td></tr>
<tr><th>Повна назва(іноземною мовою)</th><td>Ukrainische Samstagsschule Hamburg</td></tr>
<tr><th>Рік заснування</th><td>2001</td></tr>
<tr><th>Повна назва(українською мовою)</th><td>Українська суботня школа в Гамбурзі</td></tr>
<tr><th>Навчання є</th><td>Платне</td></tr>
<tr><th>Категорія</th><td>Суботня / недільна школа, яка претендує на визнання українського компоненту</td></tr>
<tr><th>Сайт(и)</th><td><a href="http://ukrainische-schule-hamburg.de/">ukrainische-schule-hamburg.de/</a></td></tr>
<tr><th>Посилання на сторінку у соцмережі</th><td></td></tr>
<tr><th>Прізвище, ім’я, по батькові керівника</th><td>Іваненко Олена</td></tr>
<tr><th>Рішення комісії</th><td>взяти на облік … у 1-4 класах; … у 5-9 класах</td></tr>
</table></div></body></html>"""


class Cells(unittest.TestCase):

    def test_parse_fields(self):
        f = parse_cell(CELL)
        self.assertEqual(f["Країна"], "Німеччина")
        self.assertEqual(f["Навчання є"], "Платне")
        self.assertEqual(f["Повна назва(українською мовою)"], "Українська суботня школа в Гамбурзі")
        # Порожнє поле не «позичає» значення в наступного підпису.
        self.assertNotIn("Посилання на сторінку у соцмережі", f)

    def test_item_is_the_page_words(self):
        item = to_item(110051, parse_cell(CELL))
        self.assertEqual(item["source"], SOURCE_NAME)
        self.assertEqual(item["source_url"], "https://aikom.iea.gov.ua/cell/cell/view?cellId=110051")
        self.assertEqual(item["raw_title"], "Українська суботня школа в Гамбурзі")
        # Вартість із реєстру — цитата, яку пропускають ворота правди.
        self.assertTrue(quote_in_text("Навчання є: Платне", item["raw_text"]))
        self.assertIn("Країна: Німеччина", item["raw_text"])
        # Керівника (персональні дані) у сирець не несемо.
        self.assertNotIn("Іваненко", item["raw_text"])

    def test_only_weekend_schools_in_our_countries(self):
        base = parse_cell(CELL)
        self.assertEqual(wanted(base), "de")
        self.assertEqual(wanted({**base, "Країна": "Італія"}), "it")
        self.assertIsNone(wanted({**base, "Країна": "Велика Британія"}))
        self.assertEqual(wanted({**base, "Категорія": "Освітньо-культурний центр, який претендує"}), "de")
        for other in ("Школа за кордоном (або осередок), яка реалізує українські освітні стандарти",
                      "Школа (або осередок школи), що має статус освіти національних меншин",
                      "Організація національно-патріотичного та громадянського виховання"):
            self.assertIsNone(wanted({**base, "Категорія": other}), other)

    def test_list_ids(self):
        html = ('<a href="/cell/cell/view?cellId=110015">x</a>'
                '<a href="/cell/cell/view?cellId=110016">y</a><a href="?cellId=110015">')
        self.assertEqual(parse_list(html), [110015, 110016])


class Duplicates(unittest.TestCase):
    """Та сама школа з реєстру й МІОК — лишається МІОК; сайт школи бʼє обох."""

    def rec(self, source, status="draft"):
        return {"title": "Українська школа «Мрія»", "source": source, "status": status,
                "opportunity_type": "club", "countries": ["es"], "cities": ["Мадрид"]}

    def test_miok_stays(self):
        self.assertEqual(school_twin_resolution(self.rec(MON_CELLS_SOURCE), self.rec(MIOK_SOURCE)),
                         "new_is_dup")
        self.assertEqual(school_twin_resolution(self.rec(MIOK_SOURCE), self.rec(MON_CELLS_SOURCE)),
                         "twin_is_dup")

    def test_school_site_beats_the_registry_draft(self):
        self.assertEqual(school_twin_resolution(self.rec("mriya.es"), self.rec(MON_CELLS_SOURCE)),
                         "twin_is_dup")

    def test_active_registry_card_stays(self):
        self.assertEqual(school_twin_resolution(self.rec(MIOK_SOURCE),
                                                self.rec(MON_CELLS_SOURCE, "active")),
                         "new_is_dup")


if __name__ == "__main__":
    unittest.main()
