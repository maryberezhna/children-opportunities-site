"""Позначка «міжнародна» не переживає конкретного українського міста.

23.09.2026: картка English Club у Києві писала «За кордоном», бо модель
ставила is_international=True за «учасники з різних країн» (американці в
гостях). Підпис на сайті рахувався з прапорця, а не з міста.
"""
import unittest

from normalizer import _drop_international_for_local


class DropInternationalForLocal(unittest.TestCase):
    def test_kyiv_club_loses_flag(self):
        data = {"is_international": True, "countries": ["ua"], "cities": ["Київ"]}
        _drop_international_for_local(data)
        self.assertFalse(data["is_international"])
        self.assertIn("Київ", data["admin_comment"])

    def test_abroad_keeps_flag(self):
        data = {"is_international": True, "countries": ["pl"], "cities": ["Закопане"]}
        _drop_international_for_local(data)
        self.assertTrue(data["is_international"])

    def test_pseudo_city_keeps_flag(self):
        # «Вся Україна» — не місто: Європейський корпус солідарності возить у ЄС.
        data = {"is_international": True, "countries": ["ua"], "cities": ["Вся Україна"]}
        _drop_international_for_local(data)
        self.assertTrue(data["is_international"])

    def test_no_country_keeps_flag(self):
        data = {"is_international": True, "countries": [], "cities": ["Київ"]}
        _drop_international_for_local(data)
        self.assertTrue(data["is_international"])

    def test_local_record_untouched(self):
        data = {"is_international": False, "countries": ["ua"], "cities": ["Запоріжжя"]}
        _drop_international_for_local(data)
        self.assertFalse(data["is_international"])
        self.assertNotIn("admin_comment", data)


if __name__ == "__main__":
    unittest.main()
