"""Цитати в записах агента-розвідника.

23.09.2026. Сухий прогін по живій черзі показав: зелених буде НУЛЬ. 18 із 25
чернеток прийшли від агента, і в усіх 18 поле `evidence` було порожнє — агент
цитат не збирав узагалі. А ще порядок: `to_record()` кликав `_sanitize()` ДО
того, як сторінку прочитано, тож гурток «8–14 років» виходив як 0–18 з
приміткою «здогад без цитати, не збережено».

Тут стережемо три речі:
  · цитата, якої на сторінці немає, не зараховується;
  · поле з цитатою санітайзер не стирає, а без цитати — стирає;
  · запис від агента з усіма пʼятьма цитатами проходить механіку auto_review.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import auto_review  # noqa: E402
from discover_agent import (VERIFY_TOOL, build_record, finalize_record,  # noqa: E402
                            page_evidence, quotes_line, to_record)
from proof import PROOF_KEYS, missing_proof  # noqa: E402

REGION = {"name": "Україна", "audience": "для дітей в Україні", "hint": "українською"}

# Сторінка, яку агент справді читає: усе, що потрібно для пʼяти полів, на ній
# написано прямим текстом.
PAGE = (
    "Обласний центр науково-технічної творчості учнівської молоді. "
    "Гурток «Юний робототехнік» — заняття для дітей 8–14 років. "
    "Навчання безкоштовне. Заняття відбуваються в Житомирі, вулиця Небесної Сотні, 5. "
    "Набір триває щороку у вересні."
)

CANDIDATE = {
    "title": "Гурток «Юний робототехнік» — Обласний центр НТТУМ",
    "summary": ("Безкоштовний гурток робототехніки для дітей 8–14 років при обласному "
                "центрі науково-технічної творчості в Житомирі. Набір триває щороку у вересні."),
    "url": "https://ocnttum.example/robot",
    "age_from": 8,
    "age_to": 14,
    "opportunity_type": "club",
    "cost_type": "free",
    "recurrence": "annual",
    "format": "offline",
    "cities": ["Житомир"],
    "countries": ["ua"],
    "is_international": False,
}

# Те, що модель повертає в VERIFY_TOOL: цитати слово в слово зі сторінки.
QUOTES = {
    "age": "заняття для дітей 8–14 років",
    "date": "Набір триває щороку у вересні",
    "cost": "Навчання безкоштовне",
    "type": "Гурток «Юний робототехнік»",
    "place": "Заняття відбуваються в Житомирі",
}


def record(evidence=None, page=""):
    return to_record(CANDIDATE, "робототехніка", REGION, evidence, page)


class ToolSchema(unittest.TestCase):
    def test_evidence_keys_are_the_ones_auto_review_reads(self):
        # Цитата під власною назвою не зарахувалась би: auto_review читає
        # рівно ці ключі (proof.PROOF_KEYS).
        props = VERIFY_TOOL["input_schema"]["properties"]["evidence"]["properties"]
        self.assertEqual(tuple(props), PROOF_KEYS)
        self.assertIn("evidence", VERIFY_TOOL["input_schema"]["required"])


class QuotesAreCheckedAgainstThePage(unittest.TestCase):
    """Нічого не вигадувати: цитати, якої на сторінці немає, для нас нема."""

    def test_quotes_from_the_page_are_kept(self):
        self.assertEqual(set(page_evidence({"evidence": QUOTES}, PAGE)), set(PROOF_KEYS))

    def test_invented_quote_is_not_counted(self):
        invented = dict(QUOTES, age="для дітей 3–6 років", cost="вартість 1200 грн на місяць")
        got = page_evidence({"evidence": invented}, PAGE)
        self.assertNotIn("age", got)
        self.assertNotIn("cost", got)
        self.assertIn("date", got)  # решта цитат від цього не страждає

    def test_model_conclusion_instead_of_quote_is_not_counted(self):
        # Найчастіший випадок: замість цитати модель пише власний висновок.
        got = page_evidence({"evidence": {"cost": "гуртки в таких центрах зазвичай безкоштовні"}}, PAGE)
        self.assertEqual(got, {})

    def test_no_evidence_at_all(self):
        self.assertEqual(page_evidence({}, PAGE), {})

    def test_quotes_line_names_what_is_missing(self):
        line = quotes_line({"age": "заняття для дітей 8–14 років"})
        self.assertIn("1/5", line)
        self.assertIn("вартість", line)
        self.assertIn("усі поля", quotes_line(QUOTES))


class SanitizerKeepsWhatIsQuoted(unittest.TestCase):
    """Порядок: цитати мають бути в записі ДО `_sanitize()`."""

    def test_build_record_does_not_sanitize(self):
        # Саме тут і ламався порядок: поки санітайзер стояв усередині
        # to_record(), вік стирався ще до того, як агент відкривав сторінку.
        # Тепер build_record() лишає запис сирим — його нормалізує
        # finalize_record(), уже з цитатами.
        raw = build_record(CANDIDATE, "робототехніка", REGION)
        self.assertEqual((raw["age_from"], raw["age_to"]), (8, 14))
        self.assertNotIn("evidence", raw)
        done = finalize_record(raw, page_evidence({"evidence": QUOTES}, PAGE), PAGE)
        self.assertEqual((done["age_from"], done["age_to"]), (8, 14))

    def test_age_with_quote_survives(self):
        rec = record(page_evidence({"evidence": QUOTES}, PAGE), PAGE)
        self.assertEqual((rec["age_from"], rec["age_to"]), (8, 14))
        self.assertNotIn("здогад без цитати", rec.get("admin_comment") or "")

    def test_age_without_quote_is_wiped(self):
        # Так поводився агент до 23.09.2026 — і так він поводиться досі там,
        # де сторінка не відкрилась: вік лишається технічним 0–18.
        rec = record()
        self.assertEqual((rec["age_from"], rec["age_to"]), (0, 18))
        self.assertIn("здогад без цитати", rec["admin_comment"])

    def test_all_five_fields_are_proven(self):
        self.assertEqual(missing_proof(record(page_evidence({"evidence": QUOTES}, PAGE), PAGE)), [])
        self.assertEqual(missing_proof(record()), list(PROOF_KEYS))


class ThroughAutoReview(unittest.TestCase):
    """Коридор auto_review — той самий, що судить усі чернетки."""

    def row(self, rec):
        return {**rec, "id": 1, "link_status": "ok"}

    def test_record_with_five_quotes_passes_mechanics(self):
        # None означає «механіка більше не тримає» — далі слово за суддею,
        # і це єдиний шлях у зелений коридор. Рівень довіри джерела третій:
        # агент приносить сайт, якого ми ще не бачили (він більше не ворота).
        rec = record(page_evidence({"evidence": QUOTES}, PAGE), PAGE)
        self.assertIsNone(auto_review.mechanical(self.row(rec), trust_tier=3))

    def test_record_without_quotes_is_held(self):
        corridor, reason = auto_review.mechanical(self.row(record()), trust_tier=3)
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("третього рівня довіри", reason)


if __name__ == "__main__":
    unittest.main()
