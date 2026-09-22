"""Наш власний дописаний текст не може бути «цитатою зі сторінки».

22.09.2026, перевірка воріт правди: скрапери складають raw_text із заголовка,
полів зі сторінки і власних пояснювальних речень. Модель могла процитувати
саме наше речення — і здогад пройшов би як доказ джерела. Найгірший випадок:
олімпіади МОН, де mon.gov.ua віддає 403 і весь текст складає скрапер зі
статичної таблиці.
"""
import glob
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from proof import OUR_LINES, quote_in_text, source_text, verify_evidence  # noqa: E402

SCRAPERS = os.path.join(os.path.dirname(__file__), "..", "scrapers")

EURODESK = ("Online course: Activism Inside Out\n"
            "Дедлайн подачі: ONGOING\n"
            "The European Youth Forum free course is for you.\n"
            "Європейська програма з переліку Eurodesk Opportunity Finder. "
            "Набір відкритий на момент збору.")

GURTOK = ("Гурток шахів\nМісто: Львів\nВік: 6-16 років\nВартість: безкоштовно\n"
          "Заняття двічі на тиждень.\n"
          "Гурток із переліку gurtok.org. Умови й контакти уточнюються в організації.")

MON = ("Всеукраїнська олімпіада з математики для учнів 6-11 класів.\n"
       "Щорічне змагання МОН України. Шкільний тур — жовтень-листопад.\n"
       "Участь безкоштовна. Реєстрація через школу.\n"
       "Вік учасників: 11-17 років (6-11 класів).")


class OurWordsAreNotEvidence(unittest.TestCase):

    def test_our_sentence_is_not_a_quote(self):
        self.assertFalse(quote_in_text("Набір відкритий на момент збору", EURODESK))
        self.assertFalse(quote_in_text("Умови й контакти уточнюються в організації", GURTOK))

    def test_page_fields_still_count(self):
        # Поле, ЗЧИТАНЕ зі сторінки й лише переформатоване, — слова джерела.
        self.assertTrue(quote_in_text("Дедлайн подачі: ONGOING", EURODESK))
        self.assertTrue(quote_in_text("Вік: 6-16 років", GURTOK))
        self.assertTrue(quote_in_text("Вартість: безкоштовно", GURTOK))
        self.assertTrue(quote_in_text("The European Youth Forum free course is for you", EURODESK))

    def test_fully_synthetic_record_proves_nothing(self):
        # МОН: сайт 403, текст складає скрапер — доказів там немає взагалі.
        ev = verify_evidence({
            "age": "Вік учасників: 11-17 років (6-11 класів)",
            "date": "Щорічне змагання МОН України",
            "cost": "Участь безкоштовна. Реєстрація через школу.",
            "type": "Всеукраїнська олімпіада з математики для учнів 6-11 класів",
            "place": "Шкільний тур — жовтень-листопад",
        }, MON)
        self.assertEqual(ev, {}, ev)

    def test_source_text_keeps_the_source(self):
        cleaned = source_text(GURTOK)
        self.assertIn("Заняття двічі на тиждень", cleaned)
        self.assertNotIn("уточнюються в організації", cleaned)

    def test_list_has_not_drifted_from_the_scrapers(self):
        """Скрапер змінив формулювання — перелік мусить змінитись разом із ним."""
        code = ""
        for path in glob.glob(os.path.join(SCRAPERS, "*.py")):
            with open(path, encoding="utf-8") as f:
                code += f.read()
        code = re.sub(r"\s+", " ", code)
        for pattern in OUR_LINES:
            # Найдовший дослівний шматок патерна (без регулярних спецзнаків) —
            # він і має бути в коді скрапера слово в слово.
            literal = max(re.findall(r"[\w\s'’-]+", pattern), key=len).strip()
            self.assertGreaterEqual(len(literal), 8, pattern)
            self.assertIn(literal, code, f"немає у скраперах: {literal!r}")


if __name__ == "__main__":
    unittest.main()
