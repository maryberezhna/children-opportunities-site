"""Подарунковий місяць Dityam+ за участь в онлайн-олімпіаді.

Кожен учасник олімпіади отримує 30 днів Dityam+ (billing_period = gift,
gift_until). Коли місяць минув, розсилка має зупинитись сама: людина за
підписку не платила, і слати їй добірки далі — це безкоштовна підписка
назавжди. Платних підписників це не сміє зачепити.
"""
import importlib.util
import pathlib
import sys
import types
import unittest
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import httpx  # noqa: F401
except ImportError:  # локально без залежностей скрапера
    sys.modules["httpx"] = types.ModuleType("httpx")


def load_module():
    spec = importlib.util.spec_from_file_location("personal_digest", ROOT / "personal_digest.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FakeQuery:
    def __init__(self, log):
        self.log = log
        self.patch = None

    def update(self, patch):
        self.patch = patch
        return self

    def eq(self, column, value):
        self.log.append((column, value, self.patch))
        return self

    def execute(self):
        return types.SimpleNamespace(data=[])


class FakeClient:
    def __init__(self):
        self.log = []

    def table(self, name):
        assert name == "digest_subscribers"
        return FakeQuery(self.log)


NOW = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


class GiftExpiryTest(unittest.TestCase):
    def setUp(self):
        self.pd = load_module()
        self.sent = []
        self.pd.send_telegram = lambda chat_id, text, reply_markup=None: self.sent.append((chat_id, text)) or True

    def test_gift_expired(self):
        pd = self.pd
        self.assertFalse(pd.gift_expired({"billing_period": "gift", "gift_until": "2026-11-20T00:00:00+00:00"}, NOW))
        self.assertTrue(pd.gift_expired({"billing_period": "gift", "gift_until": "2026-11-05T00:00:00+00:00"}, NOW))
        self.assertTrue(pd.gift_expired({"billing_period": "gift", "gift_until": None}, NOW))
        # платні підписники — ніколи
        self.assertFalse(pd.gift_expired({"billing_period": "monthly", "gift_until": "2026-01-01T00:00:00+00:00"}, NOW))
        self.assertFalse(pd.gift_expired({"billing_period": None}, NOW))

    def test_expire_gifts_pauses_and_notifies_once(self):
        pd = self.pd
        client = FakeClient()
        subs = [
            {"id": "paid", "billing_period": "monthly", "telegram_chat_id": "1"},
            {"id": "fresh", "billing_period": "gift", "gift_until": "2999-01-01T00:00:00+00:00", "telegram_chat_id": "2"},
            {"id": "old", "billing_period": "gift", "gift_until": "2026-01-01T00:00:00+00:00", "telegram_chat_id": "3"},
            {"id": "told", "billing_period": "gift", "gift_until": "2026-01-01T00:00:00+00:00", "telegram_chat_id": "4",
             "gift_notice_at": "2026-02-01T00:00:00+00:00"},
        ]
        keep = pd.expire_gifts(client, subs)
        self.assertEqual([s["id"] for s in keep], ["paid", "fresh"])
        self.assertEqual([c for c, _ in self.sent], ["3"])
        self.assertEqual(sorted(v for _, v, _ in client.log), ["old", "told"])
        self.assertTrue(all(p["status"] == "paused" for _, _, p in client.log))

    def test_dry_run_writes_nothing(self):
        pd = self.pd
        client = FakeClient()
        subs = [{"id": "old", "billing_period": "gift", "gift_until": "2026-01-01T00:00:00+00:00", "telegram_chat_id": "3"}]
        self.assertEqual(pd.expire_gifts(client, subs, dry_run=True), [])
        self.assertEqual(client.log, [])
        self.assertEqual(self.sent, [])


if __name__ == "__main__":
    unittest.main()
