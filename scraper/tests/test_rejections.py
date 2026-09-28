"""Відмови людини вчать пошук (Марія, 28.09.2026: «не шукати такі можливості»)."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from rejections import avoid_block, load_reasons, teach_lines  # noqa: E402


def row(oid, reason, action="reject", comment=None):
    after = {"action": action, "reason": reason}
    if comment:
        after["comment"] = comment
    return {"opportunity_id": oid, "after": after}


class TeachLines(unittest.TestCase):
    R = load_reasons()
    T = {"a": "Гурток малювання в ЦПР", "b": "Той самий запис", "c": "Грант для ГО", "d": "Гурток малювання в ЦПР"}

    def test_reasons_shared_with_admin(self):
        # Той самий файл, що читає адмінка: коди й позначки на місці.
        self.assertIn("club", self.R)
        self.assertTrue(self.R["club"]["teach"])
        self.assertFalse(self.R["duplicate"]["teach"])

    def test_only_teaching_rejections(self):
        lines = teach_lines([row("a", "club"), row("b", "duplicate"), row("c", "for_adults", comment="для ГО")],
                            self.T, self.R)
        self.assertEqual(lines, [
            "«Гурток малювання в ЦПР» — гурток чи секція — такі не шукаємо",
            "«Грант для ГО» — для дорослих чи батьків, а не про дитину: для ГО",
        ])

    def test_skip_without_reason_is_ignored(self):
        self.assertEqual(teach_lines([row("a", None, action="skip")], self.T, self.R), [])

    def test_same_title_once(self):
        self.assertEqual(len(teach_lines([row("a", "club"), row("d", "club")], self.T, self.R)), 1)

    def test_limit(self):
        titles = {str(i): f"Запис {i}" for i in range(50)}
        rows = [row(str(i), "club") for i in range(50)]
        self.assertEqual(len(teach_lines(rows, titles, self.R, limit=5)), 5)

    def test_block_empty_without_lines(self):
        self.assertEqual(avoid_block([]), "")
        self.assertIn("НЕ ПРИНОСЬ", avoid_block(["«x» — y"]))


if __name__ == "__main__":
    unittest.main()
