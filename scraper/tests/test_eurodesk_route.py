"""Eurodesk через посередника на Supabase (21.09.2026): з адрес GitHub
сайт відповідає 403, і джерело тижнями мовчки давало нуль."""
import asyncio
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from scrapers import eurodesk  # noqa: E402

CARD = ('<div data-role="card" data-color="red"><div data-role="header"><span>01/10/2026</span></div>'
        '<div data-role="title">Erasmus+ Youth Exchanges</div>'
        '<div data-role="body"><div>Молодіжні обміни для 13–30 років.</div></div>'
        '<select><option value="21214-eu">EU</option></select></div>')


class Route(unittest.TestCase):
    def test_uses_supabase_when_keys_are_set(self):
        async def fake():
            return {"ok": True, "count": 534, "open": {"html": CARD}}
        with patch.object(eurodesk, "_via_supabase", fake):
            items = asyncio.run(eurodesk.fetch_all())
        self.assertEqual(items[0]["raw_title"], "Erasmus+ Youth Exchanges")
        self.assertEqual(items[0]["source_url"], f"{eurodesk.BASE}/21214-eu")

    def test_zero_cards_is_an_error_not_an_empty_success(self):
        # Раніше [] означав «джерело порожнє, усе гаразд» — і поламку не бачив ніхто.
        async def fake():
            return {"ok": True, "count": 534, "open": {"html": "<div></div>"}}
        with patch.object(eurodesk, "_via_supabase", fake):
            with self.assertRaises(RuntimeError):
                asyncio.run(eurodesk.fetch_all())

    def test_no_keys_means_direct(self):
        with patch.dict("os.environ", {"SUPABASE_URL": "", "SUPABASE_SERVICE_KEY": ""}):
            self.assertIsNone(asyncio.run(eurodesk._via_supabase()))
