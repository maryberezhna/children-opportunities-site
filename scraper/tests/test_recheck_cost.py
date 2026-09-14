"""«Безкоштовно» чи «платно»: вердикт лише з цитатою, що справді є на сторінці.

На сайті вартість — два варіанти (рішення Марії 13.09.2026). Вигаданий
«безкоштовно» коштує родині поїздки туди, де попросять гроші, тому
decide_cost() не міняє нічого без дослівної цитати.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from recheck_cost import (  # noqa: E402
    decide_cost, decide_from_search, extract_json_object, page_mentions_title,
    UsageLimitReached, _stop_if_limit, strip_api_failure_notes,
)

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



class SearchOtherSources(unittest.TestCase):
    def test_json_object_is_extracted_from_prose(self):
        text = 'Ось що знайшов: {"verdict": "paid", "url": "https://x.ua"} — все.'
        self.assertEqual(extract_json_object(text)["verdict"], "paid")

    def test_no_json_gives_empty(self):
        self.assertEqual(extract_json_object("нічого не знайшов"), {})

    def test_page_must_mention_the_programme(self):
        self.assertTrue(page_mentions_title("Клуб боксу РІНГ", "Секція боксу «Рінг»: абонемент 600 грн"))
        self.assertFalse(page_mentions_title("Клуб боксу РІНГ", "Секція плавання: абонемент 600 грн"))

    def test_generic_words_do_not_count(self):
        # «гурток» і «дітей» є на будь-якій сторінці довідника — це не збіг.
        self.assertFalse(page_mentions_title("Гурток для дітей", "Інший гурток для дітей, оплата 300 грн"))

    def test_verdict_from_other_page_is_accepted_with_source(self):
        page = "Школа танцю WAY UP DANCE, Черкаси. Вартість заняття 150 грн."
        o = {"verdict": "paid", "page_kind": "one_opportunity", "evidence": "Вартість заняття 150 грн",
             "url": "https://wayup.ck.ua/", "price": "150 грн", "confidence": 0.9}
        patch, why = decide_from_search(row(title="WAY UP DANCE"), o, page)
        self.assertEqual(patch["cost_type"], "paid_affordable")
        self.assertIn("джерело: wayup.ck.ua", why)

    def test_other_page_about_different_programme_is_rejected(self):
        page = "Студія живопису «Акварель». Вартість заняття 150 грн."
        o = {"verdict": "paid", "page_kind": "one_opportunity", "evidence": "Вартість заняття 150 грн",
             "url": "https://akvarel.ua/", "confidence": 0.9}
        patch, why = decide_from_search(row(title="WAY UP DANCE"), o, page)
        self.assertEqual(patch, {})
        self.assertIn("не про цю програму", why)

    def test_unopenable_source_is_rejected(self):
        o = {"verdict": "free", "page_kind": "one_opportunity", "evidence": "Участь безкоштовна",
             "url": "https://dead.example/", "confidence": 0.9}
        patch, why = decide_from_search(row(title="WAY UP DANCE"), o, None)
        self.assertEqual(patch, {})
        self.assertIn("не відкривається", why)

    def test_unknown_from_search_changes_nothing(self):
        patch, why = decide_from_search(row(), {"verdict": "unknown"}, "будь-що")
        self.assertEqual(patch, {})
        self.assertIn("нічого", why)



class GuardsFromSearchRun(unittest.TestCase):
    """Помилки пробного прогону з пошуком, 14.09.2026."""

    def test_budget_institution_is_not_free(self):
        q = "Центр юних техніків є комунальною, бюджетною, неприбутковою установою"
        patch, why = decide_cost(row(title="Клуб юних техніків Кварц"), out("free", q), q)
        self.assertEqual(patch, {})
        self.assertIn("здогад", why)

    def test_explicit_free_in_other_language_is_accepted(self):
        q = "Die Teilnahme ist kostenlos für alle Kinder aus der Ukraine"
        patch, _ = decide_cost(row(), out("free", q), q)
        self.assertEqual(patch, {"cost_type": "free"})

    def test_generic_erasmus_match_is_not_enough(self):
        page = "Scambio giovanile Erasmus in Grecia. Quota di 40 euro per il tesseramento."
        self.assertFalse(page_mentions_title('Молодіжний обмін Erasmus+ "O-live T.R.E.E.S." в Греції', page))

    def test_two_distinctive_words_match(self):
        page = "Молодіжний обмін O-live у Греції: внесок 40 євро"
        self.assertTrue(page_mentions_title('Молодіжний обмін Erasmus+ "O-live T.R.E.E.S." в Греції', page))



class ApiFailures(unittest.TestCase):
    """14.09.2026: вичерпаний ліміт API дав дев'ять хибних діагнозів у модерації."""

    def test_usage_limit_stops_the_run(self):
        msg = ("{'type': 'error', 'error': {'type': 'invalid_request_error', 'message': "
               "'You have reached your specified API usage limits.'}}")
        with self.assertRaises(UsageLimitReached):
            _stop_if_limit(msg)

    def test_other_errors_do_not_stop(self):
        _stop_if_limit("overloaded_error")  # не кидає

    def test_false_notes_are_stripped_but_real_ones_kept(self):
        c = ("💡 пропозиція · recheck-cost · безкоштовно не для всіх (часткове фінансування чи пільга) — у модерацію"
             " · recheck-cost · в інших джерелах про оплату нічого"
             " · recheck-cost · сторінка не каже, чи платить родина")
        self.assertEqual(strip_api_failure_notes(c),
                         "💡 пропозиція · recheck-cost · безкоштовно не для всіх (часткове фінансування чи пільга) — у модерацію")

    def test_nothing_to_strip(self):
        self.assertEqual(strip_api_failure_notes("recheck-cost · платно: «$75»"), "recheck-cost · платно: «$75»")


if __name__ == "__main__":
    unittest.main()
