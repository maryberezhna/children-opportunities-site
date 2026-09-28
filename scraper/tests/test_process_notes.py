"""Один механізм коментарів модератора — відбір відкритих і закриття.

23.09.2026: механізмів було два (таблиця moderation_notes і
opportunities.moderation_note + note_status='pending'), зроблені паралельними
сесіями в один день. Вони не бачили один одного, і коментарі Марії висіли
необробленими. Тести тримають те, що після зведення не сміє зламатись:
відбирається тільки відкрите, закривається тільки зроблене, перенесення
старих нотаток безпечне при кожному запуску.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from process_notes import (  # noqa: E402
    APPLY_TOOL, build_patch, close_patch, decision_patch, failed_note_text, legacy_inserts,
    open_notes, partial_note_text, resolution_text, valid_source_url,
)
from normalizer import VALID_OPP_TYPES  # noqa: E402


def note(**over):
    base = {"id": 1, "opportunity_id": "aaa", "body": "вік 6–12",
            "action": "comment", "created_at": "2026-09-22T10:00:00+00:00",
            "resolved_at": None, "resolution": None, "attempted_at": None}
    base.update(over)
    return base


class OpenNotes(unittest.TestCase):
    def test_takes_open_comment(self):
        groups = open_notes([note()])
        self.assertEqual(list(groups), ["aaa"])
        self.assertEqual(groups["aaa"][0]["body"], "вік 6–12")

    def test_skips_resolved(self):
        self.assertEqual(open_notes([note(resolved_at="2026-09-22T12:00:00+00:00")]), {})

    def test_skips_other_actions(self):
        # approve / skip / verify / remove — це причини вже ухвалених рішень,
        # а не прохання щось зробити.
        for action in ("approve", "skip", "verify", "remove"):
            self.assertEqual(open_notes([note(action=action)]), {}, action)

    def test_skips_already_attempted(self):
        # Спроба вже була, модель нічого не змінила — це питання до людини.
        # Рядок лишається відкритим у зведенні, але LLM його вдруге не читає.
        self.assertEqual(open_notes([note(attempted_at="2026-09-22T11:00:00+00:00")]), {})

    def test_skips_empty_body(self):
        self.assertEqual(open_notes([note(body="   "), note(id=2, body=None)]), {})

    def test_groups_by_record_in_time_order(self):
        rows = [
            note(id=3, opportunity_id="bbb", body="третій", created_at="2026-09-22T12:00:00+00:00"),
            note(id=1, opportunity_id="aaa", body="перший", created_at="2026-09-20T09:00:00+00:00"),
            note(id=2, opportunity_id="aaa", body="другий", created_at="2026-09-21T09:00:00+00:00"),
        ]
        groups = open_notes(rows)
        self.assertEqual([n["body"] for n in groups["aaa"]], ["перший", "другий"])
        self.assertEqual([n["body"] for n in groups["bbb"]], ["третій"])

    def test_works_without_attempted_at_column(self):
        # Поки міграцію 20260923 не застосували, рядок приходить без ключа —
        # відбір це не сміє валити.
        row = note()
        row.pop("attempted_at")
        self.assertEqual(list(open_notes([row])), ["aaa"])


class Closing(unittest.TestCase):
    def test_closes_with_resolution(self):
        closing = close_patch({"age_from": 6, "age_to": 12}, now="2026-09-23T08:00:00+00:00")
        self.assertEqual(closing["resolved_at"], "2026-09-23T08:00:00+00:00")
        self.assertEqual(closing["resolution"],
                         "Застосовано автоматично: змінено вік від, вік до.")

    def test_empty_patch_stays_open(self):
        # Нічого не змінилось — коментар лишається людині. Мовчки поставити
        # resolved_at було б гірше за нинішню біду: питання зникло б і зі
        # зведення, і з картки в адмінці.
        self.assertIsNone(close_patch({}))
        self.assertIsNone(close_patch(None))

    def test_ignores_non_editable_keys(self):
        self.assertIsNone(close_patch({"updated_at": "2026-09-23", "status": "active"}))

    def test_resolution_order_is_stable(self):
        # Порядок полів — наш, не той, у якому їх повернула модель.
        first = resolution_text({"cities": ["Київ"], "title": "Нова назва"})
        second = resolution_text({"title": "Нова назва", "cities": ["Київ"]})
        self.assertEqual(first, second)
        self.assertEqual(first, "Застосовано автоматично: змінено назву, міста.")


class LegacyTransfer(unittest.TestCase):
    ROWS = [{"id": "aaa", "moderation_note": " це Київ, офлайн ",
             "updated_at": "2026-09-22T10:00:00+00:00"}]

    def test_moves_note_into_table(self):
        rows = legacy_inserts(self.ROWS, set())
        self.assertEqual(rows, [{
            "opportunity_id": "aaa", "body": "це Київ, офлайн",
            "action": "comment", "created_at": "2026-09-22T10:00:00+00:00",
        }])

    def test_idempotent(self):
        # Міст працює щогодини: той самий текст не сміє задвоїтись, інакше
        # людина двічі побачить те саме питання.
        self.assertEqual(legacy_inserts(self.ROWS, {("aaa", "це Київ, офлайн")}), [])

    def test_same_text_twice_in_one_run(self):
        doubled = self.ROWS + list(self.ROWS)
        self.assertEqual(len(legacy_inserts(doubled, set())), 1)

    def test_skips_empty(self):
        self.assertEqual(legacy_inserts([{"id": "aaa", "moderation_note": "  "},
                                         {"id": "bbb", "moderation_note": None}], set()), [])

    def test_does_not_mutate_caller_set(self):
        existing = set()
        legacy_inserts(self.ROWS, existing)
        self.assertEqual(existing, set())



class TypeOnlyFromDatabase(unittest.TestCase):
    """28.09.2026: коментар «треба окрему категорію» місяць падав щогодини —
    модель ставила тип «school», якого база не приймає."""

    def test_enum_is_exactly_database_types(self):
        spec = APPLY_TOOL["input_schema"]["properties"]["opportunity_type"]
        self.assertEqual(set(spec["enum"]), VALID_OPP_TYPES)

    def test_no_invented_school(self):
        spec = APPLY_TOOL["input_schema"]["properties"]["opportunity_type"]
        self.assertNotIn("school", spec["enum"])


class FirstSourceFromNote(unittest.TestCase):
    """28.09.2026: «[форма] Візьми першоджерело» закрилось як виконане, хоча
    source_url коментар міняти не міг — джерелом лишився допис @Mozhlyvosti."""

    PAGE = "https://rooterraorg.my.canva.site/olive-trees-html"
    FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfjMOjm7m/viewform"

    def test_source_is_editable(self):
        self.assertIn("source_url", APPLY_TOOL["input_schema"]["properties"])

    def test_page_becomes_source_with_canonical(self):
        patch = build_patch({"source_url": self.PAGE})
        self.assertEqual(patch["source_url"], self.PAGE)
        self.assertEqual(patch["canonical_url"], self.PAGE)
        self.assertEqual(resolution_text(patch), "Застосовано автоматично: змінено джерело.")

    def test_never_form_channel_or_drive(self):
        for url in (self.FORM, "https://forms.gle/abc", "https://t.me/Mozhlyvosti/10539",
                    "https://telegram.dog/tviyspace/1", "https://drive.google.com/file/d/x",
                    "https://www.instagram.com/p/x", "не адреса", ""):
            self.assertIsNone(valid_source_url(url), url)
            self.assertNotIn("source_url", build_patch({"source_url": url}), url)

    def test_our_channel_is_not_a_source_either(self):
        # Джерело — сторінка можливості, а не допис, навіть наш.
        self.assertIsNone(valid_source_url("https://t.me/dityam_com_ua/512"))

    def test_not_done_is_not_a_record_field(self):
        self.assertEqual(build_patch({"not_done": "джерело не змінено"}), {})


class PartialNote(unittest.TestCase):
    def test_partial_stays_open(self):
        # Саме цей випадок: форму поставлено в подачу, джерело — ні.
        patch = {"apply_url": "https://docs.google.com/forms/d/e/x/viewform"}
        self.assertIsNone(close_patch(patch, not_done="джерело не змінено: у коментарі лише форма"))

    def test_blank_not_done_closes(self):
        closing = close_patch({"age_from": 6}, now="2026-09-28T08:00:00+00:00", not_done="  ")
        self.assertEqual(closing["resolved_at"], "2026-09-28T08:00:00+00:00")

    def test_message_says_what_is_missing(self):
        text = partial_note_text({"title": "O-live <T.R.E.E.S.>"}, "Візьми першоджерело",
                                 "Застосовано автоматично: змінено посилання на подачу.",
                                 "джерело не змінено")
        self.assertIn("не повністю", text)
        self.assertIn("O-live &lt;T.R.E.E.S.&gt;", text)
        self.assertIn("Не зроблено: джерело не змінено", text)


FULL = {"status": "draft", "age_from": 12, "age_to": 17, "deadline": "2026-10-15",
        "cost_type": "free", "opportunity_type": "course", "format": "online"}


class DecisionFromNote(unittest.TestCase):
    """28.09.2026: жовта кнопка — «коли він обробиться, то виконати, що там
    написано». «Опублікуй» і «не підходить» — теж вказівки."""

    def test_publish_with_all_fields(self):
        patch, decided, problem = decision_patch(FULL, "publish", now="2026-09-28T10:00:00+00:00")
        self.assertEqual(patch, {"status": "active", "verified_at": "2026-09-28T10:00:00+00:00"})
        self.assertEqual(decided, "опубліковано на сайт")
        self.assertEqual(problem, "")

    def test_publish_without_fields_is_refused_and_says_why(self):
        patch, decided, problem = decision_patch({**FULL, "cost_type": None}, "publish")
        self.assertEqual(patch, {})
        self.assertIn("бракує: вартість", problem)

    def test_reject_goes_to_archive_with_reason(self):
        patch, decided, _ = decision_patch(FULL, "reject", "club")
        self.assertEqual(patch, {"status": "archived"})
        self.assertIn("гурток", decided)

    def test_unknown_reason_is_other(self):
        _, decided, _ = decision_patch(FULL, "reject", "school")
        self.assertIn("інше", decided)

    def test_no_decision_no_patch(self):
        self.assertEqual(decision_patch(FULL, ""), ({}, "", ""))

    def test_resolution_names_edits_and_decision(self):
        self.assertEqual(resolution_text({"age_from": 12}, "опубліковано на сайт"),
                         "Застосовано автоматично: змінено вік від; опубліковано на сайт.")
        self.assertEqual(resolution_text({}, "опубліковано на сайт"),
                         "Застосовано автоматично: опубліковано на сайт.")

    def test_decision_alone_closes_the_note(self):
        closing = close_patch({}, now="2026-09-28T10:00:00+00:00", decided="опубліковано на сайт")
        self.assertEqual(closing["resolution"], "Застосовано автоматично: опубліковано на сайт.")

    def test_tool_offers_only_known_reasons(self):
        import rejections
        spec = APPLY_TOOL["input_schema"]["properties"]["reject_reason"]
        self.assertEqual(set(spec["enum"]), set(rejections.load_reasons()))


class FailedNoteText(unittest.TestCase):
    def test_names_record_note_and_error(self):
        text = failed_note_text({"title": "Ліцей «А»"}, "треба окрему категорію",
                                "violates check constraint opportunities_opportunity_type_check")
        self.assertIn("Ліцей «А»", text)
        self.assertIn("треба окрему категорію", text)
        self.assertIn("opportunity_type_check", text)

    def test_escapes_html(self):
        text = failed_note_text({"title": "<b>x</b> & y"}, "a<b", "e>f")
        self.assertIn("&lt;b&gt;x&lt;/b&gt; &amp; y", text)
        self.assertIn("a&lt;b", text)
        self.assertIn("e&gt;f", text)


if __name__ == "__main__":
    unittest.main()
