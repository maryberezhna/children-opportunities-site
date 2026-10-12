"""Агрегатори — підказка «де шукати» для discover-агента (Марія, 12.10.2026)."""
import aggregators
import discover_agent


def test_block_lists_aggregators_and_url_rule():
    block = aggregators.prompt_block()
    assert "youth.europa.eu" in block and "prostir.ua" in block
    assert "постав ЙОГО сторінку" in block


def test_discover_prompt_includes_block():
    region = discover_agent._rotation()[0]
    prompt = discover_agent._prompt("конкурси", region)
    assert "ДЕ ШУКАТИ" in prompt
    assert "НЕ агрегатор/каталог" not in prompt
