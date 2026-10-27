"""Профіль Dityam+ для кількох дітей і добір під нього.

Дзеркало tests/plusProfile.test.mjs — правити обидва файли. Бот на JS і
дайджест із нагадуваннями на Python мусять добирати однаково, інакше дитина
отримає в боті одне, а в розсилці інше.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import plus_profile as pp  # noqa: E402


def opp(**over):
    o = {"id": "x", "opportunity_type": "club", "age_from": 6, "age_to": 12,
         "cost_type": "free", "format": "offline", "cities": ["Львів"],
         "countries": ["ua"], "is_international": False, "child_needs": []}
    o.update(over)
    return o


def kid(position=1, **over):
    c = {"position": position, "age_bands": [], "likes": [], "formats": [], "needs": []}
    c.update(over)
    return c


class Place(unittest.TestCase):
    def test_empty_choice_means_anywhere(self):
        self.assertTrue(pp.place_ok(opp(), []))

    # Рішення Марії 22.09.2026: «стоп, ми не гарантуємо, що будуть можливості
    # саме з міста» → «показувати все по Україні, онлайн і закордоном».
    def test_online_all_ukraine_and_abroad_come_to_everyone(self):
        for places in (["Київ"], ["__other"], ["Ніжин", "Коломия"]):
            self.assertTrue(pp.place_ok(opp(format="online", cities=[]), places))
            self.assertTrue(pp.place_ok(opp(format="hybrid"), places))
            self.assertTrue(pp.place_ok(opp(cities=["Онлайн"]), places))
            self.assertTrue(pp.place_ok(opp(cities=["Вся Україна"]), places))
            self.assertTrue(pp.place_ok(opp(countries=["pl"], is_international=True, cities=[]), places))
            self.assertTrue(pp.place_ok(opp(is_international=True, cities=[]), places))
            self.assertTrue(pp.place_ok(opp(cities=["Міжнародні"]), places))

    def test_city_only_adds_offline_nearby(self):
        self.assertTrue(pp.place_ok(opp(), ["Львів"]))
        self.assertTrue(pp.place_ok(opp(), ["Київ", "Львів"]))
        self.assertFalse(pp.place_ok(opp(), ["Київ"]))
        self.assertFalse(pp.place_ok(opp(), ["__other"]))

    # До 22.09.2026 «Онлайн» і «За кордоном» були кнопками; у збережених
    # профілях ці значення лишились. Вони не місто: нічого не додають і не забирають.
    def test_legacy_online_abroad_values_are_harmless(self):
        self.assertFalse(pp.place_ok(opp(), ["online", "abroad"]))
        self.assertTrue(pp.place_ok(opp(), ["online", "Львів"]))
        self.assertTrue(pp.place_ok(opp(format="online", cities=[]), ["online"]))

    def test_unknown_place_is_not_guessed(self):
        self.assertFalse(pp.place_ok(opp(format=None, cities=[], countries=None), ["Київ"]))
        self.assertFalse(pp.place_ok(opp(format="offline", cities=[], countries=["ua"]), ["Київ"]))

    def test_chosen_cities_drop_pseudo_values(self):
        self.assertEqual(pp.chosen_cities(["Ніжин", "online", "abroad", "__other"]), ["Ніжин"])
        self.assertEqual(pp.chosen_cities(None), [])


class Child(unittest.TestCase):
    def test_formats_by_type_and_theme_fallback(self):
        self.assertEqual(pp.formats_of(opp(opportunity_type="olympiad"), set()), {"contests"})
        self.assertEqual(pp.formats_of(opp(opportunity_type="club"), {"camps"}), {"clubs", "camps"})
        self.assertEqual(pp.formats_of(opp(opportunity_type="psychology"), set()), {"support"})
        self.assertEqual(pp.formats_of(opp(opportunity_type="allowance"), set()), {"family_aid"})

    def test_age_likes_and_format_all_apply(self):
        c = kid(age_bands=["7-10"], likes=["stem"], formats=["camps"])
        self.assertEqual(pp.child_match(c, opp(opportunity_type="camp"), {"stem"}), "profile")
        self.assertIsNone(pp.child_match(c, opp(opportunity_type="club"), {"stem"}))
        self.assertIsNone(pp.child_match(c, opp(opportunity_type="camp"), {"arts"}))
        self.assertIsNone(pp.child_match(c, opp(opportunity_type="camp", age_from=15, age_to=18), {"stem"}))

    def test_need_opens_beyond_likes_but_not_beyond_age(self):
        c = kid(age_bands=["7-10"], likes=["stem"], needs=["idp"])
        aid = opp(opportunity_type="allowance", child_needs=["idp"], age_from=0, age_to=17)
        self.assertEqual(pp.child_match(c, aid, set()), "need")
        self.assertIsNone(pp.child_match(c, dict(aid, age_from=15), set()))


class Family(unittest.TestCase):
    def test_legacy_single_row_becomes_first_child(self):
        sub = {"id": "s", "age_bands": ["7-10"], "interests": ["stem", "camps", "international"]}
        (c,) = pp.children_of(sub, [])
        self.assertEqual((c["age_bands"], c["likes"], c["formats"]), (["7-10"], ["stem"], ["camps"]))

    def test_own_rows_win_and_are_ordered(self):
        sub = {"id": "s", "age_bands": ["0-3"], "interests": []}
        rows = [{"subscriber_id": "s", "position": 2}, {"subscriber_id": "s", "position": 1},
                {"subscriber_id": "other", "position": 1}]
        self.assertEqual([c["position"] for c in pp.children_of(sub, rows)], [1, 2])

    def test_label_only_for_several_children(self):
        c = kid(2, age_bands=["11-14", "15-18"])
        self.assertEqual(pp.child_label(c, 1), "")
        self.assertEqual(pp.child_label(c, 2), "Дитина 2 (11–18 р.)")

    def test_shared_opportunity_comes_once_with_both_children(self):
        small, teen = kid(1, age_bands=["7-10"]), kid(2, age_bands=["11-14"])
        res = pp.match_family({"cost_pref": "any", "places": []}, [small, teen],
                              [opp(id="both", age_from=8, age_to=13)])
        self.assertEqual(len(res), 1)
        self.assertEqual(len(res[0]["kids"]), 2)

    def test_cost_and_place_are_family_wide(self):
        k = kid()
        self.assertEqual(pp.match_family({"cost_pref": "free_only"}, [k], [opp(cost_type="paid_affordable")]), [])
        # Обрано лише місто: офлайн з іншого міста — ні, онлайн — так (22.09.2026).
        self.assertEqual(pp.match_family({"cost_pref": "any", "places": ["Київ"]}, [k], [opp()]), [])
        self.assertEqual(len(pp.match_family({"cost_pref": "any", "places": ["Київ"]}, [k],
                                             [opp(format="online", cities=[])])), 1)

    def test_slots_are_shared_in_turn(self):
        a, b = kid(1, age_bands=["7-10"]), kid(2, age_bands=["15-18"])
        young = [opp(id=f"y{i}", age_from=7, age_to=10) for i in range(1, 5)]
        old = [opp(id="o1", age_from=15, age_to=18)]
        matches = pp.match_family({"cost_pref": "any", "places": []}, [a, b], young + old)
        picked = [m["o"]["id"] for m in pp.pick_fair(matches, [a, b], 3)]
        self.assertEqual(picked, ["y1", "o1", "y2"])


class Matching2710(unittest.TestCase):
    """27.10.2026: мамі 8-річної прийшли записи не за віком і місцева допомога в Чехії.
    Дзеркало кінця tests/plusProfile.test.mjs."""

    def test_age_covers_most_of_band(self):
        self.assertFalse(pp.age_overlap(10, 18, ["7-10"]))
        self.assertFalse(pp.age_overlap(9, 18, ["7-10"]))
        self.assertTrue(pp.age_overlap(7, 17, ["7-10"]))
        self.assertTrue(pp.age_overlap(8, 18, ["7-10"]))
        self.assertTrue(pp.age_overlap(8, 9, ["7-10"]))
        self.assertTrue(pp.age_overlap(16, 18, ["15-18"]))
        self.assertTrue(pp.age_overlap(17, 18, ["15-18"]))  # вужча, цілком у смузі
        self.assertFalse(pp.age_overlap(14, 18, ["11-14"]))
        self.assertTrue(pp.age_overlap(5, 6, ["4-6"]))
        self.assertTrue(pp.age_overlap(10, 18, ["7-10", "11-14"]))

    def test_unknown_age(self):
        self.assertFalse(pp.age_known({"age_from": 0, "age_to": 18}))
        self.assertTrue(pp.age_known({"age_from": 0, "age_to": 18, "age_evidence": "Вік авторів не обмежується!"}))
        self.assertTrue(pp.age_known({"age_from": 0, "age_to": 18, "evidence": {"age": "для всіх"}}))
        self.assertTrue(pp.age_known({"age_from": 7, "age_to": 17}))
        self.assertFalse(pp.age_known({"age_from": None, "age_to": None}))

    def test_local_abroad_only_for_that_city(self):
        cz = opp(countries=["cz"], cities=[], ua_eligibility="abroad_only")
        self.assertTrue(pp.is_local_abroad(cz))
        self.assertFalse(pp.place_ok(cz, ["Київ"]))
        self.assertFalse(pp.place_ok(cz, []))
        self.assertTrue(pp.place_ok(cz, ["abroad"]))
        leipzig = opp(countries=["de"], cities=["Лейпциг"], ua_eligibility=None)
        self.assertTrue(pp.place_ok(leipzig, ["Лейпциг"]))
        self.assertFalse(pp.place_ok(leipzig, ["Київ"]))
        intl = opp(countries=["gb"], is_international=True, ua_eligibility="from_ukraine", format="online", cities=["Онлайн"])
        self.assertFalse(pp.is_local_abroad(intl))
        self.assertTrue(pp.place_ok(intl, ["Київ"]))
        self.assertFalse(pp.place_ok(opp(countries=["gb"], is_international=True, ua_eligibility="abroad_only",
                                         format="online", cities=[]), ["Київ"]))

    def test_case_mother_of_8_year_old(self):
        sub = {"id": "s", "places": ["Київ"], "cost_pref": "any"}
        kids = [kid(age_bands=["7-10"], formats=["contests", "grants"])]
        base = {"child_needs": [], "_themes": set()}
        opps = [
            dict(base, id="svitlo", opportunity_type="course", age_from=10, age_to=18, format="online", cities=["Онлайн"], countries=None, is_international=True, ua_eligibility="from_ukraine"),
            dict(base, id="casting", opportunity_type="competition", age_from=9, age_to=18, format="offline", cities=["Київ"], countries=["ua"], is_international=False),
            dict(base, id="conf", opportunity_type="conference", age_from=7, age_to=17, format="offline", cities=["Київ"], countries=["ua"], is_international=False),
            dict(base, id="plays", opportunity_type="competition", age_from=0, age_to=18, format="online", cities=[], countries=["ua"], is_international=False, age_evidence="Вік авторів не обмежується!"),
            dict(base, id="arkwright", opportunity_type="scholarship", age_from=0, age_to=18, format="online", cities=[], countries=["gb"], is_international=True, ua_eligibility="abroad_only"),
            dict(base, id="cz", opportunity_type="scholarship", age_from=3, age_to=18, format="offline", cities=[], countries=["cz"], is_international=False, ua_eligibility="abroad_only"),
            dict(base, id="bridges", opportunity_type="exchange", age_from=0, age_to=18, format="offline", cities=["Катанія"], countries=["it"], is_international=True, ua_eligibility="unknown"),
        ]
        got = [m["o"]["id"] for m in pp.match_family(sub, kids, opps)]
        self.assertEqual(got, ["conf", "plays"])


if __name__ == "__main__":
    unittest.main()
