"""У платну добірку не йде «набір постійний», поставлений за замовчуванням
(рішення Марії 21.09.2026: на сайті лишаються, у канал і Dityam+ — ні)."""
import importlib.util
import pathlib
import sys
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
try:
    import httpx  # noqa: F401
except ImportError:
    sys.modules["httpx"] = types.ModuleType("httpx")

spec = importlib.util.spec_from_file_location("pd_assumed", ROOT / "personal_digest.py")
pd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pd)


class DropAssumed(unittest.TestCase):
    def test_assumed_permanent_is_left_out(self):
        opps = [{"id": 1, "timing_assumed": True}, {"id": 2, "timing_assumed": False},
                {"id": 3}, {"id": 4, "timing_assumed": None}]
        kept, dropped = pd.drop_assumed(opps)
        self.assertEqual([o["id"] for o in kept], [2, 3, 4])
        self.assertEqual(dropped, 1)


if __name__ == "__main__":
    unittest.main()
