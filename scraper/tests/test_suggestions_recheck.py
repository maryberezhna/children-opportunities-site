"""Пропозиції «потребує людини» щодня звіряються з базою ще раз.

21.09.2026, розбір Марії: троє з шести пропозицій тиждень чекали людини,
хоча записи про ті самі виплати зʼявились у базі того ж дня — просто
пізніше за пропозиції. Дублі ловились лише в момент надходження.
"""
import pathlib
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import process_suggestions as ps  # noqa: E402


class _Query:
    """Мінімальна підробка ланцюжка supabase-py: select/eq/order/limit/execute."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.patch = db, table, {}, None

    def select(self, *_):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def update(self, patch):
        self.patch = patch
        return self

    def execute(self):
        rows = [r for r in self.db[self.table]
                if all(r.get(c) == v for c, v in self.filters.items())]
        if self.patch is not None:
            for r in rows:
                r.update(self.patch)
        return mock.Mock(data=rows)


class _DB:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables, name)


KYIV = "https://kyivcity.gov.ua/news/kompensatsiya/"


def make_db():
    return _DB({
        "opportunity_suggestions": [
            {"id": "a", "status": "needs_human", "url": KYIV, "title": "Київ: компенсація", "contact": None},
            {"id": "b", "status": "needs_human", "url": "https://rivnesoc.gov.ua/x/", "title": "Рівне", "contact": None},
            {"id": "c", "status": "new", "url": KYIV, "title": "Нова, не чіпати", "contact": None},
        ],
        "opportunities": [
            {"slug": "kyiv-komp", "title": "Київ: компенсація до 40 000 грн",
             "status": "active", "source_url": KYIV, "canonical_url": KYIV},
        ],
    })


class RecheckWaiting(unittest.TestCase):
    def setUp(self):
        # Канонізацію URL не перевіряємо тут — лише звірку з базою.
        patcher = mock.patch.object(ps, "canonical_url", side_effect=lambda u: u)
        patcher.start()
        self.addCleanup(patcher.stop)

    def status(self, db, sid):
        return next(r["status"] for r in db.tables["opportunity_suggestions"] if r["id"] == sid)

    def test_waiting_duplicate_is_closed(self):
        db = make_db()
        self.assertEqual(ps.recheck_waiting(db, apply=True), 1)
        self.assertEqual(self.status(db, "a"), "duplicate")

    def test_waiting_without_record_stays_for_human(self):
        db = make_db()
        ps.recheck_waiting(db, apply=True)
        self.assertEqual(self.status(db, "b"), "needs_human")

    def test_new_ones_are_not_touched_here(self):
        db = make_db()
        ps.recheck_waiting(db, apply=True)
        self.assertEqual(self.status(db, "c"), "new")

    def test_dry_run_changes_nothing(self):
        db = make_db()
        self.assertEqual(ps.recheck_waiting(db, apply=False), 1)
        self.assertEqual(self.status(db, "a"), "needs_human")


if __name__ == "__main__":
    unittest.main()
