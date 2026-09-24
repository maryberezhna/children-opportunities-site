"""Облік токенів (24.09.2026): скільки з'їв кожен процес — у базу, не в лог.

Числа в тестах — із живого нічного скрапу 23.09.2026: 33 виклики, read
738 972, write 18 948, без кешу 48 485. Саме на цьому прогоні рахунок і
звіряли вперше.
"""
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from usage import Meter, cost_usd  # noqa: E402

HAIKU = "claude-haiku-4-5-20251001"


class FakeUsage:
    def __init__(self, **kw):
        self.input_tokens = kw.get("input_tokens", 0)
        self.cache_read_input_tokens = kw.get("cache_read", 0)
        self.cache_creation_input_tokens = kw.get("cache_write", 0)
        self.output_tokens = kw.get("output", 0)


class FakeResponse:
    def __init__(self, **kw):
        self.usage = FakeUsage(**kw)


class Cost(unittest.TestCase):
    def test_cache_read_is_a_tenth_of_input(self):
        # Мільйон токенів: повна ціна $1, з кешу — 10 центів.
        self.assertEqual(cost_usd(HAIKU, uncached_in=1_000_000), 1.0)
        self.assertEqual(cost_usd(HAIKU, cache_read=1_000_000), 0.10)
        self.assertEqual(cost_usd(HAIKU, cache_write=1_000_000), 1.25)
        self.assertEqual(cost_usd(HAIKU, output=1_000_000), 5.0)

    def test_sonnet_costs_twice_the_input_of_haiku(self):
        self.assertEqual(cost_usd("claude-sonnet-5", uncached_in=1_000_000), 2.0)
        self.assertEqual(cost_usd("claude-sonnet-5", output=1_000_000), 10.0)

    def test_unknown_model_costs_zero_but_does_not_raise(self):
        # Краще запис без суми, ніж жодного запису: токени однаково видно.
        self.assertEqual(cost_usd("claude-щось-нове", uncached_in=1_000_000), 0.0)

    def test_real_night_run(self):
        # 23.09.2026: 739k з кешу, 19k запис, 48k без кешу, ~23k виходу.
        cost = cost_usd(HAIKU, uncached_in=48_485, cache_read=738_972,
                        cache_write=18_948, output=23_000)
        self.assertAlmostEqual(cost, 0.2611, places=3)


class MeterCounts(unittest.TestCase):
    def test_add_sums_usage_and_counts_calls(self):
        m = Meter(workflow="scrape-extract", model=HAIKU)
        m.add(FakeResponse(input_tokens=100, cache_read=900, output=50))
        m.add(FakeResponse(input_tokens=100, cache_read=900, output=50))
        self.assertEqual((m.calls, m.uncached_in, m.cache_read, m.output), (2, 200, 1800, 100))

    def test_response_without_usage_is_not_counted(self):
        m = Meter(workflow="x", model=HAIKU)
        m.add(object())
        self.assertEqual(m.calls, 0)

    def test_cache_hit_percent(self):
        m = Meter(workflow="x", model=HAIKU)
        m.add(FakeResponse(input_tokens=100, cache_read=900))
        self.assertEqual(m.cache_hit_pct, 90)

    def test_cache_hit_percent_without_calls_is_zero_not_error(self):
        self.assertEqual(Meter(workflow="x", model=HAIKU).cache_hit_pct, 0)

    def test_row_shape(self):
        m = Meter(workflow="scrape-extract", model=HAIKU)
        m.add_totals(calls=33, uncached_in=48_485, cache_read=738_972,
                     cache_write=18_948, output=23_000)
        row = m.as_row(date(2026, 9, 23))
        self.assertEqual(row["day"], "2026-09-23")
        self.assertEqual(row["workflow"], "scrape-extract")
        self.assertEqual(row["calls"], 33)
        self.assertEqual(row["cache_read_tokens"], 738_972)
        self.assertGreater(row["cost_usd"], 0)

    def test_line_mentions_hit_rate_and_cost(self):
        m = Meter(workflow="scrape-extract", model=HAIKU)
        m.add_totals(calls=33, uncached_in=48_485, cache_read=738_972, cache_write=18_948)
        line = m.line()
        self.assertIn("33 викликів", line)
        self.assertIn("91% з кешу", line)


if __name__ == "__main__":
    unittest.main()
