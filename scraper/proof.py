"""Докази на обовʼязкові поля: дослівні цитати зі сторінки джерела.

Світлофор (рішення Марії 22.09.2026): запис зелений, тобто публікується сам,
лише коли на кожне з пʼяти обовʼязкових полів є дослівна цитата зі сторінки.
Поле, яке заповнене здогадом чи дефолтом (вік 0–18 «технічно», тип «course»
замість типу, «набір постійний» у гуртка), цитати не має і зеленим бути не
може — такий запис жовтий, до людини, з переліком, на що бракує цитати.

Це єдине місце, де конвеєр читає lib/publish-criteria.json: normalizer і
auto_review беруть визначення звідси. JS-дзеркало — lib/required.js
(missingProof).
"""
import json
import re
from pathlib import Path

# Нормалізація тексту та сама, що й у планової перевірки (timing._norm):
# лапки, тире й пробіли моделі й сторінки збігаються не завжди.
from timing import _norm

_CRITERIA_PATH = Path(__file__).resolve().parents[1] / "lib" / "publish-criteria.json"
with open(_CRITERIA_PATH, encoding="utf-8") as _f:
    PUBLISH_CRITERIA = json.load(_f)

PROOF_KEYS = tuple(PUBLISH_CRITERIA["order"])
PROOF_LABELS = {k: PUBLISH_CRITERIA["required"][k]["label"] for k in PROOF_KEYS}
MAX_QUOTE = 240


def quote_in_text(quote, text) -> bool:
    """Чи цитата справді стоїть у тексті. Коротка цитата («онлайн», «м. Львів»)
    має збігтися цілком; довгу приймаємо, якщо в тексті є хоч один її
    фрагмент від 12 знаків — модель інколи склеює два речення крапкою."""
    q = _norm(quote) if isinstance(quote, str) else ""
    if len(q) < 4:
        return False
    hay = _norm(text)
    if q[:60] in hay:
        return True
    for frag in re.split(r"[;…]|\.\.\.|\s-\s|[.!?]\s", q):
        frag = frag.strip(" .,:")
        if len(frag) >= 12 and frag[:40] in hay:
            return True
    return False


def verify_evidence(evidence, text) -> dict:
    """Лишає тільки цитати, які є в тексті; решту відкидає мовчки — модель
    інколи замість цитати пише власний висновок («табір зазвичай платний»)."""
    out = {}
    if not isinstance(evidence, dict):
        return out
    for key in PROOF_KEYS:
        quote = evidence.get(key)
        if isinstance(quote, str) and quote_in_text(quote, text):
            out[key] = re.sub(r"\s+", " ", quote).strip()[:MAX_QUOTE]
    return out


def missing_proof(data: dict) -> list:
    """Ключі обовʼязкових полів без цитати, у сталому порядку. Виняток для
    виплат (дата не обовʼязкова) той самий, що й у missing_required."""
    ev = data.get("evidence") or {}
    if not isinstance(ev, dict):
        ev = {}
    otype = data.get("opportunity_type")
    missing = []
    for key in PROOF_KEYS:
        crit = PUBLISH_CRITERIA["required"][key]
        if otype in crit.get("except_types", ()):
            continue
        if not (isinstance(ev.get(key), str) and ev[key].strip()):
            missing.append(key)
    return missing


def drop_proof(data: dict, key: str) -> None:
    """Поле поставлено не з тексту (дефолт, здогад, заглушка) — цитата на
    нього більше не доказ."""
    ev = data.get("evidence")
    if isinstance(ev, dict):
        ev.pop(key, None)
