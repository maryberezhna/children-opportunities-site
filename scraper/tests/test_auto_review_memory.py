"""Памʼять судді auto_review (04.10.2026).

03.10.2026 закінчився баланс API. Одна з причин — суддя-Haiku щоночі заново
читав кожну чернетку з черги, хоча більшість не мінялась тижнями. Тепер його
слово лежить в opportunities.auto_review із хешем того, що він бачив:

  · запис не змінився — суддю не кличемо, коридор той самий;
  · змінилось будь-яке поле, яке бачить суддя, — питаємо знову;
  · дамп (без --apply) не пише нічого: ні рішень, ні памʼяті, ні витрат.
"""
import os
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auto_review  # noqa: E402

# Порожній GITHUB_WORKFLOW_REF: у воркфлоу тестів імʼя було б «tests».
ENV = {"ANTHROPIC_API_KEY": "test", "GITHUB_WORKFLOW_REF": ""}


def row(**over):
    """Чернетка, яку механіка пропускає до судді."""
    data = {
        "id": "opp-1",
        "slug": "tabir-veselka",
        "title": "Літній табір «Веселка» у Карпатах",
        "summary": "Безкоштовний табір для дітей 7–12 років у Карпатах, заявки до 15 червня.",
        "age_from": 7, "age_to": 12, "deadline": "2099-06-15", "cost_type": "free",
        "opportunity_type": "camp", "format": "offline", "cities": ["Славське"],
        "child_needs": [], "link_status": "ok", "status": "draft",
        "source": "Telegram (веб)",
        "evidence": {"age": "Для дітей 7–12 років", "cost": "Участь безкоштовна"},
    }
    data.update(over)
    return data


class FakeLLM:
    """Клієнт Anthropic: рахує виклики й віддає наперед задане слово."""

    def __init__(self, publish=False, confidence=0.9, reason="опис загальний"):
        self.calls = 0
        self.verdict = {"publish": publish, "confidence": confidence, "reason": reason}
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls += 1
        block = SimpleNamespace(type="tool_use", input=dict(self.verdict))
        usage = SimpleNamespace(input_tokens=1000, output_tokens=50,
                                cache_read_input_tokens=0, cache_creation_input_tokens=0)
        return SimpleNamespace(content=[block], usage=usage)


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload, self.filters = db, table, "select", None, []

    def select(self, *a, **k):
        return self

    def update(self, patch):
        self.op, self.payload = "update", patch
        return self

    def upsert(self, row, **k):
        self.op, self.payload = "upsert", row
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def limit(self, n):
        return self

    def execute(self):
        self.db.log.append((self.table, self.op, self.payload, list(self.filters)))
        if self.op == "update" and self.table in self.db.fail_updates:
            raise RuntimeError("column opportunities.auto_review does not exist")
        if self.op == "select":
            return SimpleNamespace(data=self.db.rows.get(self.table, []))
        return SimpleNamespace(data=[])


class FakeDB:
    def __init__(self, drafts, fail_updates=()):
        self.rows = {"opportunities": drafts, "sources": [], "llm_usage": []}
        self.log = []
        self.fail_updates = set(fail_updates)

    def table(self, name):
        return Query(self, name)

    def writes(self, table):
        return [e for e in self.log if e[0] == table and e[1] != "select"]


class Hash(unittest.TestCase):
    def test_same_record_same_hash(self):
        self.assertEqual(auto_review.judge_hash(row()), auto_review.judge_hash(row()))

    def test_every_field_the_judge_sees_changes_the_hash(self):
        base = auto_review.judge_hash(row())
        for field, value in (("title", "Інша назва табору в Карпатах"),
                             ("summary", "Інший опис"), ("opportunity_type", "course"),
                             ("age_from", 8), ("age_to", 13), ("cost_type", "paid"),
                             ("source", "Інше джерело"), ("source_url", "https://x.ua"),
                             ("deadline", "2099-07-01"), ("event_start_date", "2099-07-10"),
                             ("event_end_date", "2099-07-20"), ("timing_kind", "periodic"),
                             ("evidence", {"age": "Для дітей 8–13 років"})):
            with self.subTest(field=field):
                self.assertNotEqual(auto_review.judge_hash(row(**{field: value})), base)

    def test_fields_the_judge_does_not_see_keep_the_hash(self):
        # admin_comment, статус і службові поля суддя не бачить — і памʼять не губиться.
        base = auto_review.judge_hash(row())
        self.assertEqual(auto_review.judge_hash(row(admin_comment="🔎 Агент: табір",
                                                    updated_at="2026-10-04T00:00:00Z")), base)

    def test_today_is_not_hashed(self):
        # Інакше хеш мінявся б щоночі й памʼять не спрацювала б ніколи.
        base = auto_review.judge_hash(row())
        with mock.patch.object(auto_review, "date") as d:
            d.today.return_value.isoformat.return_value = "2099-01-01"
            self.assertEqual(auto_review.judge_hash(row()), base)

    def test_prompt_change_changes_the_hash(self):
        base = auto_review.judge_hash(row())
        with mock.patch.object(auto_review, "JUDGE_PROMPT", auto_review.JUDGE_PROMPT + " "):
            self.assertNotEqual(auto_review.judge_hash(row()), base)


class Review(unittest.TestCase):
    def remembered_row(self, **over):
        """Чернетка, про яку суддя вже сказав «ні» минулої ночі."""
        r = row(**over)
        _, _, _, memory = auto_review.review(row(), FakeLLM())
        r["auto_review"] = memory
        return r

    def test_fresh_judge_answer_is_returned_as_memory(self):
        llm = FakeLLM()
        corridor, reason, whence, memory = auto_review.review(row(), llm)
        self.assertEqual((corridor, whence, llm.calls), (auto_review.YELLOW, "judge", 1))
        self.assertEqual(memory["hash"], auto_review.judge_hash(row()))
        self.assertEqual(memory["corridor"], auto_review.YELLOW)
        self.assertEqual(memory["reason"], reason)
        self.assertFalse(memory["verdict"]["publish"])

    def test_unchanged_record_skips_the_judge(self):
        llm = FakeLLM()
        corridor, reason, whence, memory = auto_review.review(self.remembered_row(), llm)
        self.assertEqual(llm.calls, 0)
        self.assertEqual((corridor, whence, memory), (auto_review.YELLOW, "memory", None))
        self.assertIn("опис загальний", reason)

    def test_changed_record_is_judged_again(self):
        llm = FakeLLM(publish=True, confidence=0.95, reason="конкретний табір")
        r = self.remembered_row(summary="Безкоштовний табір для дітей 7–12 років у Карпатах: "
                                        "програма, проживання й харчування, заявки до 15 червня.")
        corridor, _, whence, memory = auto_review.review(r, llm)
        self.assertEqual((llm.calls, whence, corridor), (1, "judge", auto_review.GREEN))
        self.assertEqual(memory["hash"], auto_review.judge_hash(r))

    def test_remembered_yes_is_not_reused(self):
        # Зелений знову в чернетках — його туди повернули; хай суддя гляне свіжим оком.
        r = row()
        r["auto_review"] = auto_review.review(row(), FakeLLM(publish=True, confidence=0.95))[3]
        llm = FakeLLM()
        _, _, whence, _ = auto_review.review(r, llm)
        self.assertEqual((whence, llm.calls), ("judge", 1))

    def test_judge_failure_is_not_remembered(self):
        # Вичерпаний баланс не має лишити чернетку жовтою до першої правки.
        llm = FakeLLM()
        llm.messages = SimpleNamespace(create=mock.Mock(side_effect=RuntimeError("credit balance")))
        corridor, _, whence, memory = auto_review.review(row(), llm)
        self.assertEqual((corridor, whence, memory), (auto_review.YELLOW, "judge", None))

    def test_mechanics_still_decide_first(self):
        # Протерміноване червоне, хай що каже памʼять.
        r = self.remembered_row(deadline="2020-01-01")
        llm = FakeLLM()
        corridor, _, whence, _ = auto_review.review(r, llm)
        self.assertEqual((corridor, whence, llm.calls), (auto_review.RED, "mechanical", 0))

    def test_threshold_applies_to_memory_too(self):
        # «Так» з упевненістю 0.7 — жовтий і з памʼяті: поріг той самий.
        r = row()
        r["auto_review"] = auto_review.review(row(), FakeLLM(publish=True, confidence=0.7))[3]
        llm = FakeLLM()
        corridor, _, whence, _ = auto_review.review(r, llm)
        self.assertEqual((corridor, whence, llm.calls), (auto_review.YELLOW, "memory", 0))

    def test_classify_keeps_its_old_shape(self):
        corridor, reason = auto_review.classify(row(), FakeLLM())
        self.assertEqual(corridor, auto_review.YELLOW)
        self.assertIn("суддя не пропустив", reason)


class Run(unittest.TestCase):
    def run_once(self, drafts, llm, apply, fail_updates=()):
        db = FakeDB(drafts, fail_updates)
        with mock.patch.object(auto_review, "get_client", return_value=db), \
                mock.patch.object(auto_review.api_guard, "client", return_value=llm), \
                mock.patch.object(auto_review, "_memory_off", False), \
                mock.patch.object(auto_review, "SPEND", auto_review.usage.Spend("auto-review")), \
                mock.patch.dict(os.environ, ENV), \
                mock.patch("builtins.print"):
            auto_review.run(apply=apply)
        return db

    def test_apply_writes_memory_and_spend(self):
        llm = FakeLLM()
        db = self.run_once([row()], llm, apply=True)
        memory = [e for e in db.writes("opportunities") if "auto_review" in (e[2] or {})]
        self.assertEqual(len(memory), 1)
        self.assertEqual(memory[0][2]["auto_review"]["hash"], auto_review.judge_hash(row()))
        usage_rows = [e[2] for e in db.writes("llm_usage")]
        self.assertEqual(len(usage_rows), 1)
        self.assertEqual(usage_rows[0]["workflow"], "auto-review")
        self.assertEqual(usage_rows[0]["model"], auto_review.MODEL)
        self.assertEqual(usage_rows[0]["calls"], 1)

    def test_second_night_costs_nothing(self):
        llm = FakeLLM()
        first = self.run_once([row()], llm, apply=True)
        stored = [e for e in first.writes("opportunities") if "auto_review" in (e[2] or {})]
        again = row(auto_review=stored[0][2]["auto_review"])
        second = self.run_once([again], llm, apply=True)
        self.assertEqual(llm.calls, 1)                      # лише першої ночі
        self.assertEqual(second.writes("opportunities"), [])  # жовтий — нічого не пишемо
        self.assertEqual(second.writes("llm_usage"), [])      # нуль викликів — нуль рядків

    def test_dry_run_writes_nothing_at_all(self):
        # #661: «суха» перевірка не сміє писати — ні рішень, ні памʼяті, ні витрат.
        llm = FakeLLM(publish=True, confidence=0.95)
        db = self.run_once([row()], llm, apply=False)
        self.assertEqual(llm.calls, 1)
        self.assertEqual([e for e in db.log if e[1] != "select"], [])

    def test_missing_column_does_not_break_the_corridors(self):
        # Міграцію ще не застосовано: памʼять не пишеться, а зелений однаково
        # публікується — рішення пише окремий запит, перед памʼяттю.
        llm = FakeLLM(publish=True, confidence=0.95)
        db = FakeDB([row(), row(id="opp-2", slug="druhyi")])
        calls = []

        def update_ok_unless_memory(self_q, patch):
            calls.append(patch)
            self_q.op, self_q.payload = "update", patch
            if "auto_review" in patch:
                raise RuntimeError("Could not find the 'auto_review' column")
            return self_q

        with mock.patch.object(auto_review, "get_client", return_value=db), \
                mock.patch.object(auto_review.api_guard, "client", return_value=llm), \
                mock.patch.object(auto_review, "_memory_off", False), \
                mock.patch.object(Query, "update", update_ok_unless_memory), \
                mock.patch.object(auto_review, "SPEND", auto_review.usage.Spend("auto-review")), \
                mock.patch.dict(os.environ, ENV), \
                mock.patch("builtins.print"):
            result = auto_review.run(apply=True)
        self.assertEqual(result[auto_review.GREEN], 2)
        published = [p for p in calls if p.get("status") == "active"]
        self.assertEqual(len(published), 2)
        # Після першої невдачі памʼять у цьому прогоні більше не пробуємо.
        self.assertEqual(len([p for p in calls if "auto_review" in p]), 1)


if __name__ == "__main__":
    unittest.main()
