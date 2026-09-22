"""«Чекає доказу»: машина сама перечитує сторінку чернетки, якій бракує лише
цитати (22.09.2026). Тут — прогін через підроблений клієнт: справжній ходить
у мережу, а перевірити треба саме добір записів і ворота за хешем."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import ttl_requeue  # noqa: E402

FULL = {"age": "7–12 років", "date": "до 1 жовтня", "cost": "безкоштовно",
        "type": "табір", "place": "Львів"}


def draft(_id, evidence, otype="camp"):
    return {"id": _id, "title": f"Запис {_id}", "source": "Тест",
            "source_url": f"https://example.com/{_id}", "opportunity_type": otype,
            "evidence": dict(evidence), "updated_at": "2026-09-01T00:00:00Z"}


class FakeTable:
    """Мінімум, щоб прогін дійшов до кінця. Важливо розрізняти запити за
    статусом: у run() три блоки, і без цього чернетки повертались би й на
    запит TTL (status=active), і на сезонний (closed)."""

    def __init__(self, db, name):
        self.db, self.name, self._hash, self._status = db, name, None, None

    def select(self, *a, **k): return self
    def eq(self, col, val):
        if self.name == "raw_items" and col == "content_hash":
            self._hash = val
        if col == "status":
            self._status = val
        return self
    def is_(self, *a): return self
    def lte(self, *a): return self
    def order(self, *a, **k): return self
    def limit(self, *a): return self
    def update(self, patch):
        self.db["updates"].append(patch)
        return self

    def execute(self):
        if self.name == "raw_items":
            hit = [{"id": "x"}] if self._hash in self.db["known_hashes"] else []
            return mock.Mock(data=hit)
        if self.name == "opportunities" and self._status == "draft":
            return mock.Mock(data=self.db["drafts"])
        return mock.Mock(data=[])


class FakeClient:
    def __init__(self, db): self.db = db
    def table(self, name): return FakeTable(self.db, name)


class ProofRequeue(unittest.TestCase):
    def _run(self, drafts, known_hashes=(), page="новий текст сторінки"):
        db = {"drafts": drafts, "known_hashes": set(known_hashes), "updates": [], "stored": []}
        with mock.patch.object(ttl_requeue, "_fetch_text", return_value=page), \
             mock.patch.object(ttl_requeue.raw_store, "store_raw_items",
                               side_effect=lambda c, src, items: db["stored"].extend(items)), \
             mock.patch.object(ttl_requeue.raw_store, "raw_hash", return_value="HASH"):
            stats = ttl_requeue.run(FakeClient(db))
        return stats, db

    def test_only_drafts_without_quotes_are_read(self):
        stats, db = self._run([draft("a", {}), draft("b", FULL)])
        self.assertEqual(stats["proof_checked"], 1)
        self.assertEqual(stats["proof_requeued"], 1)
        self.assertEqual([i["raw_title"] for i in db["stored"]], ["Запис a"])

    def test_unchanged_page_is_not_re_extracted(self):
        # Текст той самий — нових цитат на ньому не буде, токени не палимо.
        stats, db = self._run([draft("a", {})], known_hashes={"HASH"})
        self.assertEqual(stats["proof_checked"], 1)
        self.assertEqual(stats["proof_requeued"], 0)
        self.assertEqual(db["stored"], [])

    def test_checked_record_goes_to_the_back_of_the_queue(self):
        _, db = self._run([draft("a", {})], known_hashes={"HASH"})
        self.assertTrue(any("updated_at" in p for p in db["updates"]))

    def test_payment_needs_no_date_quote(self):
        ev = {k: v for k, v in FULL.items() if k != "date"}
        stats, _ = self._run([draft("a", ev, otype="allowance")])
        self.assertEqual(stats["proof_checked"], 0)

    def test_dead_page_costs_nothing(self):
        stats, db = self._run([draft("a", {})], page=None)
        self.assertEqual(stats["proof_checked"], 1)
        self.assertEqual(stats["proof_requeued"], 0)
        self.assertEqual(db["stored"], [])

    def test_cap_per_run(self):
        stats, _ = self._run([draft(str(i), {}) for i in range(40)])
        self.assertEqual(stats["proof_checked"], ttl_requeue.PROOF_LIMIT_PER_RUN)


if __name__ == "__main__":
    unittest.main()
