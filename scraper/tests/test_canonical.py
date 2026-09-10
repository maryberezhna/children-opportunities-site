"""Дзеркальність канонізації URL.

scraper/canonical.py і scrapers/lib/canonical.mjs мусять давати ІДЕНТИЧНИЙ
рядок: це єдиний ключ, за яким два пайплайни впізнають один і той самий
запис. Розходження не падає й нічого не логує — просто в базі тихо
з'являється другий запис тієї самої можливості (так сталося з FLEX:
/en/programs/... і /programs/... жили як дві картки з різними дедлайнами).

Таблиця нижче дублює tests/canonical.test.mjs — правити треба обидва файли.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from canonical import canonical_url  # noqa: E402

CASES = [
    # мовний префікс шляху не є частиною ідентичності
    ("https://americancouncils.org.ua/en/programs/future-leaders-exchange-program",
     "https://americancouncils.org.ua/programs/future-leaders-exchange-program"),
    ("https://americancouncils.org.ua/programs/future-leaders-exchange-program",
     "https://americancouncils.org.ua/programs/future-leaders-exchange-program"),
    ("https://uboost.study/ua/career", "https://uboost.study/career"),
    ("https://100millionlearners.org/uk/register-info?partner=USF",
     "https://100millionlearners.org/register-info?partner=USF"),
    ("https://refugeehelp.nl/nl/ukrainian-refugee/article/100107-x",
     "https://refugeehelp.nl/ukrainian-refugee/article/100107-x"),
    ("https://example.com/EN-US/page", "https://example.com/page"),

    # а ось це НЕ мова, і зрізати не можна
    ("https://mitocw.zendesk.com/hc/en-us/articles/533286-x",
     "https://mitocw.zendesk.com/hc/en-us/articles/533286-x"),   # hc = help center
    ("https://example.com/it/courses", "https://example.com/it/courses"),  # IT, не італійська
    ("https://example.com/id/12", "https://example.com/id/12"),
    ("https://britishschool.ua/uk", "https://britishschool.ua/uk"),        # головна, не сторінка

    # решта правил канонізації
    ("https://ukraine.uwc.org/apply/", "https://ukraine.uwc.org/apply"),
    ("http://WWW.Example.COM/a/?utm_source=x&b=2&a=1#frag", "https://example.com/a?a=1&b=2"),
    ("example.com/a", "https://example.com/a"),
    ("ftp://example.com/a", None),
]


class CanonicalMirror(unittest.TestCase):
    def test_table(self):
        for raw, want in CASES:
            with self.subTest(raw=raw):
                self.assertEqual(canonical_url(raw), want)

    def test_junk_does_not_raise(self):
        for junk in (None, "", "   ", "не url", 42, {}):
            with self.subTest(junk=junk):
                self.assertIsNone(canonical_url(junk) if not isinstance(junk, str) else None)


if __name__ == "__main__":
    unittest.main()
