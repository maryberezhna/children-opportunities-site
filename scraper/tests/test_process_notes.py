"""Один механізм коментарів модератора — відбір відкритих і закриття.

23.09.2026: механізмів було два (таблиця moderation_notes і
opportunities.moderation_note + note_status='pending'), зроблені паралельними
сесіями в один день. Вони не бачили один одного, і коментарі Марії висіли
необробленими. Тести тримають те, що після зведення не сміє зламатись:
відбирається тільки відкрите, закривається тільки зроблене, перенесення
старих нотаток безпечне при кожному запуску.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from process_notes import (  # noqa: E402
    close_patch, legacy_inserts, open_notes, resolution_text,
)


def note(**over):
    base = {"id": 1, "opportunity_id": "aaa", "body": "вік 6–12",
            "action": "comment", "created_at": "2026-09-22T10:00:00+00:00",
            "resolved_at": None, "resolution": None, "attempted_at": None}
    base.update(over)
    return base


class OpenNotes(unittest.TestCase):
    def test_takes_open_comment(self):
        groups = open_notes([note()])
        self.assertEqual(list(groups), ["aaa"])
        self.assertEqual(groups["aaa"][0]["body"], "вік 6–12")

    def test_skips_resolved(self):
        self.assertEqual(open_notes([note(resolved_at="2026-09-22T12:00:00+00:00")]), {})

    def test_skips_other_actions(self):
        # approve / skip / verify / remove — це причини вже ухвалених рішень,
        # а не прохання щось зробити.
        for action in ("approve", "skip", "verify", "remove"):
            self.assertEqual(open_notes([note(action=action)]), {}, action)

    def test_skips_already_attempted(self):
        # Спроба вже була, модель нічого не змінила — це питання до людини.
        # Рядок лишається відкритим у зведенні, але LLM його вдруге не читає.
        self.assertEqual(open_notes([note(attempted_at="2026-09-22T11:00:00+00:00")]), {})

    def test_skips_empty_body(self):
        self.assertEqual(open_notes([note(body="   "), note(id=2, body=None)]), {})

    def test_groups_by_record_in_time_order(self):
        rows = [
            note(id=3, opportunity_id="bbb", body="третій", created_at="2026-09-22T12:00:00+00:00"),
            note(id=1, opportunity_id="aaa", body="перший", created_at="2026-09-20T09:00:00+00:00"),
            note(id=2, opportunity_id="aaa", body="другий", created_at="2026-09-21T09:00:00+00:00"),
        ]
        groups = open_notes(rows)
        self.assertEqual([n["body"] for n in groups["aaa"]], ["перший", "другий"])
        self.assertEqual([n["body"] for n in groups["bbb"]], ["третій"])

    def test_works_without_attempted_at_column(self):
        # Поки міграцію 20260923 не застосували, рядок приходить без ключа —
        # відбір це не сміє валити.
        row = note()
        row.pop("attempted_at")
        self.assertEqual(list(open_notes([row])), ["aaa"])


class Closing(unittest.TestCase):
    def test_closes_with_resolution(self):
        closing = close_patch({"age_from": 6, "age_to": 12}, now="2026-09-23T08:00:00+00:00")
        self.assertEqual(closing["resolved_at"], "2026-09-23T08:00:00+00:00")
        self.assertEqual(closing["resolution"],
                         "Застосовано автоматично: змінено вік від, вік до.")

    def test_empty_patch_stays_open(self):
        # Нічого не змінилось — коментар лишається людині. Мовчки поставити
        # resolved_at було б гірше за нинішню біду: питання зникло б і зі
        # зведення, і з картки в адмінці.
        self.assertIsNone(close_patch({}))
        self.assertIsNone(close_patch(None))

    def test_ignores_non_editable_keys(self):
        self.assertIsNone(close_patch({"updated_at": "2026-09-23", "status": "active"}))

    def test_resolution_order_is_stable(self):
        # Порядок полів — наш, не той, у якому їх повернула модель.
        first = resolution_text({"cities": ["Київ"], "title": "Нова назва"})
        second = resolution_text({"title": "Нова назва", "cities": ["Київ"]})
        self.assertEqual(first, second)
        self.assertEqual(first, "Застосовано автоматично: змінено назву, міста.")


class LegacyTransfer(unittest.TestCase):
    ROWS = [{"id": "aaa", "moderation_note": " це Київ, офлайн ",
             "updated_at": "2026-09-22T10:00:00+00:00"}]

    def test_moves_note_into_table(self):
        rows = legacy_inserts(self.ROWS, set())
        self.assertEqual(rows, [{
            "opportunity_id": "aaa", "body": "це Київ, офлайн",
            "action": "comment", "created_at": "2026-09-22T10:00:00+00:00",
        }])

    def test_idempotent(self):
        # Міст працює щогодини: той самий текст не сміє задвоїтись, інакше
        # людина двічі побачить те саме питання.
        self.assertEqual(legacy_inserts(self.ROWS, {("aaa", "це Київ, офлайн")}), [])

    def test_same_text_twice_in_one_run(self):
        doubled = self.ROWS + list(self.ROWS)
        self.assertEqual(len(legacy_inserts(doubled, set())), 1)

    def test_skips_empty(self):
        self.assertEqual(legacy_inserts([{"id": "aaa", "moderation_note": "  "},
                                         {"id": "bbb", "moderation_note": None}], set()), [])

    def test_does_not_mutate_caller_set(self):
        existing = set()
        legacy_inserts(self.ROWS, existing)
        self.assertEqual(existing, set())


if __name__ == "__main__":
    unittest.main()
