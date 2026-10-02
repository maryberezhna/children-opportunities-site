"""Поле, якого немає в таблиці, не має губити весь запис (02.10.2026).

upsert писав запис як є, і один зайвий ключ змушував PostgREST відкинути ВЕСЬ
рядок. Так загинула можливість через поле «title_original», якого немає ні в
базі, ні в нашому коді: його придумала модель під час екстракції. Слід лишився
один — рядок у лозі нічного прогону, і прогін при цьому був зелений.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from db import drop_unknown  # noqa: E402

COLUMNS = {"id", "title", "slug", "cost_type", "evidence"}


class DropUnknown(unittest.TestCase):
    def test_invented_field_is_dropped_and_named(self):
        rec = {"title": "Курс", "slug": "kurs", "title_original": "Course"}
        out, extra = drop_unknown(rec, COLUMNS)
        self.assertEqual(out, {"title": "Курс", "slug": "kurs"})
        self.assertEqual(extra, ["title_original"])

    def test_record_survives(self):
        # Головне: решта полів доїжджає до бази, а не гине разом із зайвим.
        rec = {"title": "Курс", "cost_type": "free", "whatever": 1, "another": 2}
        out, extra = drop_unknown(rec, COLUMNS)
        self.assertEqual(out["cost_type"], "free")
        self.assertEqual(extra, ["another", "whatever"])

    def test_clean_record_is_untouched(self):
        rec = {"title": "Курс", "evidence": {"cost": "безкоштовно"}}
        out, extra = drop_unknown(rec, COLUMNS)
        self.assertIs(out, rec)
        self.assertEqual(extra, [])

    def test_unknown_schema_changes_nothing(self):
        # Порожній перелік = базу не дочитали. Тоді краще спробувати записати як
        # є, ніж викинути справжнє поле через недоступність бази.
        rec = {"title": "Курс", "title_original": "Course"}
        out, extra = drop_unknown(rec, set())
        self.assertIs(out, rec)
        self.assertEqual(extra, [])


class ItIsActuallyCalled(unittest.TestCase):
    """Найдорожча помилка тут — не логіка, а невикликана перевірка."""

    def test_upsert_filters_before_writing(self):
        path = os.path.join(os.path.dirname(__file__), "..", "db.py")
        with open(path, encoding="utf-8") as f:
            code = f.read()
        self.assertIn("drop_unknown(record, known_columns(client))", code)
        # Фільтр мусить стояти ПЕРЕД записом, інакше він ні до чого.
        self.assertLess(code.index("drop_unknown(record"),
                        code.index('.upsert(\n            record'))
        # І про прибране має бути чути: порожнє поле краще за тишу.
        self.assertIn("бракує міграції", code)


if __name__ == "__main__":
    unittest.main()
