"""Діаспора: школи МІОК, та сама школа з двох джерел, правила промптів, профіль пошуку.

Рішення Марії 28.09.2026: платні діаспорні школи — «платно»; одна постійна
картка на суботню школу; українське за змістом — наше навіть відкрите всім;
фестивалі Союзу українців у Польщі й табори УГКЦ — наші; у summary прямо
«для українських дітей, які живуть у …»; державні програми країни — першими.
"""
import importlib
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import keywords  # noqa: E402
import link_check  # noqa: E402
from db import same_school, school_key, school_twin_resolution  # noqa: E402
from scrapers import diaspora_schools as ds  # noqa: E402

COUNTRY_PAGE = """<html><head><title>Іспанія</title></head><body>
<h1>Іспанія</h1>
<select class="country-school-select" name="schools-select-school">
  <option value="">Пошук по назві</option>
  <option value="14">Українська школа «Мрія»</option>
  <option value="49">Українська школа ім. Т. Шевченка в Барселоні</option>
</select>
<select class="country-school-select" name="schools-select-high_studio">
  <option value="344">Кафедра україністики</option>
</select>
<select class="country-school-select" name="schools-select-culture_center">
  <option value="306">Український культурно-освітній центр «Спілка — Моя Україна»</option>
  <option value="14">Українська школа «Мрія»</option>
</select>
</body></html>"""

SCHOOL_PAGE = """<html><body><h1>Українська школа «Мрія» (Іспанія)</h1>
<div class="section-description">Суботня школа для дітей від 4 до 16 років. Заняття щосуботи
з 10:00 до 14:00: українська мова, література, історія України, народознавство. Адреса:
Мадрид, Calle Mayor 1. Контакти: школа@example.com. Школа працює при громаді з 2008 року і
навчає дітей українських родин, які живуть в Іспанії.</div></body></html>"""


class MiokCatalog(unittest.TestCase):
    def test_new_countries(self):
        for code in ("es", "nl", "it", "pl", "de", "cz"):
            self.assertIn(code, ds.TARGET_COUNTRIES)
        self.assertEqual(ds.TARGET_COUNTRIES["es"], "Іспанія")

    def test_country_page_lists_schools_without_university_chairs(self):
        rows = ds.parse_country(COUNTRY_PAGE, "es")
        self.assertEqual([r[0] for r in rows], [14, 49, 306])  # 344 — кафедра, 14 — лише раз
        self.assertEqual(rows[2][1], "culture_center")

    def test_wrong_country_heading_gives_nothing(self):
        self.assertEqual(ds.parse_country(COUNTRY_PAGE, "it"), [])

    def test_school_page_carries_country_code(self):
        item = ds.parse_school(SCHOOL_PAGE, "https://vsesvit.miok.lviv.ua/schools/14", "es")
        self.assertTrue(item["raw_text"].startswith("Країна: Іспанія (es). Розділ каталогу: Школи."))
        self.assertEqual(item["source"], ds.SOURCE_NAME)

    def test_empty_card_skipped(self):
        self.assertIsNone(ds.parse_school("<h1>Школа (Італія)</h1><p>Адреса:</p>",
                                          "https://x/schools/1", "it"))


def rec(title, country, cities, source="Освітній Всесвіт (МІОК)", status="draft",
        typ="club", slug="s"):
    return {"title": title, "countries": [country], "cities": cities, "source": source,
            "status": status, "opportunity_type": typ, "slug": slug}


class SameSchool(unittest.TestCase):
    """Картка МІОК і картка з сайту самої школи — одна школа."""

    def test_miok_and_direct_source_are_the_same_school(self):
        miok = rec("Українська суботня школа «Берегиня» в Барселоні", "es", ["Барселона"])
        direct = rec("Берегиня — українська школа в Барселоні: набір на 2026/27", "es",
                     ["Барселона"], source="beregynia.es")
        self.assertTrue(same_school(miok, direct))

    def test_quotes_style_does_not_matter(self):
        a = rec('Українська школа "Джерело" м. Амстердам', "nl", ["Амстердам"])
        b = rec("Школа «Джерело» — українська суботня школа для дітей", "nl", [])
        self.assertTrue(same_school(a, b))

    def test_same_name_other_city_is_another_school(self):
        # У каталозі МІОК справді дві «Джерело»: Амстердам і Алмере.
        a = rec("Українська школа «Джерело» в Амстердамі", "nl", ["Амстердам"])
        b = rec("Українська школа «Джерело» в Алмере", "nl", ["Алмере"])
        self.assertFalse(same_school(a, b))

    def test_other_country_or_other_opportunity_is_not_a_twin(self):
        a = rec("Українська школа «Мрія»", "es", ["Мадрид"])
        self.assertFalse(same_school(a, rec("Українська школа «Мрія»", "it", ["Мадрид"])))
        contest = rec("Конкурс читців школи «Мрія»", "es", ["Мадрид"], typ="competition")
        self.assertFalse(same_school(a, contest))

    def test_unnamed_schools_need_the_same_title_and_city(self):
        a = rec("Українська суботня школа в Берліні", "de", ["Берлін"])
        self.assertTrue(same_school(a, rec("Українська суботня школа в Берліні", "de", ["Берлін"])))
        self.assertFalse(same_school(a, rec("Українська школа в Берліні", "de", ["Берлін"])))

    def test_ukraine_is_not_diaspora(self):
        self.assertIsNone(school_key(rec("Школа «Мрія»", "ua", ["Київ"])))

    def test_miok_draft_gives_way_to_the_school_itself(self):
        miok = rec("Українська школа «Мрія»", "es", ["Мадрид"])
        direct = rec("Українська школа «Мрія»", "es", ["Мадрид"], source="mriya.es")
        self.assertEqual(school_twin_resolution(direct, miok), "twin_is_dup")
        # Активна картка МІОК уже на сайті — новачок стає дублем.
        self.assertEqual(school_twin_resolution(direct, {**miok, "status": "active"}), "new_is_dup")
        # Друга картка МІОК про ту саму школу — дубль.
        self.assertEqual(school_twin_resolution(miok, direct), "new_is_dup")


class GuardMarksTheTwin(unittest.TestCase):
    """guard_same_school на фейковому клієнті: чернетка з dup_of, як тригер бази."""

    class _Q:
        def __init__(self, rows, log):
            self.rows, self.log = rows, log

        def __getattr__(self, name):
            def chain(*a, **k):
                if name == "update":
                    self.log.append(a[0])
                return self
            return chain

        def execute(self):
            return type("R", (), {"data": self.rows})()

    class _Client:
        def __init__(self, rows):
            self.rows, self.log = rows, []

        def table(self, _name):
            return GuardMarksTheTwin._Q(self.rows, self.log)

    def test_new_card_becomes_draft_dup(self):
        from db import guard_same_school
        active = rec("Українська школа «Мрія»", "es", ["Мадрид"], status="active", slug="mriia-1")
        client = self._Client([active])
        new = rec("Українська суботня школа «Мрія» у Мадриді", "es", ["Мадрид"],
                  status="active", slug="mriia-2")
        guard_same_school(client, new)
        self.assertEqual((new["status"], new["dup_of"]), ("draft", "mriia-1"))

    def test_miok_draft_is_marked_when_school_site_arrives(self):
        from db import guard_same_school
        miok = rec("Українська школа «Мрія»", "es", ["Мадрид"], slug="mriia-miok")
        client = self._Client([{**miok, "id": "x"}])
        new = rec("Українська школа «Мрія»", "es", ["Мадрид"], source="mriya.es",
                  status="active", slug="mriia-site")
        guard_same_school(client, new)
        self.assertEqual(new["status"], "active")
        self.assertEqual(client.log[0]["dup_of"], "mriia-site")


class LinkTimeout(unittest.TestCase):
    def test_timeout_is_not_death(self):
        self.assertTrue(link_check.is_timeout("network: ConnectTimeout"))
        self.assertTrue(link_check.is_timeout("network: ReadTimeout"))
        self.assertFalse(link_check.is_timeout("network: ConnectError"))
        self.assertFalse(link_check.is_timeout("http 404"))


class PromptRules(unittest.TestCase):
    """Правила 28.09.2026 стоять у всіх трьох промптах; межа «не наше» не зникла."""

    def test_normalizer(self):
        from normalizer import SYSTEM_PROMPT as p
        for phrase in ("БЕЗ УКРАЇНСЬКОГО ЗМІСТУ", "міська музична школа", "Союзу українців у Польщі",
                       "табір УГКЦ", "ОДНА постійна", "paid_affordable, якщо родина платить хоч щось",
                       "для українських дітей, які живуть у", "Поїздку З України",
                       "Муніципальний фонд", "Bildung und Teilhabe", "800+"):
            self.assertIn(phrase, p)
        # Суботня школа — виняток із «закладу на роки».
        self.assertIn("суботня чи недільна школа за кордоном — НЕ такий заклад", p)

    def test_judge(self):
        from auto_review import JUDGE_PROMPT as p
        for phrase in ("БЕЗ УКРАЇНСЬКОГО ЗМІСТУ", "міська музична школа", "табір УГКЦ",
                       "Союзу українців у Польщі", "НЕ РЕКЛАМА", "які живуть у Німеччині",
                       "фонд однієї голландської громади"):
            self.assertIn(phrase, p)


def _reload(**env):
    for k in ("DISCOVER_PROFILE", "DISCOVER_KEYWORD", "DISCOVER_REGION",
              "DISCOVER_DEFICIT_CELL", "DISCOVER_AGE_BAND"):
        os.environ.pop(k, None)
    os.environ.update(env)
    import discover_agent
    return importlib.reload(discover_agent)


class DiasporaProfile(unittest.TestCase):
    def tearDown(self):
        _reload()

    def test_regions_cover_required_countries(self):
        codes = {r["code"] for r in keywords.DIASPORA_REGIONS}
        self.assertTrue({"pl", "de", "es", "ie", "it", "nl", "cz"} <= codes)
        for r in keywords.DIASPORA_REGIONS:
            self.assertTrue(r["state_hint"] and r["in_country"])

    def test_state_programmes_first(self):
        self.assertEqual(keywords.DIASPORA_KEYWORDS[:len(keywords.DIASPORA_STATE_KEYWORDS)],
                         keywords.DIASPORA_STATE_KEYWORDS)
        self.assertGreater(len(keywords.DIASPORA_STATE_KEYWORDS),
                           len(keywords.DIASPORA_COMMUNITY_KEYWORDS))
        for w in keywords.DIASPORA_KEYWORDS:
            self.assertNotIn("виплат", w)

    def test_explicit_profile(self):
        da = _reload(DISCOVER_PROFILE="diaspora", DISCOVER_REGION="Іспанія")
        region = da.region_of_day()
        self.assertTrue(da.is_diaspora(region))
        self.assertIn(da.keyword_of_day(True), keywords.DIASPORA_KEYWORDS)
        p = da._prompt("українські суботні й недільні школи", region)
        self.assertIn("ВЖЕ ЖИВУТЬ в Іспанії", p)
        self.assertIn("Для українських дітей, які живуть в Іспанії", p)
        self.assertIn('countries — ["es"]', p)
        self.assertLess(p.index("СПЕРШУ державні"), p.index("ЛИШЕ ПОТІМ"))
        self.assertIn("aulas de enlace", p)
        self.assertIn("грошові виплати родині", p)

    def test_daily_diaspora_day_ignores_deficit_theme(self):
        da = _reload(DISCOVER_KEYWORD="конкурси для дітей 7–10 років",
                     DISCOVER_DEFICIT_CELL="contests:7-10", DISCOVER_AGE_BAND="7-10",
                     DISCOVER_REGION="Польща")
        region = da.region_of_day()
        self.assertTrue(da.is_diaspora(region))
        self.assertIn(da.keyword_of_day(True), keywords.DIASPORA_KEYWORDS)
        self.assertNotIn("ВІК: шукай саме", da._prompt("x", region))
        # Україна того ж дня — як і було: тема й вік від дефіциту.
        self.assertEqual(da.keyword_of_day(False), "конкурси для дітей 7–10 років")
        self.assertFalse(da.is_diaspora(keywords.HOME_REGION))

    def test_manual_keyword_still_wins(self):
        da = _reload(DISCOVER_KEYWORD="табори УГКЦ", DISCOVER_REGION="Польща")
        self.assertEqual(da.keyword_of_day(True), "табори УГКЦ")

    def test_rare_profile_still_rejects_residents_only(self):
        da = _reload(DISCOVER_PROFILE="rare_abroad", DISCOVER_REGION="Польща")
        region = da.region_of_day()
        self.assertFalse(da.is_diaspora(region))
        p = da._prompt("тенісний табір для українських дітей", region)
        self.assertIn("вимагає проживати в цій країні", p)
        self.assertNotIn("ДЛЯ ДІАСПОРИ", p)
        ok, _ = da.decide_verified({
            "page_kind": "one_opportunity", "for_children": True,
            "children_evidence": "для дітей від 7 до 14 років",
            "eligibility": "for_ukrainians", "eligibility_evidence": "для дітей з України у Польщі",
            "kind": "unusual", "residency": "residents_only",
            "residency_evidence": "тільки для родин, які проживають у Польщі",
            "is_current": "current", "date_evidence": ""},
            "для дітей від 7 до 14 років. для дітей з України у Польщі. "
            "тільки для родин, які проживають у Польщі")
        self.assertFalse(ok)

    def test_daily_rotation_unchanged_in_size(self):
        # Кількість прогонів не змінилась: той самий один пошук на день,
        # просто дні країн тепер шукають за профілем діаспори.
        self.assertEqual(len(keywords.NATIONWIDE_ROTATION), 2 * len(keywords.DIASPORA_REGIONS))


if __name__ == "__main__":
    unittest.main()
