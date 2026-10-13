from datetime import datetime, timedelta, timezone

import ambassador_invite as ai

NOW = datetime(2026, 12, 20, tzinfo=timezone.utc)
PAID_LONG = NOW - timedelta(days=91)
PAID_SHORT = NOW - timedelta(days=30)


def sub(**kw):
    base = {"id": "s1", "status": "active", "telegram_chat_id": 7, "role": "parent", "ambassador_invited_at": None}
    base.update(kw)
    return base


def test_parent_after_3_months_is_invited():
    assert ai.due(sub(), PAID_LONG, NOW)


def test_teacher_and_old_subscriber_without_role_too():
    assert ai.due(sub(role="teacher"), PAID_LONG, NOW)
    assert ai.due(sub(role=None), PAID_LONG, NOW)


def test_teen_never():
    assert not ai.due(sub(role="teen"), PAID_LONG, NOW)


def test_not_before_3_months_not_twice_not_inactive():
    assert not ai.due(sub(), PAID_SHORT, NOW)
    assert not ai.due(sub(ambassador_invited_at="2026-12-01"), PAID_LONG, NOW)
    assert not ai.due(sub(status="cancelled"), PAID_LONG, NOW)
    assert not ai.due(sub(), None, NOW)


def test_text_only_promises_what_the_page_says():
    t = ai.TEXT
    assert "Dityam+ —" not in t
    assert "Dityam.com.ua" in t and ai.URL.endswith("/ambasadory")
