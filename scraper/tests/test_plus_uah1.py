"""Кому йде разове «перший місяць 1 грн» (scraper/plus_uah1.py, 08.10.2026)."""
from plus_uah1 import pick_recipients, started_text, waitlist_text


def test_pick_recipients():
    subs = [
        {"telegram_chat_id": 1, "status": "pending", "telegram_handle": "@a"},
        {"telegram_chat_id": 2, "status": "paused"},
        {"telegram_chat_id": 3, "status": "active"},
        {"telegram_chat_id": 4, "status": "unsubscribed"},
        {"telegram_chat_id": None, "status": "pending", "billing_period": "gift"},
    ]
    waitlist = [
        {"telegram_chat_id": 3, "source": "plus_bot:site"},       # уже підписник
        {"telegram_chat_id": 4, "source": "plus_bot:site"},       # сам відписався
        {"telegram_chat_id": 5, "source": "plus_bot:detail_page"},
        {"telegram_chat_id": 6, "source": "telegram_post"},       # службовий бот — ні
        {"telegram_chat_id": None, "source": "catalog_slot_0"},   # лише пошта
    ]
    got = [(c, k) for c, k, _ in pick_recipients(subs, waitlist)]
    assert got == [("1", "started"), ("2", "started"), ("5", "waitlist")]


def test_texts_name_price_and_stop():
    for t in (started_text(), waitlist_text()):
        assert "1 грн" in t and "99 грн/міс" in t and "/stop" in t
    assert "Підписка вже працює: щодня добирає" in waitlist_text()


def test_started_text_not_for_everyone_and_asks_why():
    t = started_text()
    assert "для всіх" not in t
    assert "чомусь зупинилися" in t
    assert "даруємо перший місяць за 1 грн" in t
    assert "у чому виникли складнощі" in t
    assert "Dityam+ —" not in t
