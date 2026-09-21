"""Витрати пошукових агентів (21.09.2026, рішення Марії): 4 пошуки за запуск,
знижений рівень зусиль Sonnet 5, розвідник джерел — раз на тиждень."""
import os
import pathlib
import sys
import unittest
from datetime import date, timedelta
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import api_guard  # noqa: E402
import discover_agent as da  # noqa: E402
import discover_sources as ds  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]


def _payload(module, fn, *args):
    """Тіло запиту, яке агент відправив би, — без мережі."""
    sent = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        sent.update(json)
        raise RuntimeError("stop")

    with mock.patch.object(module.httpx, "post", fake_post), \
            mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
        try:
            fn(*args)
        except RuntimeError:
            pass
    return sent


class Effort(unittest.TestCase):
    def test_only_models_that_accept_it(self):
        self.assertEqual(api_guard.effort_config("claude-sonnet-5", "low"),
                         {"output_config": {"effort": "low"}})
        self.assertEqual(api_guard.effort_config("claude-opus-4-8", "medium"),
                         {"output_config": {"effort": "medium"}})
        # Haiku 4.5 на effort відповідає 400 — параметр не передаємо.
        self.assertEqual(api_guard.effort_config("claude-haiku-4-5-20251001", "low"), {})
        self.assertEqual(api_guard.effort_config("", "low"), {})


class Requests(unittest.TestCase):
    def test_sources_four_searches_low_effort(self):
        body = _payload(ds, ds.search, "тема")
        self.assertEqual(body["tools"][0]["max_uses"], 4)
        self.assertEqual(body.get("output_config"), {"effort": "low"})

    def test_agent_four_searches_medium_effort(self):
        region = da._regions()[0]
        body = _payload(da, da.search_candidates, "олімпіада", region)
        self.assertEqual(body["tools"][0]["max_uses"], 4)
        self.assertEqual(body.get("output_config"), {"effort": "medium"})


class WeeklyThemes(unittest.TestCase):
    def test_every_theme_comes_up_week_after_week(self):
        # Раніше тема бралась за днем року: крок 7 при 7 темах «фондів» давав
        # щосереди ту саму тему.
        start = date(2026, 9, 23)
        for pool_name, profile in (("FOUNDATION_THEMES", "foundations"), ("THEMES", "")):
            pool = getattr(ds, pool_name)
            with mock.patch.object(ds, "PROFILE", profile):
                seen = {ds.theme_of_day(start + timedelta(weeks=w)) for w in range(len(pool))}
            self.assertEqual(seen, set(pool), pool_name)

    def test_sources_workflow_is_weekly(self):
        wf = (ROOT / ".github/workflows/discover-sources.yml").read_text(encoding="utf-8")
        self.assertIn("cron: '40 5 * * 1'", wf)


if __name__ == "__main__":
    unittest.main()
