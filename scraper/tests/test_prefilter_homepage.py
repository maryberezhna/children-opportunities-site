"""Головна сторінка, яка вже показала, що нічого не дає (24.09.2026).

Заміри по всій історії raw_items: URL без шляху — 30% усього тексту, відданого
моделі, і 6.5% користі. kmstudio.com.ua читали 23 рази за 30 днів, ureport.in —
24, mms.gov.ua — 24; щоразу новий хеш (головна щодня інша), тож хеш-гейт їх не
спиняв, і жодна не дала запису.

Заборонити головні сторінки цілком не можна: ProCamp, Docudays, Atlas Weekend,
Гоголь-fest прийшли саме з першого читання головної. Тести стережуть обидва
боки цього правила.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from raw_store import homepage_wasted, is_homepage  # noqa: E402


class IsHomepage(unittest.TestCase):
    def test_url_without_path(self):
        for url in ("https://kmstudio.com.ua", "https://mms.gov.ua/",
                    "http://arduino.ua", "https://coursera.org/"):
            self.assertTrue(is_homepage(url), url)

    def test_url_with_path_is_not_a_homepage(self):
        for url in ("https://zaxid.net/sekreti_bukkrosingu_lviv_n1092127",
                    "https://coursera.org/courses",
                    "https://programmes.eurodesk.eu/search/programme/23225/eu",
                    "https://mms.gov.ua/news/123"):
            self.assertFalse(is_homepage(url), url)

    def test_empty_is_not_a_homepage(self):
        self.assertFalse(is_homepage(""))
        self.assertFalse(is_homepage(None))


class HomepageWasted(unittest.TestCase):
    def test_first_read_is_always_allowed(self):
        # ProCamp, Docudays, Atlas Weekend — по одному читанню головної, і всі
        # три стали записами. Порожня історія означає «читаємо».
        self.assertFalse(homepage_wasted([]))

    def test_repeat_after_a_useful_read_is_allowed(self):
        rows = [{"id": "1", "opportunity_id": None},
                {"id": "2", "opportunity_id": "uuid-запису"}]
        self.assertFalse(homepage_wasted(rows))

    def test_repeat_after_only_empty_reads_is_blocked(self):
        rows = [{"id": str(i), "opportunity_id": None} for i in range(23)]
        self.assertTrue(homepage_wasted(rows))

    def test_single_empty_read_already_blocks_the_second(self):
        # Другий раз читати головну, яка вчора нічого не дала, нема сенсу:
        # саме з цього й виросли 23 читання kmstudio.com.ua.
        self.assertTrue(homepage_wasted([{"id": "1", "opportunity_id": None}]))


if __name__ == "__main__":
    unittest.main()
