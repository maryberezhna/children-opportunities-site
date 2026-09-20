"""Eurodesk: форма відповіді змінилась — перевіряємо обидві.

20.09.2026 джерело мовчки давало нуль: виклик зсередини браузера почав
повертати сторінку 403, а поле `open` із рядка стало обʼєктом {html, starts}.
Тест тримає обидві форми, щоб наступна зміна впала тут, а не в тиші раз на
30 днів.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scrapers"))

from scrapers.eurodesk import parse_open, section_html  # noqa: E402

CARD = '''
<div data-role="card" data-color="blue">
  <div data-role="header"><span>20/09/2026</span></div>
  <div data-role="title">Youth Start-Up Challenge</div>
  <div data-role="body"><div>Для молодих підприємців</div></div>
  <select><option value="20729-eu">EN</option></select>
</div>
<div data-role="card" data-color="green">
  <div data-role="title">Traineeship at an agency</div>
  <select><option value="99999-eu">EN</option></select>
</div>
'''


class SectionShape(unittest.TestCase):
    def test_object_form(self):
        self.assertEqual(section_html({"html": "<b>x</b>", "starts": True}), "<b>x</b>")

    def test_string_form(self):
        self.assertEqual(section_html("<b>x</b>"), "<b>x</b>")

    def test_missing(self):
        self.assertEqual(section_html(None), "")
        self.assertEqual(section_html({}), "")


class ParseOpen(unittest.TestCase):
    def test_card_becomes_item(self):
        items = parse_open(CARD)
        self.assertEqual(len(items), 1)          # зелена картка — стажування, 18+
        it = items[0]
        self.assertEqual(it["raw_title"], "Youth Start-Up Challenge")
        self.assertEqual(it["source_url"], "https://programmes.eurodesk.eu/20729-eu")
        self.assertIn("Дедлайн подачі: 20/09/2026", it["raw_text"])

    def test_empty_html(self):
        self.assertEqual(parse_open(""), [])


if __name__ == "__main__":
    unittest.main()
