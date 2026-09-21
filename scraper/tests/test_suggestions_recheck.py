"""Пропозиції від людей: повторна звірка з базою і листи відправникам.

21.09.2026, розбір Марії: троє з шести пропозицій тиждень чекали людини,
хоча записи про ті самі виплати зʼявились у базі того ж дня — просто
пізніше за пропозиції. Дублі ловились лише в момент надходження.

Того ж дня: відправник дізнається й про публікацію — окремим листом із
пропозицією «Топ тижня», один раз.
"""
import pathlib
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import process_suggestions as ps  # noqa: E402


class _Query:
    """Мінімальна підробка ланцюжка supabase-py: select/eq/in_/is_/gte/
    order/limit/update/execute."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.patch = db, table, {}, None
        self.checks = []

    def select(self, *_):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def in_(self, col, vals):
        self.checks.append(lambda r: r.get(col) in vals)
        return self

    def is_(self, col, val):
        assert val == "null"
        self.checks.append(lambda r: r.get(col) is None)
        return self

    def gte(self, col, val):
        self.checks.append(lambda r: (r.get(col) or "") >= val)
        return self

    def update(self, patch):
        self.patch = patch
        return self

    def execute(self):
        rows = [r for r in self.db[self.table]
                if all(r.get(c) == v for c, v in self.filters.items())
                and all(check(r) for check in self.checks)]
        if self.patch is not None:
            for r in rows:
                r.update(self.patch)
        return mock.Mock(data=rows)


class _DB:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables, name)


KYIV = "https://kyivcity.gov.ua/news/kompensatsiya/"


def make_db():
    return _DB({
        "opportunity_suggestions": [
            {"id": "a", "status": "needs_human", "url": KYIV, "title": "Київ: компенсація", "contact": None},
            {"id": "b", "status": "needs_human", "url": "https://rivnesoc.gov.ua/x/", "title": "Рівне", "contact": None},
            {"id": "c", "status": "new", "url": KYIV, "title": "Нова, не чіпати", "contact": None},
        ],
        "opportunities": [
            {"slug": "kyiv-komp", "title": "Київ: компенсація до 40 000 грн",
             "status": "active", "source_url": KYIV, "canonical_url": KYIV},
        ],
    })


class RecheckWaiting(unittest.TestCase):
    def setUp(self):
        # Канонізацію URL не перевіряємо тут — лише звірку з базою.
        patcher = mock.patch.object(ps, "canonical_url", side_effect=lambda u: u)
        patcher.start()
        self.addCleanup(patcher.stop)

    def status(self, db, sid):
        return next(r["status"] for r in db.tables["opportunity_suggestions"] if r["id"] == sid)

    def test_waiting_duplicate_is_closed(self):
        db = make_db()
        self.assertEqual(ps.recheck_waiting(db, apply=True), 1)
        self.assertEqual(self.status(db, "a"), "duplicate")

    def test_waiting_without_record_stays_for_human(self):
        db = make_db()
        ps.recheck_waiting(db, apply=True)
        self.assertEqual(self.status(db, "b"), "needs_human")

    def test_new_ones_are_not_touched_here(self):
        db = make_db()
        ps.recheck_waiting(db, apply=True)
        self.assertEqual(self.status(db, "c"), "new")

    def test_dry_run_changes_nothing(self):
        db = make_db()
        self.assertEqual(ps.recheck_waiting(db, apply=False), 1)
        self.assertEqual(self.status(db, "a"), "needs_human")

    def test_popup_sender_gets_letter(self):
        db = make_db()
        db.tables["opportunity_suggestions"][0]["contact"] = "apply@seniv.studio"
        with mock.patch.object(ps, "send_email") as send:
            ps.recheck_waiting(db, apply=True)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0], "apply@seniv.studio")

    def test_manual_row_organiser_gets_no_letter(self):
        # Рядок, який внесли ми самі: contact — організатор, а не той, хто
        # нам писав. Лист «дякуємо, що надіслали» йому був би неправдою.
        db = make_db()
        row = db.tables["opportunity_suggestions"][0]
        row.update(origin="research", contact="info@kyivcity.gov.ua")
        with mock.patch.object(ps, "send_email") as send:
            ps.recheck_waiting(db, apply=True)
        send.assert_not_called()
        self.assertEqual(self.status(db, "a"), "duplicate")


RECENT = "2026-09-20T10:00:00+00:00"
STRUNY = "https://seniv.studio/uk/contests/struny-oseni-2026"


def published_db(opp_status="active", sug_status="imported", **sug):
    row = {"id": "s1", "status": sug_status, "url": STRUNY, "title": "Струни Осені 2026",
           "contact": "apply@seniv.studio", "created_at": RECENT}
    row.update(sug)
    return _DB({
        "opportunity_suggestions": [row],
        "opportunities": [
            {"slug": "struny-oseni-2026", "title": "Струни Осені 2026", "status": opp_status,
             "source_url": STRUNY, "canonical_url": STRUNY, "canonical_slug": None,
             "deadline": "2026-10-25", "event_start_date": "2026-10-31",
             "event_end_date": None, "cities": ["Львів"]},
        ],
    })


class NotifyPublished(unittest.TestCase):
    """Лист «опубліковано» — коли чернетка з пропозиції вийшла на сайт."""

    def setUp(self):
        patcher = mock.patch.object(ps, "canonical_url", side_effect=lambda u: u)
        patcher.start()
        self.addCleanup(patcher.stop)
        sender = mock.patch.object(ps, "send_email", return_value=True)
        self.send = sender.start()
        self.addCleanup(sender.stop)

    def row(self, db):
        return db.tables["opportunity_suggestions"][0]

    def test_published_gets_one_letter_with_offer(self):
        db = published_db()
        self.assertEqual(ps.notify_published(db, apply=True), 1)
        to, subject, body = self.send.call_args.args
        self.assertEqual(to, "apply@seniv.studio")
        self.assertEqual(subject, ps.SUBJECT_PUBLISHED)
        self.assertIn("https://dityam.com.ua/o/struny-oseni-2026", body)
        self.assertIn("«Топ тижня»", body)
        self.assertIn("500 грн", body)
        self.assertIn("Марія Шутяк", body)
        self.assertNotIn("Бережна", body)
        self.assertIsNotNone(self.row(db)["published_letter_at"])

    def test_second_pass_sends_nothing(self):
        db = published_db()
        ps.notify_published(db, apply=True)
        self.send.reset_mock()
        self.assertEqual(ps.notify_published(db, apply=True), 0)
        self.send.assert_not_called()

    def test_draft_waits(self):
        db = published_db(opp_status="draft")
        self.assertEqual(ps.notify_published(db, apply=True), 0)
        self.send.assert_not_called()
        self.assertIsNone(self.row(db).get("published_letter_at"))

    def test_failed_send_is_retried_next_pass(self):
        db = published_db()
        self.send.return_value = False
        self.assertEqual(ps.notify_published(db, apply=True), 0)
        self.assertIsNone(self.row(db).get("published_letter_at"))

    def test_same_person_twice_gets_one_letter(self):
        db = published_db()
        twin = dict(self.row(db), id="s2", status="duplicate")
        db.tables["opportunity_suggestions"].append(twin)
        self.assertEqual(ps.notify_published(db, apply=True), 1)
        self.send.assert_called_once()
        self.assertTrue(all(r["published_letter_at"] for r in db.tables["opportunity_suggestions"]))

    def test_no_letter_for_our_own_rows_or_telegram_contact(self):
        for extra in ({"origin": "research", "contact": "info@seniv.studio"},
                      {"contact": "https://t.me/seniv"}):
            db = published_db(**extra)
            self.assertEqual(ps.notify_published(db, apply=True), 0)
        self.send.assert_not_called()

    def test_closed_by_hand_is_left_alone(self):
        for status in ("done", "dismissed", "new", "needs_human"):
            db = published_db(sug_status=status)
            self.assertEqual(ps.notify_published(db, apply=True), 0)
        self.send.assert_not_called()

    def test_stale_suggestion_is_skipped(self):
        db = published_db(created_at="2025-01-01T00:00:00+00:00")
        self.assertEqual(ps.notify_published(db, apply=True), 0)

    def test_dry_run_counts_but_sends_nothing(self):
        db = published_db()
        self.assertEqual(ps.notify_published(db, apply=False), 1)
        self.send.assert_not_called()
        self.assertIsNone(self.row(db).get("published_letter_at"))


class ReplyDuplicate(unittest.TestCase):
    """Лист «уже є на платформі» — лише на сторінку, яку видно на сайті."""

    def setUp(self):
        sender = mock.patch.object(ps, "send_email", return_value=True)
        self.send = sender.start()
        self.addCleanup(sender.stop)

    def reply(self, status):
        db = published_db(opp_status=status, sug_status="new")
        s = db.tables["opportunity_suggestions"][0]
        existing = db.tables["opportunities"][0]
        return ps.reply_duplicate(db, s, existing, apply=True), s

    def test_active_gets_offer_and_is_marked(self):
        sent, s = self.reply("active")
        self.assertTrue(sent)
        self.assertIn("«Топ тижня»", self.send.call_args.args[2])
        self.assertIsNotNone(s["published_letter_at"])

    def test_closed_gets_no_offer(self):
        sent, _ = self.reply("closed")
        self.assertTrue(sent)
        self.assertNotIn("Топ тижня", self.send.call_args.args[2])

    def test_draft_gets_no_404_link(self):
        # Чернетку сайт не показує — посилання віддало б 404. Лист прийде
        # з notify_published після публікації.
        sent, s = self.reply("draft")
        self.assertFalse(sent)
        self.send.assert_not_called()
        self.assertIsNone(s.get("published_letter_at"))


class CardFacts(unittest.TestCase):
    def test_all_fields(self):
        o = {"deadline": "2026-10-25", "event_start_date": "2026-10-31", "cities": ["Львів"]}
        with mock.patch.object(ps, "datetime", wraps=ps.datetime) as dt:
            dt.now.return_value = ps.datetime(2026, 9, 21, tzinfo=ps.timezone.utc)
            facts = ps.card_facts(o)
        self.assertIn("заявки до 25 жовтня, проведення — 31 жовтня, місце — Львів", facts)

    def test_other_year_is_named(self):
        with mock.patch.object(ps, "datetime", wraps=ps.datetime) as dt:
            dt.now.return_value = ps.datetime(2026, 9, 21, tzinfo=ps.timezone.utc)
            self.assertEqual(ps.uk_date("2027-01-15"), "15 січня 2027")

    def test_nothing_known_nothing_said(self):
        self.assertEqual(ps.card_facts({"cities": []}), "")


class Origin(unittest.TestCase):
    """Хто приніс (колонка origin, 21.09.2026)."""

    def test_unknown_origin_is_popup(self):
        self.assertEqual(ps.origin_of({}), "popup")
        self.assertEqual(ps.origin_of({"origin": "щось"}), "popup")

    def test_source_for_manual_is_domain(self):
        url = "https://www.rada-poltava.gov.ua/ua/news/x"
        self.assertEqual(ps.source_label({"origin": "research"}, url), "rada-poltava.gov.ua")
        self.assertEqual(ps.source_label({"origin": "maria"}, url), "rada-poltava.gov.ua")
        self.assertEqual(ps.source_label({}, url), "Пропозиція від організатора")

    def test_reply_only_to_popup_email(self):
        self.assertEqual(ps.reply_email({"contact": " a@b.ua "}), "a@b.ua")
        self.assertIsNone(ps.reply_email({"contact": "https://t.me/kidsrightsplatform"}))
        self.assertIsNone(ps.reply_email({"origin": "maria", "contact": "a@b.ua"}))


if __name__ == "__main__":
    unittest.main()
