"""Поля «Отримаєш / Треба» не ріжуться посеред слова (03.10.2026).

До цього _clip робив s[:80], і на сторінці Genius Olympiad у «Хто може
подати заявку» стояло «пройти обласний та всеукраїн»."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backfill_teen import CLIP_LIMIT, _clip  # noqa: E402

GENIUS = ("Записатися в МАН, підготувати дослідницьку роботу і пройти обласний "
          "та всеукраїнський етапи")


class ClipTest(unittest.TestCase):
    def test_longer_than_80_kept_whole(self):
        self.assertGreater(len(GENIUS), 80)
        self.assertEqual(_clip(GENIUS), GENIUS)

    def test_too_long_is_dropped_not_cut(self):
        long = "слово " * 40
        self.assertGreater(len(long.strip()), CLIP_LIMIT)
        self.assertIsNone(_clip(long))

    def test_never_cuts_mid_word(self):
        for n in range(1, CLIP_LIMIT + 40):
            s = ("а" * n).strip()
            out = _clip(s)
            self.assertIn(out, (s, None))

    def test_trailing_dot_and_empty(self):
        self.assertEqual(_clip("  Есе до 500 слів. "), "Есе до 500 слів")
        self.assertIsNone(_clip(""))
        self.assertIsNone(_clip(None))


if __name__ == "__main__":
    unittest.main()
