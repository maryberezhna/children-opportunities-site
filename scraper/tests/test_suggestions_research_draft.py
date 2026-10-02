"""Наше дослідження завжди стає чернеткою (Марія, 02.10.2026)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "x")

import process_suggestions as ps  # noqa: E402


class _Norm:
    last_reject_reason = "не для дітей"

    def normalize(self, *a, **k):
        return None


def _sug(origin):
    return {"id": 1, "url": "https://example.org/program", "title": "Зимова підтримка",
            "contact": "", "comment": "Google Alerts 01.10.2026", "origin": origin}


def test_research_unreadable_page_becomes_stub_draft(monkeypatch):
    monkeypatch.setattr(ps, "find_existing", lambda sb, url: None)
    monkeypatch.setattr(ps, "fetch_text", lambda url: (None, "HTTP 403"))
    status, why = ps.process_one(None, _Norm(), _sug("research"), apply=False, seen=set())
    assert status == "imported"
    assert "чернетка-заглушка" in why and "HTTP 403" in why


def test_research_rejected_by_normalizer_becomes_stub_draft(monkeypatch):
    monkeypatch.setattr(ps, "find_existing", lambda sb, url: None)
    monkeypatch.setattr(ps, "fetch_text", lambda url: ("текст сторінки", "HTTP 200"))
    status, why = ps.process_one(None, _Norm(), _sug("research"), apply=False, seen=set())
    assert status == "imported" and "нормалізатор не взяв" in why


def test_popup_still_waits_for_human(monkeypatch):
    monkeypatch.setattr(ps, "find_existing", lambda sb, url: None)
    monkeypatch.setattr(ps, "fetch_text", lambda url: (None, "HTTP 403"))
    status, _ = ps.process_one(None, _Norm(), _sug("popup"), apply=False, seen=set())
    assert status == "needs_human"
