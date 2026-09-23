"""Де шукає розвідник: дефіцит = попит ÷ надходження (23.09.2026).

Стереже чотири рішення Марії:
  • дефіцит рахується попит ÷ (надходження + 1), і клітинка з більшим
    дефіцитом іде першою;
  • марна спроба знижує пріоритет клітинки, а щойно пройдений пошук не
    повторюється завтра;
  • нульовий попит не шукається взагалі, хай яка клітинка порожня;
  • вісь пошуку — вік і тема, ніколи місто: запис, привʼязаний до міста, у
    надходження не рахується, а слово дня міста не містить.
"""
import pathlib
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import deficit  # noqa: E402
from keywords import NATIONWIDE_ROTATION, REGION_ROTATION, UKRAINE_CITIES  # noqa: E402
from plus_profile import AGE_RANGES, FORMAT_TYPES  # noqa: E402

TODAY = date(2026, 9, 23)


def row(otype, age_from=0, age_to=18, **extra):
    return {"opportunity_type": otype, "age_from": age_from, "age_to": age_to,
            "cities": [], "countries": [], "format": None,
            "is_international": None, **extra}


def run(family, band, days_ago, found=0, saved=0):
    return {"family": family, "age_band": band,
            "ran_at": (TODAY - timedelta(days=days_ago)).isoformat(),
            "candidates_found": found, "saved": saved}


class Cells(unittest.TestCase):
    def test_families_and_bands_come_from_plus_profile(self):
        # Ті самі межі й родини, що в профілі Dityam+: інакше «дефіцит» і «що
        # ми пропонуємо родині» рахувались би різними лінійками.
        self.assertEqual(deficit.FAMILIES, tuple(FORMAT_TYPES))
        self.assertEqual(deficit.BANDS, tuple(AGE_RANGES))

    def test_record_belongs_to_every_band_it_overlaps(self):
        self.assertEqual(deficit.bands_of(6, 14), ["4-6", "7-10", "11-14"])
        self.assertEqual(deficit.bands_of(None, None), list(AGE_RANGES))
        self.assertEqual(deficit.bands_of(17, 3), list(AGE_RANGES))  # безглуздий вік → усі

    def test_type_maps_to_family(self):
        self.assertEqual(deficit.family_of("olympiad"), "contests")
        self.assertEqual(deficit.family_of("exchange"), "grants")
        self.assertIsNone(deficit.family_of("невідомий тип"))


class Intake(unittest.TestCase):
    def test_per_week_is_count_over_eight_weeks(self):
        rows = [row("olympiad", 11, 14, format="online") for _ in range(8)]
        got = deficit.intake_per_week(rows)
        self.assertAlmostEqual(got[("contests", "11-14")], 1.0)

    def test_city_bound_record_is_not_intake(self):
        # Пряме правило Марії (22.09.2026): «ми не гарантуємо можливостей саме
        # з міста». Гурток у Дніпрі не закриває дефіцит країни — він доходить
        # лише до свого міста.
        rows = [row("club", 7, 10, cities=[c["name"]]) for c in UKRAINE_CITIES]
        self.assertEqual(deficit.intake_per_week(rows), {})

    def test_reaching_everyone_counts(self):
        for kind in (row("club", 7, 10, format="online"),
                     row("club", 7, 10, format="hybrid"),
                     row("club", 7, 10, cities=["Вся Україна"]),
                     row("club", 7, 10, cities=["Міжнародні"]),
                     row("club", 7, 10, is_international=True),
                     row("club", 7, 10, countries=["pl"])):
            self.assertTrue(deficit.reaches_everyone(kind), kind)
        self.assertFalse(deficit.reaches_everyone(row("club", 7, 10, cities=["Київ"])))
        self.assertFalse(deficit.reaches_everyone(row("club", 7, 10, countries=["ua"])))


class Formula(unittest.TestCase):
    def test_deficit_is_demand_over_intake_plus_one(self):
        cells = {c.key: c for c in deficit.rank({("contests", "15-18"): 1.0}, [], TODAY)}
        cell = cells["contests:15-18"]
        self.assertAlmostEqual(cell.demand, deficit.DEMAND["contests"] / 5)
        self.assertAlmostEqual(cell.deficit, cell.demand / 2.0)

    def test_hungrier_cell_goes_first(self):
        # Конкурси (попит 566) проти гуртків (136) при однакових надходженнях.
        intake = {("contests", "11-14"): 2.0, ("clubs", "11-14"): 2.0}
        order = [c.key for c in deficit.rank(intake, [], TODAY)]
        self.assertLess(order.index("contests:11-14"), order.index("clubs:11-14"))

    def test_more_intake_lowers_priority(self):
        intake = {("contests", "11-14"): 20.0}
        cells = {c.key: c for c in deficit.rank(intake, [], TODAY)}
        self.assertLess(cells["contests:11-14"].deficit, cells["contests:15-18"].deficit)

    def test_empty_cell_does_not_divide_by_zero(self):
        cells = {c.key: c for c in deficit.rank({}, [], TODAY)}
        self.assertAlmostEqual(cells["grants:15-18"].deficit, deficit.DEMAND["grants"] / 5)

    def test_measured_numbers_are_the_ones_we_measured(self):
        # Цифри з GA4 за 28 днів, заміряно 23.09.2026. Якщо їх оновлюють —
        # оновлюється й дата: тест стереже, щоб одне не поїхало без іншого.
        self.assertEqual(deficit.DEMAND_MEASURED_ON, date(2026, 9, 23))
        self.assertAlmostEqual(deficit.DEMAND["grants"], 687)     # 638 + 49
        self.assertAlmostEqual(deficit.DEMAND["contests"], 566)   # 429 + 137
        self.assertAlmostEqual(deficit.DEMAND["camps"], 179)
        self.assertAlmostEqual(deficit.DEMAND["clubs"], 136)
        self.assertAlmostEqual(deficit.DEMAND["support"]
                               + deficit.DEMAND["family_aid"], 137)


class ZeroDemand(unittest.TestCase):
    def test_zero_demand_is_never_searched(self):
        # volunteering попиту не має (сторінки під нього на сайті немає, тож
        # він не виміряний) — і не шукається, хоч клітинка й порожня.
        self.assertEqual(deficit.DEMAND["volunteering"], 0)
        keys = [c.key for c in deficit.rank({}, [], TODAY)]
        self.assertFalse([k for k in keys if k.startswith("volunteering:")])

    def test_zero_demand_wins_nothing_even_when_totally_empty(self):
        intake = {(f, b): 50.0 for f in deficit.FAMILIES for b in deficit.BANDS
                  if f != "volunteering"}
        cell = deficit.pick(intake, [], TODAY)
        self.assertIsNotNone(cell)
        self.assertNotEqual(cell.family, "volunteering")


class Memory(unittest.TestCase):
    def test_wasted_try_lowers_priority(self):
        intake = {}
        without = {c.key: c for c in deficit.rank(intake, [], TODAY)}
        # Три марні спроби 30–60 днів тому: за межами карантину, але в памʼяті.
        runs = [run("grants", "15-18", d) for d in (30, 45, 60)]
        with_runs = {c.key: c for c in deficit.rank(intake, runs, TODAY)}
        self.assertEqual(with_runs["grants:15-18"].deficit,
                         without["grants:15-18"].deficit)  # сам дефіцит не міняється
        self.assertLess(with_runs["grants:15-18"].score,
                        without["grants:15-18"].score)
        self.assertEqual(with_runs["grants:15-18"].empty_tries, 3)

    def test_successful_try_is_not_a_penalty(self):
        runs = [run("grants", "15-18", 30, found=5, saved=3)]
        cells = {c.key: c for c in deficit.rank({}, runs, TODAY)}
        self.assertEqual(cells["grants:15-18"].empty_tries, 0)

    def test_same_cell_is_not_searched_two_days_in_a_row(self):
        intake = {}
        first = deficit.pick(intake, [], TODAY)
        runs = [run(first.family, first.band, 0, found=3, saved=3)]
        second = deficit.pick(intake, runs, TODAY + timedelta(days=1))
        self.assertNotEqual((second.family, second.band), (first.family, first.band))

    def test_old_runs_are_forgotten(self):
        runs = [run("grants", "15-18", deficit.RUNS_WINDOW_DAYS + 10)]
        cells = {c.key: c for c in deficit.rank({}, runs, TODAY)}
        self.assertEqual(cells["grants:15-18"].empty_tries, 0)

    def test_guards_only_lower_never_raise(self):
        intake = {(f, b): 1.0 for f in deficit.FAMILIES for b in deficit.BANDS}
        clean = {c.key: c for c in deficit.rank(intake, [], TODAY)}
        runs = [run(f, b, 1, found=0, saved=0)
                for f in deficit.FAMILIES for b in deficit.BANDS]
        penalised = {c.key: c for c in deficit.rank(intake, runs, TODAY)}
        for key, cell in penalised.items():
            self.assertLessEqual(cell.score, clean[key].score, key)

    def test_unknown_cell_in_memory_is_ignored(self):
        runs = [run("вигадана родина", "7-10", 1), run("grants", "99-100", 1),
                {"family": "grants", "age_band": "15-18", "ran_at": None}]
        cells = {c.key: c for c in deficit.rank({}, runs, TODAY)}
        self.assertEqual(cells["grants:15-18"].empty_tries, 0)


class NeverACity(unittest.TestCase):
    def test_keyword_of_the_day_has_no_city(self):
        names = {c["name"] for c in UKRAINE_CITIES} | {c["locative"] for c in UKRAINE_CITIES}
        for family in deficit.FAMILIES:
            for band in deficit.BANDS:
                kw = deficit.keyword_for(deficit.Cell(family, band, 1, 0, 1, 1, 0, None))
                self.assertFalse([n for n in names if n.lower() in kw.lower()], kw)
                self.assertIn(deficit.band_label(band), kw)

    def test_city_does_not_move_the_cell(self):
        # Та сама тема й вік, але записи привʼязані до міст: черга не
        # змінюється — місто не є віссю пошуку.
        nationwide = [row("competition", 11, 14, cities=["Вся Україна"]) for _ in range(8)]
        plus_cities = nationwide + [row("competition", 11, 14, cities=[c["name"]])
                                    for c in UKRAINE_CITIES]
        self.assertEqual(deficit.intake_per_week(nationwide),
                         deficit.intake_per_week(plus_cities))
        self.assertEqual(deficit.pick(deficit.intake_per_week(nationwide), [], TODAY),
                         deficit.pick(deficit.intake_per_week(plus_cities), [], TODAY))

    def test_deficit_rotation_has_no_cities(self):
        # Регіон дня для пошуку за дефіцитом — країна, ніколи місто. Інакше
        # клітинка «конкурси × 7–10» дісталась би Житомиру, а міський запис у
        # дефіцит не входить узагалі.
        cities = {c["name"] for c in UKRAINE_CITIES}
        self.assertFalse({r["name"] for r in NATIONWIDE_ROTATION} & cities)
        self.assertTrue({r["name"] for r in REGION_ROTATION} & cities)  # повна — з містами
        self.assertEqual(sum(1 for r in NATIONWIDE_ROTATION if r["name"] == "Україна"),
                         len(NATIONWIDE_ROTATION) // 2)  # Україна лишається половиною

    def test_cell_key_survives_the_env_round_trip(self):
        cell = deficit.pick({}, [], TODAY)
        self.assertEqual(deficit.cell_from_env(cell.key), (cell.family, cell.band))
        self.assertIsNone(deficit.cell_from_env("Дніпро"))
        self.assertIsNone(deficit.cell_from_env(""))
        self.assertIsNone(deficit.cell_from_env(None))


class TodayOnLiveNumbers(unittest.TestCase):
    """Контрольний розрахунок на цифрах живої бази 23.09.2026 (8 тижнів,
    лише записи, що доходять до всіх). Показує, що черга справді веде туди,
    де попит великий, а надходження малі."""

    INTAKE = {
        ("grants", "0-3"): 0.375, ("grants", "4-6"): 0.5, ("grants", "7-10"): 0.625,
        ("grants", "11-14"): 1.5, ("grants", "15-18"): 2.625,
        ("contests", "11-14"): 0.5, ("contests", "15-18"): 1.0,
        ("camps", "0-3"): 0.125, ("camps", "4-6"): 0.375, ("camps", "7-10"): 0.625,
        ("camps", "11-14"): 0.75, ("camps", "15-18"): 0.625,
        ("clubs", "0-3"): 0.75, ("clubs", "4-6"): 2.75, ("clubs", "7-10"): 3.625,
        ("clubs", "11-14"): 5.625, ("clubs", "15-18"): 6.125,
    }

    def test_clubs_never_win(self):
        # Гуртків приходить 27,6 на тиждень при попиті 136 — найситіша родина.
        # Саме через них ротація й була сліпою: агент шукав те, що й так є.
        order = [c.key for c in deficit.rank(self.INTAKE, [], TODAY)]
        self.assertGreater(min(i for i, k in enumerate(order) if k.startswith("clubs:")), 10)

    def test_contests_and_grants_are_on_top(self):
        top = [c.family for c in deficit.rank(self.INTAKE, [], TODAY)[:6]]
        self.assertTrue(set(top) <= {"contests", "grants"}, top)


if __name__ == "__main__":
    unittest.main()
