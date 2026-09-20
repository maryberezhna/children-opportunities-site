"""Ключ дедуплікації — один на всі конвеєри (Фаза 3 плану)."""
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import hubs  # noqa: E402


class ContentHash(unittest.TestCase):
    def test_same_url_gives_same_key_whatever_the_title(self):
        # Назву пише модель, і для того самого джерела вона щоразу інша:
        # «uBoost Career» і «uBoost Career — державна програма…» — один запис.
        with patch.object(hubs, "is_hub", return_value=False):
            a = hubs.content_hash("uBoost Career", "https://x.org/p")
            b = hubs.content_hash("uBoost Career — державна програма", "https://x.org/p")
        self.assertEqual(a, b)

    def test_hub_page_keeps_title_in_the_key(self):
        # На одній адресі МОН живуть 24 предметні олімпіади — за URL вони
        # злиплися б в одну.
        with patch.object(hubs, "is_hub", return_value=True):
            a = hubs.content_hash("Олімпіада з біології", "https://mon.gov.ua/olimpiadi")
            b = hubs.content_hash("Олімпіада з хімії", "https://mon.gov.ua/olimpiadi")
        self.assertNotEqual(a, b)

    def test_key_length_is_stable(self):
        with patch.object(hubs, "is_hub", return_value=False):
            self.assertEqual(len(hubs.content_hash("x", "https://x.org")), 16)
