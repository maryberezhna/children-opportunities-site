"""Світлофор, крок 1 (22.09.2026): без дослівної цитати на кожне обовʼязкове
поле запис не публікується сам. Ці тести стережуть саме ворота."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from proof import quote_in_text, verify_evidence, missing_proof  # noqa: E402
from normalizer import _sanitize  # noqa: E402
from db import merge_patch  # noqa: E402
import auto_review  # noqa: E402

PAGE = ("Літній табір «Веселка» у Карпатах. Для дітей 7–12 років. Заїзд 3–10 липня 2027, "
        "заявки приймаються до 15 червня 2027. Участь безкоштовна для дітей ВПО. "
        "Місце: с. Славське, Львівська область.")

FULL_EVIDENCE = {
    "age": "Для дітей 7–12 років",
    "date": "заявки приймаються до 15 червня 2027",
    "cost": "Участь безкоштовна",
    "type": "Літній табір «Веселка»",
    "place": "с. Славське, Львівська область",
}


def full(**over):
    data = {
        "status": "active", "title": "Літній табір «Веселка» у Карпатах",
        "summary": "Безкоштовний табір для дітей 7–12 років у Карпатах, заявки до 15 червня.",
        "age_from": 7, "age_to": 12, "deadline": "2027-06-15", "cost_type": "free",
        "opportunity_type": "camp", "format": "offline", "cities": ["Славське"],
        "evidence": dict(FULL_EVIDENCE),
    }
    data.update(over)
    return data


class QuoteInText(unittest.TestCase):
    def test_exact_and_normalised(self):
        self.assertTrue(quote_in_text("Для дітей 7–12 років", PAGE))
        # Лапки й тире моделі не мусять збігатись зі сторінкою.
        self.assertTrue(quote_in_text('Літній табір "Веселка"', PAGE))
        self.assertTrue(quote_in_text("для дітей 7-12 років", PAGE))

    def test_short_quote_must_match_whole(self):
        self.assertTrue(quote_in_text("Славське", PAGE))
        self.assertFalse(quote_in_text("Київ", PAGE))
        self.assertFalse(quote_in_text("", PAGE))
        self.assertFalse(quote_in_text(None, PAGE))

    def test_long_quote_accepted_by_fragment(self):
        glued = "Участь безкоштовна для дітей ВПО. І ще щось, чого на сторінці немає"
        self.assertTrue(quote_in_text(glued, PAGE))

    def test_conclusion_is_not_a_quote(self):
        self.assertFalse(quote_in_text("табори зазвичай платні", PAGE))


class VerifyEvidence(unittest.TestCase):
    def test_keeps_only_real_quotes(self):
        ev = dict(FULL_EVIDENCE, cost="вартість 5000 грн")  # такого на сторінці немає
        out = verify_evidence(ev, PAGE)
        self.assertNotIn("cost", out)
        self.assertEqual(set(out), {"age", "date", "type", "place"})

    def test_garbage_shapes(self):
        self.assertEqual(verify_evidence(None, PAGE), {})
        self.assertEqual(verify_evidence({"age": 12, "x": "y"}, PAGE), {})


class MissingProof(unittest.TestCase):
    def test_full_needs_nothing(self):
        self.assertEqual(missing_proof(full()), [])

    def test_empty_evidence_means_all_five(self):
        self.assertEqual(missing_proof(full(evidence={})),
                         ["age", "date", "cost", "type", "place"])

    def test_payment_needs_no_date_quote(self):
        row = full(opportunity_type="allowance", deadline=None,
                   evidence={k: v for k, v in FULL_EVIDENCE.items() if k != "date"})
        self.assertEqual(missing_proof(row), [])


class SanitizeProofGate(unittest.TestCase):
    def test_full_with_quotes_stays_active(self):
        out = _sanitize(full())
        self.assertEqual(out["status"], "active")
        self.assertNotIn("без цитати", out.get("admin_comment") or "")

    def test_missing_quote_makes_draft_with_reason(self):
        ev = {k: v for k, v in FULL_EVIDENCE.items() if k != "cost"}
        out = _sanitize(full(evidence=ev))
        self.assertEqual(out["status"], "draft")
        self.assertIn("без цитати зі сторінки — вартість", out["admin_comment"])

    def test_no_evidence_at_all_is_yellow(self):
        out = _sanitize(full(evidence={}))
        self.assertEqual(out["status"], "draft")
        self.assertIn("без цитати", out["admin_comment"])

    def test_default_age_drops_its_quote(self):
        out = _sanitize(full(age_from=None, age_to=None))
        self.assertNotIn("age", out["evidence"])
        self.assertEqual(out["status"], "draft")

    def test_club_default_drops_date_quote(self):
        out = _sanitize(full(opportunity_type="club", deadline=None,
                             evidence=dict(FULL_EVIDENCE, type="гурток")))
        self.assertTrue(out.get("timing_assumed"))
        self.assertNotIn("date", out["evidence"])
        self.assertEqual(out["status"], "draft")
        self.assertIn("дата", out["admin_comment"])

    def test_type_stub_drops_type_quote(self):
        out = _sanitize(full(opportunity_type="щось"))
        self.assertEqual(out["opportunity_type"], "course")
        self.assertNotIn("type", out["evidence"])
        self.assertEqual(out["status"], "draft")

    def test_missing_field_is_reported_once(self):
        # Вартості немає зовсім: вона в «бракує», а не ще раз у «без цитати».
        out = _sanitize(full(cost_type=None, summary="Табір для дітей 7–12 років у Карпатах.",
                             evidence={k: v for k, v in FULL_EVIDENCE.items() if k != "cost"}))
        self.assertIn("бракує — вартість", out["admin_comment"])
        self.assertNotIn("без цитати", out["admin_comment"])


class CorridorNeedsProof(unittest.TestCase):
    def _row(self, **over):
        row = full(link_status="ok", source="Тест", child_needs=[])
        row.update(over)
        return row

    def test_no_quotes_is_yellow(self):
        corridor, reason = auto_review.mechanical(self._row(evidence={}), trust_tier=2)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("без цитати", reason)

    def test_with_quotes_passes_mechanics(self):
        self.assertIsNone(auto_review.mechanical(self._row(), trust_tier=2))


class AgeNeedsQuote(unittest.TestCase):
    """Крок 2 (23.09.2026, Марія: «здогад машини — заборонити»). Вік, під який
    немає дослівної фрази джерела, не зберігається зовсім: у картці він
    читався як факт нарівні з віком, прочитаним у тексті."""

    # Справжня сторінка, з якої почалась розмова: Eurodesk про EPAS. Віку на
    # ній немає — лише «students». Модель віддала 12–18, а в іншому проході
    # тієї самої сторінки 14–17.
    EPAS = ("European Parliament Ambassador School (EPAS). Free school programme on EU topics "
            "funded by the European Parliament. Open to motivated students and teachers across "
            "the EU. Ongoing.")

    def _epas(self, **over):
        row = full(title="European Parliament Ambassador School (EPAS)",
                   summary="Безкоштовна шкільна програма про ЄС для учнів і вчителів.",
                   age_from=12, age_to=18, deadline=None, recurrence="ongoing",
                   opportunity_type="course", format="offline", cities=[],
                   evidence={"cost": "Free school programme", "type": "school programme"})
        row.update(over)
        return row

    def test_model_guess_is_not_stored(self):
        out = _sanitize(self._epas(), self.EPAS)
        self.assertEqual((out["age_from"], out["age_to"]), (0, 18))
        self.assertNotIn("age", out["evidence"])
        # Модератор бачить, що саме машина припускала, — і що це не збережено.
        self.assertIn("вік 12–18 — здогад без цитати", out["admin_comment"])
        self.assertEqual(out["status"], "draft")

    def test_quoted_age_survives(self):
        page = self.EPAS.replace("motivated students", "students (14-18 years old)")
        out = _sanitize(self._epas(age_from=14, age_to=18,
                                   evidence={"age": "students (14-18 years old)"}), page)
        self.assertEqual((out["age_from"], out["age_to"]), (14, 18))
        self.assertEqual(out["evidence"]["age"], "students (14-18 years old)")


class MergeKeepsQuotes(unittest.TestCase):
    def test_new_quotes_merge_into_old(self):
        patch = merge_patch({"status": "active", "evidence": {"age": "7–12 років", "cost": "безкоштовно"}},
                            {"evidence": {"cost": "участь безкоштовна", "date": ""}})
        self.assertEqual(patch["evidence"], {"age": "7–12 років", "cost": "участь безкоштовна"})

    def test_empty_evidence_does_not_erase(self):
        patch = merge_patch({"status": "active", "evidence": {"age": "7–12 років"}}, {"evidence": {}})
        self.assertEqual(patch["evidence"], {"age": "7–12 років"})


if __name__ == "__main__":
    unittest.main()
