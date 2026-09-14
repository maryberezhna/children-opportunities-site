"""«Безкоштовно» чи «платно»: вердикт лише з цитатою, що справді є на сторінці.

На сайті вартість — два варіанти (рішення Марії 13.09.2026). Вигаданий
«безкоштовно» коштує родині поїздки туди, де попросять гроші, тому
decide_cost() не міняє нічого без дослівної цитати.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from recheck_cost import decide_cost  # noqa: E402

PAGE_FREE = "Гурток працює щосереди. Навчання безкоштовне за кошти міського бюджету."
PAGE_PAID = "Вартість участі: 1600 грн за одну пісню. Заявки до 26 вересня."


def row(**kw):
    base = {"title": "Тест", "cost_type": "partially_free", "price_note": None}
    base.update(kw)
    return base


def out(verdict, evidence, price="", confidence=0.9, page_kind="one_opportunity"):
    return {"verdict": verdict, "evidence": evidence, "price": price,
            "confidence": confidence, "page_kind": page_kind}


class DecideCost(unittest.TestCase):
    def test_free_with_quote_becomes_free(self):
        patch, why = decide_cost(row(), out("free", "Навчання безкоштовне за кошти міського бюджету"), PAGE_FREE)
        self.assertEqual(patch, {"cost_type": "free"})
        self.assertIn("безкоштовно", why)

    def test_paid_with_price_on_page_adds_price_note(self):
        patch, _ = decide_cost(row(), out("paid", "Вартість участі: 1600 грн за одну пісню", "1600 грн за одну пісню"), PAGE_PAID)
        self.assertEqual(patch["cost_type"], "paid_affordable")
        self.assertEqual(patch["price_note"], "Платно: 1600 грн за одну пісню")

    def test_price_not_on_page_is_not_written(self):
        patch, _ = decide_cost(row(), out("paid", "Вартість участі: 1600 грн за одну пісню", "900 грн"), PAGE_PAID)
        self.assertNotIn("price_note", patch)

    def test_existing_price_note_is_kept(self):
        patch, _ = decide_cost(row(price_note="Платно: 1600 грн"),
                               out("paid", "Вартість участі: 1600 грн за одну пісню", "1600 грн за одну пісню"), PAGE_PAID)
        self.assertNotIn("price_note", patch)

    def test_no_quote_changes_nothing(self):
        patch, why = decide_cost(row(), out("free", ""), PAGE_FREE)
        self.assertEqual(patch, {})
        self.assertIn("не каже", why)

    def test_unknown_changes_nothing(self):
        patch, _ = decide_cost(row(), out("unknown", "Гурток працює щосереди"), PAGE_FREE)
        self.assertEqual(patch, {})

    def test_low_confidence_changes_nothing(self):
        patch, _ = decide_cost(row(), out("free", "Навчання безкоштовне за кошти міського бюджету", confidence=0.3), PAGE_FREE)
        self.assertEqual(patch, {})

    def test_quote_missing_from_page_is_rejected(self):
        # Модель «процитувала» те, чого на сторінці немає, — це переказ.
        patch, why = decide_cost(row(), out("free", "Участь абсолютно безкоштовна для всіх дітей"), PAGE_PAID)
        self.assertEqual(patch, {})
        self.assertIn("цитати на сторінці немає", why)

    def test_already_paid_premium_stays(self):
        patch, why = decide_cost(row(cost_type="paid_premium", price_note="є"),
                                 out("paid", "Вартість участі: 1600 грн за одну пісню"), PAGE_PAID)
        self.assertEqual(patch, {})
        self.assertIn("без змін", why)

    def test_already_free_stays(self):
        patch, why = decide_cost(row(cost_type="free"), out("free", "Навчання безкоштовне за кошти міського бюджету"), PAGE_FREE)
        self.assertEqual(patch, {})
        self.assertIn("без змін", why)

    def test_partially_funded_is_not_free(self):
        # UWC, прогін 13.09.2026: «may be fully or partially funded» — модель
        # сказала free, але частина родин платить.
        q = "Depending on demonstrated need, the offer may be fully or partially funded."
        patch, why = decide_cost(row(cost_type=None), out("free", q), q)
        self.assertEqual(patch, {})
        self.assertIn("не для всіх", why)

    def test_ukrainian_partial_is_not_free(self):
        q = "Навчання безкоштовне для пільгових категорій, для інших — часткова оплата."
        patch, _ = decide_cost(row(), out("free", q), q)
        self.assertEqual(patch, {})

    def test_listing_page_verdict_is_rejected(self):
        # МАН, прогін 14.09.2026: головна man.gov.ua, «участь безплатна» — під
        # семінарами для педагогів, а не під літньою STEM-школою.
        q = "Коли: 19 вересня - 19 жовтня 2026 участь безплатна"
        patch, why = decide_cost(row(), out("free", q, page_kind="listing_or_org"), q)
        self.assertEqual(patch, {})
        self.assertIn("не про одну можливість", why)

    def test_missing_page_kind_is_rejected(self):
        q = "Навчання безкоштовне за кошти міського бюджету"
        o = out("free", q); o.pop("page_kind")
        patch, _ = decide_cost(row(), o, q)
        self.assertEqual(patch, {})


if __name__ == "__main__":
    unittest.main()
