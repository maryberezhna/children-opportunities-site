"""Переклад наново — лише коли змінився сам текст (04.10.2026).

До того translate_en вважав переклад застарілим, щойно updated_at ставав
пізнішим за translated_at. Але updated_at рухають і повторна екстракція
(db.py), і планові перевірки (proof_recheck.py) — і Haiku щоночі перекладав
наново тексти, у яких не змінилось ні слова. Тепер поруч із перекладом лежить
translated_hash — md5 тексту, з якого його зроблено.

Міграція 20261004_llm_spend_memory.sql заповнює цей хеш у SQL для записів зі
свіжим перекладом. Якщо Python і SQL рахують по-різному, кожен такий запис
перекладеться ще раз — тому формули звірено на справжньому Postgres.
"""
import os
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import translate_en  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20261004_llm_spend_memory.sql"

# Еталон — з Postgres, а не з Python: значення HASH_SQL на цих рядках, пораховані
# 04.10.2026 у PostgreSQL 18.3 (PGlite 0.5.8, server_encoding UTF8) запитом
#   select md5(coalesce(title, '') || chr(31) || coalesce(summary, '')
#              || chr(31) || coalesce(details, '')) from (values …) t(title, summary, details)
# md5, coalesce, chr і || поводяться однаково в усіх версіях Postgres, тож і в
# Supabase. Дві останні пари доводять, що роздільник працює: без нього «ab|c» і
# «a|bc» дали б той самий хеш.
POSTGRES_MD5 = [
    ({"title": "Курс «Юний програміст»", "summary": "Безкоштовно, 10–14 років",
      "details": "Рядок 1\nРядок 2 — 🎨"}, "5013ae414b73e18ccf0a2d7a079d26c5"),
    ({"title": "Табір", "summary": None, "details": None}, "f349e075b4a6805603e3924ad8d2261e"),
    ({"title": "Олімпіада", "summary": "", "details": None}, "07f60b8ba81f6a9f03c86ff40bf134ec"),
    ({"title": None, "summary": None, "details": None}, "2e6f2bd5dba2282bb662ac46923808ce"),
    ({"title": "ab", "summary": "c", "details": None}, "a8d4535b654fc93605139038dd906d0f"),
    ({"title": "a", "summary": "bc", "details": None}, "860bf50418c0ba75feb800039101396a"),
]


class PythonMatchesSql(unittest.TestCase):
    def test_python_hash_equals_postgres_md5(self):
        for row, expected in POSTGRES_MD5:
            with self.subTest(title=row["title"]):
                self.assertEqual(translate_en.text_hash(row), expected)

    def test_migration_backfills_with_exactly_this_formula(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn(f"set translated_hash = {translate_en.HASH_SQL}", sql)

    def test_migration_hashes_only_fresh_translations(self):
        # Застарілі за старим правилом лишаються NULL — перекладуться один раз.
        sql = " ".join(MIGRATION.read_text(encoding="utf-8").split())
        self.assertIn("where translated_hash is null and translated_at is not null "
                      "and (updated_at is null or updated_at <= translated_at);", sql)

    def test_migration_is_idempotent(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("add column if not exists translated_hash text", sql)
        self.assertIn("add column if not exists auto_review jsonb", sql)

    def test_null_and_empty_are_the_same_text(self):
        # translate_one теж не розрізняє: порожній опис просто не йде в модель.
        a = translate_en.text_hash({"title": "Т", "summary": None, "details": None})
        b = translate_en.text_hash({"title": "Т", "summary": "", "details": ""})
        c = translate_en.text_hash({"title": "Т"})
        self.assertEqual(a, b)
        self.assertEqual(a, c)

    def test_hashed_fields_are_the_translated_ones(self):
        self.assertEqual(translate_en.HASH_FIELDS, ("title", "summary", "details"))


def translated(**over):
    r = {"id": "1", "title": "Табір «Веселка»", "summary": "Для дітей 7–12 років",
         "details": "Програма табору", "status": "active", "canonical_slug": None,
         "translated_at": "2026-09-01T00:00:00+00:00",
         "updated_at": "2026-09-01T00:00:00+00:00"}
    r.update(over)
    if "translated_hash" not in over:
        r["translated_hash"] = translate_en.text_hash(r)
    return r


class Staleness(unittest.TestCase):
    def test_untouched_text_is_fresh_even_if_updated_at_moved(self):
        # Саме той випадок, що палив гроші: повторна екстракція рухнула updated_at.
        self.assertFalse(translate_en.is_stale(translated(updated_at="2026-10-03T00:00:00+00:00")))

    def test_any_translated_field_change_makes_it_stale(self):
        for field in ("title", "summary", "details"):
            with self.subTest(field=field):
                r = translated()
                r[field] = (r[field] or "") + " — оновлено"
                self.assertTrue(translate_en.is_stale(r))

    def test_untranslated_field_change_keeps_it_fresh(self):
        r = translated()
        r["deadline"] = "2027-01-01"
        r["cost_type"] = "paid"
        self.assertFalse(translate_en.is_stale(r))

    def test_no_hash_means_stale(self):
        # NULL після міграції = переклад уже тоді був застарілий.
        self.assertTrue(translate_en.is_stale(translated(translated_hash=None)))


# ── прогін main() на підробленій базі ──────────────────────────────────────

class Q:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.neg, self.op, self.payload = [], False, "select", None
        self.cols, self.head = "*", False

    @property
    def not_(self):
        self.neg = True
        return self

    def select(self, cols="*", count=None, head=False):
        self.cols, self.head = cols, head
        return self

    def eq(self, col, val):
        self.filters.append(lambda r, c=col, v=val: r.get(c) == v)
        return self

    def is_(self, col, val):
        neg, self.neg = self.neg, False
        self.filters.append(lambda r, c=col, n=neg: (r.get(c) is None) != n)
        return self

    def order(self, *a, **k):
        return self

    def limit(self, n):
        self.lim = n
        return self

    def range(self, a, b):
        self.rng = (a, b)
        return self

    def update(self, patch):
        self.op, self.payload = "update", patch
        return self

    def upsert(self, row, **k):
        self.op, self.payload = "upsert", row
        return self

    def execute(self):
        if self.table == "opportunities" and self.op == "select":
            if "translated_hash" in self.cols and not self.db.has_hash:
                raise RuntimeError("column opportunities.translated_hash does not exist")
            rows = [r for r in self.db.rows if all(f(r) for f in self.filters)]
            if hasattr(self, "rng"):
                rows = rows[self.rng[0]:self.rng[1] + 1]
            if hasattr(self, "lim"):
                rows = rows[:self.lim]
            return SimpleNamespace(data=[dict(r) for r in rows], count=len(rows))
        if self.op != "select":
            self.db.writes.append((self.table, self.op, self.payload))
        return SimpleNamespace(data=[], count=0)


class DB:
    def __init__(self, rows, has_hash=True):
        self.rows, self.has_hash, self.writes = rows, has_hash, []

    def table(self, name):
        return Q(self, name)


class LLM:
    def __init__(self):
        self.calls = 0
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls += 1
        out = {"title_en": "Camp", "summary_en": "For kids", "details_en": "Programme"}
        return SimpleNamespace(
            content=[SimpleNamespace(type="tool_use", input=out)],
            usage=SimpleNamespace(input_tokens=800, output_tokens=120,
                                  cache_read_input_tokens=0, cache_creation_input_tokens=0))


def run_main(db, dry=False):
    llm = LLM()
    with mock.patch("db.get_client", return_value=db), \
            mock.patch.object(translate_en.api_guard, "client", return_value=llm), \
            mock.patch.object(translate_en, "DRY", dry), \
            mock.patch.object(translate_en, "WORKERS", 1), \
            mock.patch.object(translate_en, "SPEND", translate_en.usage.Spend("translate-en")), \
            mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test", "GITHUB_WORKFLOW_REF": ""}), \
            mock.patch("builtins.print"):
        translate_en.main()
    return llm


class MainRun(unittest.TestCase):
    def rows(self):
        return [
            translated(id="fresh", updated_at="2026-10-03T00:00:00+00:00"),  # лише updated_at
            translated(id="edited", translated_hash="старий-хеш"),             # текст змінено
            translated(id="never", translated_at=None, translated_hash=None),  # без перекладу
        ]

    def test_only_changed_and_untranslated_are_translated(self):
        db = DB(self.rows())
        llm = run_main(db)
        self.assertEqual(llm.calls, 2)                      # «fresh» не перекладали
        patches = [p for t, _, p in db.writes if t == "opportunities"]
        self.assertEqual(len(patches), 2)
        # Кожен переклад несе хеш тексту, з якого його зроблено.
        self.assertEqual({p["translated_hash"] for p in patches},
                         {translate_en.text_hash(r) for r in self.rows()
                          if r["id"] in ("edited", "never")})

    def test_spend_is_recorded(self):
        db = DB(self.rows())
        run_main(db)
        usage_rows = [p for t, op, p in db.writes if t == "llm_usage"]
        self.assertEqual(len(usage_rows), 1)
        self.assertEqual(usage_rows[0]["workflow"], "translate-en")
        self.assertEqual(usage_rows[0]["model"], translate_en.MODEL)
        self.assertEqual(usage_rows[0]["calls"], 2)

    def test_dry_run_writes_nothing(self):
        db = DB(self.rows())
        llm = run_main(db, dry=True)
        self.assertEqual(llm.calls, 2)
        self.assertEqual(db.writes, [])

    def test_without_migration_falls_back_to_updated_at(self):
        # Колонки ще немає: стара поведінка, і хеш у patch не потрапляє,
        # інакше кожен переклад упав би на «немає колонки».
        rows = [
            translated(id="touched", updated_at="2026-10-03T00:00:00+00:00"),
            translated(id="never", translated_at=None),
        ]
        for r in rows:
            r.pop("translated_hash")
        db = DB(rows, has_hash=False)
        llm = run_main(db)
        self.assertEqual(llm.calls, 2)
        for t, _, patch in db.writes:
            if t == "opportunities":
                self.assertNotIn("translated_hash", patch)


if __name__ == "__main__":
    unittest.main()
