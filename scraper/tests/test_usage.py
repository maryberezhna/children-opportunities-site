"""Облік токенів (24.09.2026): скільки з'їв кожен процес — у базу, не в лог.

Числа в тестах — із живого нічного скрапу 23.09.2026: 33 виклики, read
738 972, write 18 948, без кешу 48 485. Саме на цьому прогоні рахунок і
звіряли вперше.
"""
import os
import sys
import unittest
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from usage import Meter, Spend, cost_usd, workflow_name  # noqa: E402

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


# ── 04.10.2026: облік у кожному плановому скрипті, вебпошук, Spend ─────────

SONNET = "claude-sonnet-5"


class WebSearch(unittest.TestCase):
    def test_ten_dollars_per_thousand_searches(self):
        self.assertEqual(cost_usd(SONNET, web_searches=1000), 10.0)
        self.assertEqual(cost_usd(SONNET, web_searches=4), 0.04)

    def test_searches_add_to_tokens(self):
        self.assertEqual(cost_usd(SONNET, uncached_in=1_000_000, web_searches=4), 2.04)

    def test_raw_json_response_from_httpx(self):
        # Пошукові агенти ходять в API через httpx і отримують dict.
        m = Meter(workflow="discover", model=SONNET)
        m.add({"usage": {"input_tokens": 20_000, "output_tokens": 3_000,
                         "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
                         "server_tool_use": {"web_search_requests": 4}}})
        self.assertEqual((m.calls, m.uncached_in, m.output, m.web_searches), (1, 20_000, 3_000, 4))
        self.assertAlmostEqual(m.cost, 0.04 + 0.04 + 0.03, places=6)
        self.assertIn("пошуків 4", m.line())

    def test_sdk_object_with_server_tool_use(self):
        m = Meter(workflow="x", model=SONNET)
        resp = FakeResponse(input_tokens=10)
        resp.usage.server_tool_use = type("S", (), {"web_search_requests": 2})()
        m.add(resp)
        self.assertEqual(m.web_searches, 2)

    def test_response_without_searches_counts_zero(self):
        m = Meter(workflow="x", model=HAIKU)
        m.add({"usage": {"input_tokens": 5, "output_tokens": 1}})
        self.assertEqual((m.calls, m.web_searches), (1, 0))
        self.assertNotIn("пошуків", m.line())

    def test_mock_values_do_not_break_the_count(self):
        # MagicMock замість чисел (тести інших скриптів) — нулі, не TypeError.
        m = Meter(workflow="x", model=HAIKU)
        m.add(mock.MagicMock())
        self.assertEqual((m.calls, m.uncached_in, m.output), (1, 0, 0))


class WorkflowName(unittest.TestCase):
    def test_from_workflow_ref(self):
        ref = ("maryberezhna/children-opportunities-site/.github/workflows/"
               "discover-rare.yml@refs/heads/main")
        with mock.patch.dict(os.environ, {"GITHUB_WORKFLOW_REF": ref}):
            self.assertEqual(workflow_name("discover"), "discover-rare")

    def test_default_outside_actions(self):
        with mock.patch.dict(os.environ, {"GITHUB_WORKFLOW_REF": ""}):
            self.assertEqual(workflow_name("discover"), "discover")


class FakeTable:
    def __init__(self, sink, fail=False):
        self.sink, self.fail = sink, fail

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def limit(self, *a):
        return self

    def upsert(self, row, **k):
        self.sink.append(row)
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("supabase лежить")
        return type("R", (), {"data": []})()


class FakeClient:
    def __init__(self, fail=False):
        self.rows, self.fail, self.tables = [], fail, []

    def table(self, name):
        self.tables.append(name)
        return FakeTable(self.rows, self.fail)


class SpendRun(unittest.TestCase):
    def setUp(self):
        p = mock.patch.dict(os.environ, {"GITHUB_WORKFLOW_REF": ""})
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(mock.patch.stopall)
        mock.patch("builtins.print").start()

    def test_one_row_per_model(self):
        s = Spend("discover")
        s.add(SONNET, {"usage": {"input_tokens": 100, "output_tokens": 10,
                                 "server_tool_use": {"web_search_requests": 4}}})
        s.add(SONNET, {"usage": {"input_tokens": 100, "output_tokens": 10}})
        s.add(HAIKU, FakeResponse(input_tokens=50, output=5))
        db = FakeClient()
        self.assertEqual(s.record(db, day=date(2026, 10, 4)), 2)
        rows = {r["model"]: r for r in db.rows}
        self.assertEqual(rows[SONNET]["calls"], 2)
        self.assertEqual(rows[SONNET]["workflow"], "discover")
        self.assertEqual(rows[HAIKU]["calls"], 1)

    def test_record_resets_so_finally_cannot_double_count(self):
        s = Spend("x")
        s.add(HAIKU, FakeResponse(input_tokens=1))
        db = FakeClient()
        s.record(db)
        s.record(db)
        self.assertEqual(len(db.rows), 1)

    def test_dry_run_writes_nothing(self):
        s = Spend("x")
        s.dry = True
        s.add(HAIKU, FakeResponse(input_tokens=1))
        db = FakeClient()
        self.assertEqual(s.record(db), 0)
        self.assertEqual(db.tables, [])

    def test_no_calls_no_database(self):
        # Прогін без викликів моделі не відкриває навіть клієнт бази.
        with mock.patch("db.get_client", side_effect=AssertionError("не мав кликати")):
            self.assertEqual(Spend("x").record(), 0)

    def test_database_failure_never_raises(self):
        s = Spend("x")
        s.add(HAIKU, FakeResponse(input_tokens=1))
        self.assertEqual(s.record(FakeClient(fail=True)), 0)

    def test_client_creation_failure_never_raises(self):
        s = Spend("x")
        s.add(HAIKU, FakeResponse(input_tokens=1))
        with mock.patch("db.get_client", side_effect=RuntimeError("немає SUPABASE_URL")):
            self.assertEqual(s.record(), 0)

    def test_add_never_raises(self):
        s = Spend("x")
        s.add(HAIKU, None)
        s.add(HAIKU, 42)
        s.add_totals(HAIKU, calls="багато", output=None)
        self.assertEqual(s.record(FakeClient()), 0)

    def test_totals_from_normalizer(self):
        s = Spend("process-suggestions")
        s.add_totals(HAIKU, calls=3, uncached_in=900, cache_read=100, cache_write=0, output=60)
        db = FakeClient()
        s.record(db)
        self.assertEqual(db.rows[0]["calls"], 3)
        self.assertEqual(db.rows[0]["workflow"], "process-suggestions")


class EveryScheduledScriptRecords(unittest.TestCase):
    """Найдорожча помилка тут — не логіка, а невикликаний облік (04.10.2026).

    Кожен плановий скрипт із моделлю: Spend з іменем свого воркфлоу, add після
    відповіді API і record у finally — щоб записати й прогін, що впав."""

    SCRIPTS = {
        "auto_review.py": "auto-review",
        "translate_en.py": "translate-en",
        "triage_quarantine.py": "triage-quarantine",
        "discover_agent.py": "discover",
        "discover_sources.py": "discover-sources",
        "lifecycle.py": "lifecycle",
        "process_notes.py": "process-notes",
        "process_suggestions.py": "process-suggestions",
    }

    def test_wired(self):
        base = os.path.join(os.path.dirname(__file__), "..")
        workflows = os.path.join(base, "..", ".github", "workflows")
        for script, wf in self.SCRIPTS.items():
            with self.subTest(script=script):
                with open(os.path.join(base, script), encoding="utf-8") as f:
                    code = f.read()
                self.assertIn(f'SPEND = usage.Spend("{wf}")', code)
                self.assertTrue("SPEND.add(" in code or "SPEND.add_totals(" in code)
                self.assertIn("SPEND.record(", code)
                # record — у finally (кілька рядків нижче), а не лише в кінці щасливого шляху.
                blocks = code.split("finally:")[1:]
                self.assertTrue(any("SPEND.record(" in b[:700] for b in blocks),
                                f"{script}: SPEND.record не в finally")
                # Імʼя за замовчуванням — справжній файл воркфлоу.
                self.assertTrue(os.path.exists(os.path.join(workflows, f"{wf}.yml")), wf)

    def test_search_agents_count_searches(self):
        # Обидва пошукові агенти віддають Spend сирий JSON — разом із пошуками.
        import discover_agent as da
        import discover_sources as ds
        data = {"content": [{"type": "text", "text": "[]"}], "stop_reason": "end_turn",
                "usage": {"input_tokens": 1000, "output_tokens": 100,
                          "server_tool_use": {"web_search_requests": 4}}}
        resp = mock.Mock(status_code=200)
        resp.json.return_value = data
        for module, call in ((da, lambda: da.search_candidates("олімпіада", da._regions()[0])),
                             (ds, lambda: ds.search("тема"))):
            with self.subTest(module=module.__name__):
                spend = Spend("x")
                with mock.patch.object(module.httpx, "post", return_value=resp), \
                        mock.patch.object(da, "_avoid", return_value=""), \
                        mock.patch.object(module, "SPEND", spend), \
                        mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
                    call()
                meter = spend.meters[module.MODEL]
                self.assertEqual((meter.calls, meter.web_searches), (1, 4))


if __name__ == "__main__":
    unittest.main()
