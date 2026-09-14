"""Що шукає агент-розвідник і що він відкидає як «уже є».

Ротація: з 14.09.2026 — лише складне (конкурси, закордон, гранти, діти
захисників, кар'єра, табори), категорії чергуються щодня. Дедуп: «сайт уже є»
лише для запису про сайт цілком, інакше портал губив нові можливості.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import hubs  # noqa: E402
from keywords import DISCOVER_KEYWORDS, KEYWORD_CATEGORIES  # noqa: E402


class Rotation(unittest.TestCase):
    def test_no_club_or_format_words(self):
        banned = set(KEYWORD_CATEGORIES["format"]) | set(KEYWORD_CATEGORIES["arts"]) \
            | set(KEYWORD_CATEGORIES["sport"]) | set(KEYWORD_CATEGORIES["nonformal"])
        # «мовний табір» є і в мовах, і в таборах — табори пріоритетні, тож дозволено.
        leaked = [w for w in DISCOVER_KEYWORDS if w in banned]
        self.assertEqual(leaked, [])
        for w in ("гурток", "музична школа", "мультиплікація", "науковий гурток"):
            self.assertNotIn(w, DISCOVER_KEYWORDS)

    def test_priority_themes_present(self):
        for w in ("олімпіада", "конкурс", "обмін", "erasmus", "грант для школярів",
                  "стипендія для школярів", "для дітей загиблих захисників", "літня школа"):
            self.assertIn(w, DISCOVER_KEYWORDS)

    def test_not_alphabetical_and_categories_alternate(self):
        self.assertNotEqual(DISCOVER_KEYWORDS, sorted(DISCOVER_KEYWORDS))
        # Перші шість днів — шість різних категорій.
        first = DISCOVER_KEYWORDS[:6]
        self.assertEqual(first[0], KEYWORD_CATEGORIES["contests"][0])
        self.assertEqual(first[1], KEYWORD_CATEGORIES["international"][0])
        self.assertEqual(first[2], "грант для школярів")

    def test_no_duplicates_and_noise_skipped(self):
        self.assertEqual(len(DISCOVER_KEYWORDS), len(set(DISCOVER_KEYWORDS)))
        for w in ("збори", "quest", "вікторина", "кастинг"):
            self.assertNotIn(w, DISCOVER_KEYWORDS)


class SiteAlreadyInCatalogue(unittest.TestCase):
    def test_portal_page_does_not_block_domain(self):
        existing = ["https://spilkuisia.kr.gov.ua/news/muzychna-shkola-14"]
        self.assertNotIn("spilkuisia.kr.gov.ua", hubs.site_root_domains(existing))

    def test_whole_site_record_blocks_domain(self):
        existing = ["https://liouba-lorrukraine.fr/", "https://www.example.org"]
        self.assertEqual(hubs.site_root_domains(existing), {"liouba-lorrukraine.fr", "example.org"})

    def test_hub_domains_from_prefixes(self):
        self.assertEqual(hubs.hub_domains(("https://www.mincult.gov.ua/x", "https://man.gov.ua/contests")),
                         {"mincult.gov.ua", "man.gov.ua"})


if __name__ == "__main__":
    unittest.main()
