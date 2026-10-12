"""Агрегатори — підказка «де шукати» для discover-агента (Марія, 12.10.2026)."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import aggregators  # noqa: E402
import discover_agent  # noqa: E402


class AggregatorsBlock(unittest.TestCase):
    def test_block_lists_aggregators_and_url_rule(self):
        block = aggregators.prompt_block()
        self.assertIn("youth.europa.eu", block)
        self.assertIn("prostir.ua", block)
        self.assertIn("постав ЙОГО сторінку", block)

    def test_discover_prompt_includes_block(self):
        region = discover_agent._rotation()[0]
        prompt = discover_agent._prompt("конкурси", region)
        self.assertIn("ДЕ ШУКАТИ", prompt)
        self.assertNotIn("НЕ агрегатор/каталог", prompt)


if __name__ == "__main__":
    unittest.main()
