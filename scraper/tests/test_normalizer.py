"""Інваріанти нормалізатора. Регресія 01.09.2026: slugify транслітерував
кирилицю тим unidecode-пакетом, який випадково стояв в оточенні, — той
самий запис у різних запусках отримував різні слаги, і в базі виросло
20 пар дублів. Ці тести прибʼють поведінку до власної таблиці."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from normalizer import Normalizer, _sanitize, missing_required  # noqa: E402


class SlugInvariants(unittest.TestCase):
    def test_ukrainian_official_transliteration(self):
        # и→y, г→h, є→ie — офіційна таблиця, НЕ російська (i, g)
        slug = Normalizer._make_slug("Квіти Перемоги", "тест")
        self.assertTrue(slug.startswith("kvity-peremohy-"), slug)
        slug = Normalizer._make_slug("Гурток Ідея", "тест")
        self.assertTrue(slug.startswith("hurtok-ideia-"), slug)

    def test_deterministic(self):
        a = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        b = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("dytiachyi-khor-shchedryk-"), a)

    def test_hash_suffix_six_hex(self):
        slug = Normalizer._make_slug("Тест", "джерело")
        self.assertRegex(slug, r"-[0-9a-f]{6}$")


if __name__ == "__main__":
    unittest.main()


class RequiredBeforePublish(unittest.TestCase):
    """Дата, тип, вік, вартість і місце-або-формат — обовʼязковий мінімум
    перед публікацією (вимога Марії 11.09.2026). Дзеркало цих перевірок
    живе в tests/required.test.mjs; правити треба обидва файли."""

    @staticmethod
    def _full(**over):
        data = {
            "age_from": 6, "age_to": 12, "deadline": "2026-10-01",
            "cost_type": "free", "opportunity_type": "camp", "format": "offline",
            "cities": ["Львів"], "countries": ["ua"], "is_international": False,
        }
        data.update(over)
        return data

    def test_full_record_needs_nothing(self):
        self.assertEqual(missing_required(self._full()), [])

    def test_each_field_blocks_on_its_own(self):
        self.assertEqual(missing_required(self._full(age_to=None)), ["вік"])
        self.assertEqual(missing_required(self._full(cost_type=None)), ["вартість"])
        self.assertEqual(missing_required(self._full(opportunity_type=None)), ["тип"])
        self.assertEqual(
            missing_required(self._full(deadline=None)),
            ["дата, період або періодичність"])
        self.assertEqual(
            missing_required(self._full(format=None, cities=[], countries=[])),
            ["формат або місце (онлайн / офлайн / за кордоном)"])

    def test_garbage_is_not_a_filled_field(self):
        # cost_type "unknown" і тип поза словником раніше проходили ворота,
        # а вже після них мовчки ставали null.
        self.assertEqual(missing_required(self._full(cost_type="unknown")), ["вартість"])
        self.assertEqual(missing_required(self._full(opportunity_type="щось")), ["тип"])

    def test_date_closed_by_any_of_three(self):
        for key, val in (("deadline", "2026-10-01"),
                         ("event_end_date", "2026-12-01"),
                         ("recurrence", "annual"), ("recurrence", "ongoing")):
            row = self._full(deadline=None)
            row[key] = val
            self.assertEqual(missing_required(row), [], key)

    def test_place_closed_by_any_of_four(self):
        nowhere = dict(format=None, cities=[], countries=[], is_international=False)
        for key, val in (("format", "online"), ("cities", ["Київ"]),
                         ("countries", ["pl"]), ("is_international", True)):
            row = self._full(**nowhere)
            row[key] = val
            self.assertEqual(missing_required(row), [], key)


class SanitizeGate(unittest.TestCase):
    """Ворота стоять у _sanitize: неповний запис не може вийти активним."""

    def test_incomplete_record_becomes_draft_with_reason(self):
        out = _sanitize({
            "status": "active", "title": "Табір", "opportunity_type": "camp",
            "cost_type": "unknown", "format": None, "cities": [],
        })
        self.assertEqual(out["status"], "draft")
        for expected in ("вік", "вартість", "дата", "формат або місце"):
            self.assertIn(expected, out["admin_comment"])

    def test_complete_record_keeps_status(self):
        out = _sanitize({
            "status": "active", "age_from": 6, "age_to": 12,
            "deadline": "2026-10-01", "cost_type": "free",
            "opportunity_type": "camp", "format": "offline",
        })
        self.assertEqual(out["status"], "active")
        self.assertNotIn("бракує", out.get("admin_comment") or "")

    def test_unknown_type_still_saves_but_is_flagged(self):
        # opportunity_type NOT NULL — заглушка лишається, але брак видно.
        out = _sanitize({
            "status": "active", "age_from": 6, "age_to": 12,
            "deadline": "2026-10-01", "cost_type": "free",
            "opportunity_type": "невідомо", "format": "online",
        })
        self.assertEqual(out["opportunity_type"], "course")
        self.assertEqual(out["status"], "draft")
        self.assertIn("тип", out["admin_comment"])
