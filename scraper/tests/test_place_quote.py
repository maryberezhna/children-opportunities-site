"""Слово, що саме називає формат, — цитата на «де» (23.09.2026).

Марія втратила вебінар «Як жити в кайф і сьогодні, і потім»: він чекав у
карантині з причиною «без цитати: формат або місце», поки не минула дата.
Вебінар офлайн не буває, і окремої фрази про «онлайн» джерело не пише.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalizer import _sanitize  # noqa: E402
from proof import place_quote  # noqa: E402

PAGE = ("Безкоштовний вебінар для дівчат 13-18 років про інвестування та фінанси "
        "з Ксюшею Губановою. 22 вересня о 18:00 (за київським часом).")


def base(**over):
    data = {
        "title": "Вебінар «Як жити в кайф і сьогодні, і потім»",
        "summary": "Безкоштовний вебінар для дівчат 13–18 років про інвестування.",
        "opportunity_type": "conference", "cost_type": "free",
        "age_from": 13, "age_to": 18, "event_start_date": "2026-09-22",
        "evidence": {"age": "дівчат 13-18 років", "cost": "безкоштовний вебінар",
                     "type": "вебінар", "date": "22 вересня о 18:00"},
    }
    data.update(over)
    return data


def test_webinar_proves_its_own_format():
    out = _sanitize(base(), PAGE)
    assert out["format"] == "online"
    assert "вебінар" in out["evidence"]["place"].lower()
    assert out.get("status") != "draft"
    assert "формат або місце" not in (out.get("admin_comment") or "")


def test_quote_comes_from_the_page_not_from_us():
    # Слово стоїть лише у витягу моделі, на сторінці його немає — цитати нема.
    out = _sanitize(base(), "Реєстрація за посиланням. Місць обмежено.")
    assert not (out.get("evidence") or {}).get("place")
    assert out["status"] == "draft"


def test_online_registration_is_not_a_format():
    assert place_quote("Табір у Карпатах. Реєстрація онлайн за формою.") is None


def test_offline_marker_keeps_hybrid_but_still_quotes():
    page = "Онлайн-курс і очні зустрічі раз на місяць у Львові."
    out = _sanitize(base(title="Курс", summary=page, evidence={}), page)
    assert out["format"] == "hybrid"
    assert out["evidence"]["place"]
