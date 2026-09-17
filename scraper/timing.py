"""Вид можливості за часом: одноразова, періодична, постійна.

Рішення Марії 17.09.2026 (аудит «Дедлайн, подія, сезон»):
  one_time  — вебінар, когортний курс («UF Startup School 2026»), конкретний конкурс;
  periodic  — олімпіада, стипендія, щорічний конкурс, щорічна літня школа,
              гурток із набором у вересні;
  permanent — виплата, допомога, гурток із постійним набором, платформи з
              вільним записом (Coursera, Prometheus, Дія.Освіта).

Тут лише детерміновані правила — те, що можна сказати без моделі й без
жодного токена. Решту вирішує модель за текстом (classify_timing.py,
normalizer.py). Модуль чистий: без бази й мережі, тож повністю під тестами.
"""
from __future__ import annotations

import re

KINDS = ("one_time", "periodic", "permanent")

LABELS = {"one_time": "одноразова", "periodic": "періодична", "permanent": "постійна"}

# Платформи, куди записуються будь-коли й навчаються у власному темпі.
PLATFORM_SOURCES = {"Coursera", "Prometheus", "Дія.Освіта"}

# Виплати й допомога: прийом документів не має сезону, якщо в записі немає строку.
AID_TYPES = {"allowance", "support_payment", "humanitarian", "medical_aid",
             "legal_aid", "shelter"}

# Слід масової дії 11.09.2026: recurrence='ongoing' проставлено за типом, а не
# прочитано з тексту. Такому значенню не віримо.
TYPE_STAMP = "за типом"

# Скрапери гуртків (gurtok, shkolyar, cprs_kyiv, palats_dp, firstpalace_kharkiv,
# gordiy_zp, ocnttum_if, pum_lutsk) самі дописують цю фразу в сирий текст.
# Вона потрапляє в опис і виглядає як факт зі сторінки — хоча це не так.
_INJECTED = re.compile(r"набір\s+постійний,?\s*дедлайну\s+немає\.?", re.IGNORECASE)

# Ознаки сезонного набору в гуртка: «набір у вересні», «з початку навчального року».
_SEASONAL_ENROLLMENT = re.compile(
    r"(?:набір|запис)[^.]{0,40}(?:вересн|серпн|жовтн)"
    r"|(?:\bу|\bз)\s+вересн"
    r"|навчальн\w*\s+р(?:ік|оку)",
    re.IGNORECASE,
)


def clean_text(*parts) -> str:
    """Текст запису без фраз, які дописав скрапер, а не джерело."""
    text = " ".join(p for p in parts if p)
    return re.sub(r"\s+", " ", _INJECTED.sub(" ", text)).strip()


def recurrence_from_text(row: dict) -> str | None:
    """recurrence, якому можна вірити: не проставлений масово за типом."""
    if TYPE_STAMP in (row.get("admin_comment") or ""):
        return None
    rec = row.get("recurrence")
    return rec if rec in ("annual", "ongoing") else None


def months_from_dates(row: dict) -> list[int]:
    """Місяці з дат, які вже є в записі (дедлайн, початок і кінець події)."""
    months = set()
    for key in ("deadline", "event_start_date", "event_end_date"):
        m = re.match(r"^\d{4}-(\d{2})-\d{2}", str(row.get(key) or ""))
        if m:
            months.add(int(m.group(1)))
    return sorted(months)


def clean_months(value) -> list[int] | None:
    """Місяці 1–12 без повторів, за зростанням; порожньо → None."""
    if not isinstance(value, (list, tuple)):
        return None
    out = set()
    for v in value:
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 12:
            out.add(n)
    return sorted(out) or None


def clean_kind(value) -> str | None:
    return value if value in KINDS else None


def rule_kind(row: dict) -> tuple[str, list[int] | None, str] | None:
    """Вид за правилами, без моделі. None — правила не вирішують, питати модель.

    Повертає (вид, місяці сезону, пояснення для модератора).
    """
    kind_hint = row.get("opportunity_type")
    text = clean_text(row.get("summary"), row.get("details"))
    has_dates = any(row.get(k) for k in ("deadline", "event_start_date", "event_end_date"))

    if row.get("source") in PLATFORM_SOURCES:
        return "permanent", None, "платформа з вільним записом (рішення 17.09.2026)"

    if kind_hint == "club":
        if _SEASONAL_ENROLLMENT.search(text):
            return None  # текст каже про сезон набору — хай вирішує модель
        return ("permanent", None,
                "гурток: текст не каже про сезон набору — постійний за "
                "замовчуванням (рішення 17.09.2026), перевірити")

    if kind_hint in AID_TYPES and not has_dates:
        return "permanent", None, "виплата чи допомога без строку в записі"

    if recurrence_from_text(row) == "annual":
        return "periodic", (months_from_dates(row) or None), "у тексті — повторюється щороку"

    return None
