"""Перевірка масово зібраних гуртків (audit_clubs.py, 21.09.2026).

Головне правило: довідник без дат — не підтвердження, і жодна дія над
записом не робиться без дослівної цитати зі сторінки організатора.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import audit_clubs as ac  # noqa: E402

TODAY = "2026-09-21"
ORG_PAGE = ("Гурток «Астрономія» для учнів 4-11 класів. Заняття безкоштовні, "
            "проводяться на базі ЗОШ № 8, Майдан Згоди, 5.")
ROW = {"id": "x", "title": "Астрономія", "age_from": 10, "age_to": 18,
       "cost_type": "free", "admin_comment": "gurtok.org"}


class BulkSource(unittest.TestCase):
    def test_source_labels(self):
        self.assertEqual(ac.bulk_domain("Гурток (gurtok.org)"), "gurtok.org")
        self.assertEqual(ac.bulk_domain("Школяр (shkolyar.org.ua)"), "shkolyar.org.ua")
        self.assertEqual(ac.bulk_domain("Харківський обласний ПДЮТ (firstpalace.kh.ua)"), "firstpalace.kh.ua")
        self.assertIsNone(ac.bulk_domain("Eurodesk"))
        self.assertIsNone(ac.bulk_domain(None))

    def test_directories_vs_organizer_sites(self):
        self.assertTrue(ac.BULK_SOURCES["gurtok.org"])
        self.assertTrue(ac.BULK_SOURCES["shkolyar.org.ua"])
        self.assertFalse(ac.BULK_SOURCES["firstpalace.kh.ua"])


class OrganizerLinks(unittest.TestCase):
    def test_site_from_text_and_links_without_socials_and_directory(self):
        html = """<html><body><header><a href="https://gurtok.org/">Головна</a></header>
        <p>Адреса сайту: https://studio2s.business.site/</p>
        <a href="https://www.facebook.com/2Smaisternya/">Facebook</a>
        <a href="/club/chernigiv/other.html">Інший гурток</a>
        <a href="https://shkolyar.org.ua/club/x">Школяр</a>
        <p>Розклад занять за посиланням: https://mcnttum.zt.ua/courses_2_2.</p>
        <a href="https://mcnttum.zt.ua/courses_2_2">розклад</a>
        </body></html>"""
        links = ac.organizer_links(html, "https://shkolyar.org.ua/club/chernigiv/2s.html")
        self.assertEqual(links, ["https://mcnttum.zt.ua/courses_2_2", "https://studio2s.business.site/"])

    def test_no_site_no_links(self):
        html = "<p>Телефон: (050)172-24-84</p><a href='https://instagram.com/x'>ig</a>"
        self.assertEqual(ac.organizer_links(html, "https://gurtok.org/gurtok/yoga"), [])

    def test_gurtok_footer_is_not_organizer(self):
        # Підвал gurtok.org на кожній сторінці: логотип міськради й розробник.
        html = """<p>Центр неформальної освіти КЦ «ПРОСТО», вул. Київська, 81</p>
        <div class="footer_logos"><a href="http://zt-rada.gov.ua/"><img alt="zt-rada"></a></div>
        <a href="http://rostdigital.com">Розробка сайту</a>"""
        self.assertEqual(ac.organizer_links(html, "https://gurtok.org/gurtok/english-like"), [])


class ParseUrls(unittest.TestCase):
    def test_json_from_search_answer(self):
        text = 'Знайшов: {"urls": ["https://mcnttum.zt.ua/courses_2_2", "https://gurtok.org/x", "https://facebook.com/x"]}'
        self.assertEqual(ac.parse_urls(text), ["https://mcnttum.zt.ua/courses_2_2"])

    def test_nothing_found(self):
        self.assertEqual(ac.parse_urls('{"urls": []}'), [])
        self.assertEqual(ac.parse_urls("Офіційної сторінки не знайдено."), [])
        self.assertEqual(ac.parse_urls('{"urls": ["не адреса"]}'), [])


class BuildPatch(unittest.TestCase):
    def test_confirmed_marks_checked_and_fixes_age_with_quote(self):
        ans = {"verdict": "confirmed", "evidence": "Гурток «Астрономія» для учнів 4-11 класів",
               "age_from": 9, "age_to": 17, "age_evidence": "для учнів 4-11 класів"}
        verdict, patch, _ = ac.build_patch(ROW, ans, ORG_PAGE, TODAY)
        self.assertEqual(verdict, "confirmed")
        self.assertEqual((patch["age_from"], patch["age_to"]), (9, 17))
        self.assertIn("content_checked_at", patch)
        self.assertIn("перевірка гуртків 2026-09-21: підтверджено", patch["admin_comment"])

    def test_confirmed_without_quote_is_not_confirmed(self):
        # Модель написала власний висновок замість цитати — «Перевірено» не ставимо.
        ans = {"verdict": "confirmed", "evidence": "гурток, судячи з усього, працює і зараз"}
        verdict, patch, _ = ac.build_patch(ROW, ans, ORG_PAGE, TODAY)
        self.assertEqual(verdict, "unverified")
        self.assertEqual(patch, {})

    def test_directory_text_alone_confirms_nothing(self):
        # evidence_text для довідника — лише сайт організатора; якщо його
        # немає, цитата з довідника нічого не підтверджує.
        ans = {"verdict": "confirmed", "evidence": "Гурток «Астрономія» для учнів 4-11 класів"}
        verdict, patch, _ = ac.build_patch(ROW, ans, "", TODAY)
        self.assertEqual(verdict, "unverified")
        self.assertEqual(patch, {})

    def test_address_is_not_confirmation(self):
        # Пробний прогін 21.09.2026: «Зарубіжна література» «підтверджена» адресою.
        page = "Обласний центр творчості. Адреса: 10003 м. Житомир вул Троянівська 20"
        ans = {"verdict": "confirmed", "evidence": "Адреса: 10003 м. Житомир вул Троянівська 20"}
        verdict, patch, _ = ac.build_patch(dict(ROW, title="Зарубіжна література"), ans, page, TODAY)
        self.assertEqual((verdict, patch), ("unverified", {}))

    def test_own_page_head_confirms_club(self):
        # Модель склеїла цитату з двох шматків — але це власна сторінка гуртка
        # на сайті палацу, і назва стоїть у заголовку.
        head = "Гурток «Основи ветеринарної медицини». Керівник – Ксенія Уколова – КЗ «Харківський обласний Палац»"
        ans = {"verdict": "confirmed", "evidence": "Гурток «Основи ветеринарної медицини» запрошує дітей від 14 років"}
        row = dict(ROW, title="Гурток «Основи ветеринарної медицини»")
        verdict, patch, _ = ac.build_patch(row, ans, head, TODAY, own_head=head)
        self.assertEqual(verdict, "confirmed")
        self.assertIn("content_checked_at", patch)

    def test_own_page_about_other_club_confirms_nothing(self):
        head = "Гурток «Шахи» - Запорізький міський палац дитячої та юнацької творчості"
        verdict, patch, _ = ac.build_patch(dict(ROW, title="Телевізійна майстерня"),
                                           {"verdict": "unverified", "reason": "про інше"},
                                           head, TODAY, own_head=head)
        self.assertEqual((verdict, patch), ("unverified", {}))

    def test_names_activity_by_stem(self):
        self.assertTrue(ac.names_activity("17 музичних інструментів: скрипка, віолончель",
                                          "Струнно-смичкові інструменти"))
        self.assertTrue(ac.names_activity("гурток «Шахи» для дітей від 6 років", "Гурток «Шахи»"))
        self.assertTrue(ac.names_activity("гурток в’язання гачком", "Гурток «В'язання»"))
        # «Гурток» є на кожній сторінці — сам по собі нічого не підтверджує.
        self.assertFalse(ac.names_activity("Запрошуємо до гуртків центру", "Гурток «Шахи»"))

    def test_gone_closes_with_quote(self):
        page = "Шановні батьки! З 1 вересня 2025 року студія припинила роботу."
        ans = {"verdict": "gone", "evidence": "З 1 вересня 2025 року студія припинила роботу"}
        verdict, patch, _ = ac.build_patch(ROW, ans, page, TODAY)
        self.assertEqual(verdict, "gone")
        self.assertEqual(patch["status"], "closed")

    def test_unverified_touches_nothing_by_default(self):
        verdict, patch, _ = ac.build_patch(ROW, {"verdict": "unverified", "reason": "сайту немає"}, "", TODAY)
        self.assertEqual((verdict, patch), ("unverified", {}))

    def test_unverified_hidden_only_on_request(self):
        _, patch, _ = ac.build_patch(ROW, {"verdict": "unverified", "reason": "сайту немає"}, "",
                                     TODAY, hide_unverified=True)
        self.assertEqual(patch["status"], "draft")
        self.assertIn("не підтверджено", patch["moderation_note"])

    def test_paid_needs_quote_and_keeps_premium(self):
        page = "Гурток «Астрономія»: вартість заняття — 250 грн, абонемент на місяць 1800 грн."
        ans = {"verdict": "confirmed", "evidence": "Гурток «Астрономія»: вартість заняття — 250 грн",
               "cost": "paid", "cost_evidence": "вартість заняття — 250 грн"}
        _, patch, _ = ac.build_patch(dict(ROW, cost_type="free"), ans, page, TODAY)
        self.assertEqual(patch["cost_type"], "paid_affordable")
        _, patch, _ = ac.build_patch(dict(ROW, cost_type="paid_premium"), ans, page, TODAY)
        self.assertNotIn("cost_type", patch)

    def test_age_outside_0_18_is_ignored(self):
        ans = {"verdict": "confirmed", "evidence": "Гурток «Астрономія» для учнів 4-11 класів",
               "age_from": 9, "age_to": 23, "age_evidence": "для учнів 4-11 класів"}
        _, patch, _ = ac.build_patch(ROW, ans, ORG_PAGE, TODAY)
        self.assertEqual(patch.get("age_from"), 9)
        self.assertNotIn("age_to", patch)


if __name__ == "__main__":
    unittest.main()
