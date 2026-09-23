"""Програми лише для зарахованих студентів ЗВО — не наші (Марія, 23.09.2026,
про BEST і IAESTE: «не наше, прибрати»).

Це НЕ про вік. «18+ — наша авдиторія», і молодіжний обмін Erasmus+ для
18-річних лишається нашим. Різниця в тому, ким треба БУТИ: випускник 11
класу, якому щойно виповнилось 18, у BEST не потрапить — туди треба вже
бути студентом інженерної спеціальності.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from normalizer import looks_university_only, _sanitize  # noqa: E402


def row(title, summary, details=""):
    return {"title": title, "summary": summary, "details": details}


class NotOurs(unittest.TestCase):
    """Справжні тексти з бази — обидва записи, які назвала Марія."""

    def test_best(self):
        self.assertTrue(looks_university_only(row(
            "BEST courses of technology — технічні курси BEST для студентів інженерних спеціальностей",
            "Курси тривалістю 1-2 тижні для студентів-інженерів, які організовує BEST "
            "(Board of European Students of Technology).")))

    def test_iaeste(self):
        self.assertTrue(looks_university_only(row(
            "IAESTE Volunteering Programme",
            "Волонтерські можливості для колишніх чи поточних стажистів IAESTE. "
            "Програма доступна для бакалаврів університетів.")))


class OursAndStays(unittest.TestCase):
    """Кожен випадок нижче колись міг би хибно спрацювати — і не сміє."""

    def test_school_and_university_together(self):
        # «для учнів ТА студентів» — школяр потрапляє, отже наше.
        self.assertFalse(looks_university_only(row(
            "Економічна Олімпіада в Україні",
            "Для учнів 8–11 класів та студентів 1–2 курсів коледжів.")))

    def test_student_discount_is_not_a_requirement(self):
        # «для студентів 500 грн» — це знижка, а не умова участі.
        self.assertFalse(looks_university_only(row(
            "Школа Рекрута",
            "Вишкіл для цивільних і молоді 17+. Вартість 1000 грн, для студентів 500 грн.")))

    def test_high_schoolers(self):
        self.assertFalse(looks_university_only(row(
            "Boot Camp — ІТ-проєкт для старшокласників",
            "Проєкт для старшокласників; студентів технічних спеціальностей теж беруть.")))

    def test_eighteen_plus_is_ours(self):
        # Рішення Марії 21.09.2026: програми з 18 років не відхиляємо.
        self.assertFalse(looks_university_only(row(
            'Молодіжний обмін Erasmus+ "Life Compass"',
            "Молодіжний обмін у Закопане, Польща, для молоді 18–25 років.")))

    def test_plain_volunteering(self):
        self.assertFalse(looks_university_only(row(
            "SCI — довгострокове волонтерство",
            "Міжнародне волонтерство на 1–12 місяців. Для всіх від 18 років.")))


class GateSendsItToHuman(unittest.TestCase):
    """Правило не викидає запис мовчки: воно ставить чернетку й пояснює чому.
    Детектор евристичний, тож останнє слово за людиною."""

    def test_draft_with_reason(self):
        out = _sanitize({
            "status": "active", "age_from": 18, "age_to": 18,
            "title": "BEST courses of technology",
            "summary": "Курси для студентів інженерних спеціальностей.",
            "deadline": "2027-10-01", "cost_type": "free",
            "opportunity_type": "course", "format": "offline",
            "evidence": {"age": "18", "date": "2027", "cost": "free", "type": "курси", "place": "offline"},
        })
        self.assertEqual(out["status"], "draft")
        self.assertIn("лише для зарахованих студентів ЗВО", out["admin_comment"])


if __name__ == "__main__":
    unittest.main()
