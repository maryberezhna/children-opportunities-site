"""Інваріанти нормалізатора. Регресія 01.09.2026: slugify транслітерував
кирилицю тим unidecode-пакетом, який випадково стояв в оточенні, — той
самий запис у різних запусках отримував різні слаги, і в базі виросло
20 пар дублів. Ці тести прибʼють поведінку до власної таблиці."""
import pathlib
import sys
import re
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from normalizer import Normalizer, _sanitize, missing_required  # noqa: E402
from normalizer import _fix_invented_years, published_date, strip_foreign_script  # noqa: E402
from normalizer import is_state_support  # noqa: E402
from normalizer import SYSTEM_PROMPT, VALID_OPP_TYPES  # noqa: E402
from normalizer import strip_invented_repeat  # noqa: E402


class SlugInvariants(unittest.TestCase):
    def test_ukrainian_official_transliteration(self):
        # и→y, г→h, є→ie — офіційна таблиця, НЕ російська (i, g)
        slug = Normalizer._make_slug("Квіти Перемоги", "тест")
        self.assertTrue(slug.startswith("kvity-peremohy-"), slug)
        slug = Normalizer._make_slug("Гурток Ідея", "тест")
        self.assertTrue(slug.startswith("hurtok-ideia-"), slug)

    def test_deterministic(self):
        a = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        b = Normalizer._make_slug("Дитячий хор Щедрик", "Гурток (gurtok.org)")
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("dytiachyi-khor-shchedryk-"), a)

    def test_hash_suffix_six_hex(self):
        slug = Normalizer._make_slug("Тест", "джерело")
        self.assertRegex(slug, r"-[0-9a-f]{6}$")


class ClubDefault(unittest.TestCase):
    """17.09.2026: скрапери гуртків більше не дописують «Набір постійний» у
    текст. Правило «мовчить — постійний» тепер застосовує екстрактор."""

    def base(self, **over):
        d = {"title": "Гурток шахів", "summary": "Шахи для дітей", "age_from": 7, "age_to": 14,
             "opportunity_type": "club", "cost_type": "free", "format": "offline",
             "cities": ["Київ"], "deadline": None, "recurrence": None, "timing_kind": None}
        d.update(over)
        return d

    def test_silent_club_becomes_permanent_with_note(self):
        data = _sanitize(self.base())
        self.assertEqual(data["timing_kind"], "permanent")
        self.assertEqual(data["recurrence"], "ongoing")
        self.assertIn("перевірити", data["admin_comment"])
        self.assertNotEqual(data.get("status"), "draft")
        # Здогад позначений у базі, а не лише в коментарі: за ним запис
        # перевіряється за 30 днів і не вважається вічно відкритим.
        self.assertTrue(data["timing_assumed"])

    def test_kind_from_text_is_not_an_assumption(self):
        data = _sanitize(self.base(timing_kind="permanent"))
        self.assertEqual(data["timing_kind"], "permanent")
        self.assertFalse(data.get("timing_assumed"))

    def test_periodic_club_from_text_is_kept(self):
        data = _sanitize(self.base(timing_kind="periodic", season_months=[9]))
        self.assertEqual(data["timing_kind"], "periodic")
        self.assertEqual(data["recurrence"], "annual")
        self.assertNotIn("перевірити", data.get("admin_comment") or "")

    def test_course_is_not_defaulted(self):
        data = _sanitize(self.base(opportunity_type="course"))
        self.assertIsNone(data["timing_kind"])


class PublishedDate(unittest.TestCase):
    """С5 аудиту «Дедлайн, подія, сезон»: рік — відносно дати публікації допису."""

    def test_parsed_from_first_line(self):
        self.assertEqual(published_date("Дата публікації: 2025-12-28\n\nЗаявки до 15 січня"),
                         "2025-12-28")
        self.assertIsNone(published_date("Заявки до 15 січня"))

    def test_year_is_snapped_to_publication_not_to_processing_day(self):
        # Пост від 28.12.2025 «до 15 січня», розмічений лише у вересні 2026.
        # Модель дописала рік 2025. Від дня розмітки вийшло б 2027-01-15.
        data = {"deadline": "2025-01-15"}
        fixed = _fix_invented_years(dict(data), "Заявки до 15 січня", "2026-09-17", "2025-12-28")
        self.assertEqual(fixed["deadline"], "2026-01-15")

    def test_publication_line_does_not_count_as_year_in_text(self):
        # Рік із рядка «Дата публікації» не сміє «підтверджувати» вигаданий рік.
        import re
        raw = "Дата публікації: 2025-12-28\n\nЗаявки до 15 січня"
        body = re.sub(r"^Дата публікації: \d{4}-\d{2}-\d{2}\s*", "", raw)
        self.assertNotIn("2025", body)

    def test_event_start_is_fixed_too(self):
        fixed = _fix_invented_years({"event_start_date": "2025-11-06"}, "6–8 листопада",
                                    "2026-09-17", "2026-09-10")
        self.assertEqual(fixed["event_start_date"], "2026-11-06")


class GeneratedTextHygiene(unittest.TestCase):
    """17.09.2026: «Навчання可а офлайн», «для創ення» — модель вставляла ієрогліфи."""

    def test_foreign_script_is_stripped(self):
        self.assertEqual(strip_foreign_script("для創ення"), ("дляення", True))
        self.assertEqual(strip_foreign_script("Звичайний текст"), ("Звичайний текст", False))

    def test_sanitize_strips_and_flags(self):
        data = _sanitize({"title": "Гранти", "summary": "Навчання可а офлайн", "age_from": 5,
                          "age_to": 18, "opportunity_type": "scholarship", "cost_type": "free",
                          "format": "online", "results_date": "2026-09-30"})
        self.assertNotIn("可", data["summary"])
        self.assertIn("ієрогліфи", data["admin_comment"])
        self.assertEqual(data["results_date"], "2026-09-30")
        self.assertNotIn("дата, період або періодичність", data.get("admin_comment") or "")


class StateSupportIsFree(unittest.TestCase):
    """17.09.2026, Марія: «всюди де є слово державна — це безкоштовно»."""

    def base(self, **over):
        d = {"title": "Державна цільова підтримка для здобуття вищої освіти",
             "summary": "Повна оплата навчання за державним замовленням, соціальна стипендія.",
             "age_from": 15, "age_to": 18, "opportunity_type": "scholarship",
             "cost_type": None, "format": "offline", "cities": ["Київ"], "recurrence": "ongoing"}
        d.update(over)
        return d

    def test_state_support_without_cost_becomes_free(self):
        data = _sanitize(self.base())
        self.assertEqual(data["cost_type"], "free")
        self.assertNotIn("вартість", data.get("admin_comment") or "")

    def test_state_university_name_is_not_a_reason(self):
        # 28 платних курсів «Житомирського державного університету».
        text = "Літні мовні курси польської, організовані Житомирським державним університетом"
        self.assertFalse(is_state_support(text))
        data = _sanitize(self.base(title="Літні мовні курси польської", summary=text,
                                   opportunity_type="course", cost_type="paid_affordable"))
        self.assertEqual(data["cost_type"], "paid_affordable")

    def test_state_aid_marked_paid_is_fixed(self):
        data = _sanitize(self.base(aid_type="cash", cost_type="paid_affordable",
                                   opportunity_type="allowance"))
        self.assertEqual(data["cost_type"], "free")
        self.assertIn("перевір", data["admin_comment"])



class RequiredBeforePublish(unittest.TestCase):
    """Дата, тип, вік, вартість і місце-або-формат — обовʼязковий мінімум
    перед публікацією (вимога Марії 11.09.2026). Визначення — в
    lib/publish-criteria.json, спільні приклади — tests/fixtures/."""

    @staticmethod
    def _full(**over):
        data = {
            "age_from": 6, "age_to": 12, "deadline": "2026-10-01",
            "cost_type": "free", "opportunity_type": "camp", "format": "offline",
            "cities": ["Львів"], "countries": ["ua"], "is_international": False,
        }
        data.update(over)
        return data

    def test_full_record_needs_nothing(self):
        self.assertEqual(missing_required(self._full()), [])

    def test_each_field_blocks_on_its_own(self):
        self.assertEqual(missing_required(self._full(age_to=None)), ["вік"])
        self.assertEqual(missing_required(self._full(cost_type=None)), ["вартість"])
        self.assertEqual(missing_required(self._full(opportunity_type=None)), ["тип"])
        self.assertEqual(
            missing_required(self._full(deadline=None)),
            ["дата, період або періодичність"])
        self.assertEqual(
            missing_required(self._full(format=None, cities=[], countries=[])),
            ["формат або місце (онлайн / офлайн / за кордоном)"])

    def test_garbage_is_not_a_filled_field(self):
        # cost_type "unknown" і тип поза словником раніше проходили ворота,
        # а вже після них мовчки ставали null.
        self.assertEqual(missing_required(self._full(cost_type="unknown")), ["вартість"])
        self.assertEqual(missing_required(self._full(opportunity_type="щось")), ["тип"])

    def test_date_closed_by_any_of_three(self):
        for key, val in (("deadline", "2026-10-01"),
                         ("event_end_date", "2026-12-01"),
                         ("recurrence", "annual"), ("recurrence", "ongoing")):
            row = self._full(deadline=None)
            row[key] = val
            self.assertEqual(missing_required(row), [], key)

    def test_payment_needs_no_date(self):
        # Рішення Марії 14.09.2026: строк подання виплат громад часто ніде
        # не вказаний. Решта полів для виплати лишаються обовʼязковими.
        for otype in ("allowance", "support_payment"):
            self.assertEqual(missing_required(self._full(deadline=None, opportunity_type=otype)), [], otype)
        self.assertEqual(
            missing_required(self._full(deadline=None, opportunity_type="scholarship")),
            ["дата, період або періодичність"])
        self.assertEqual(
            missing_required(self._full(deadline=None, opportunity_type="allowance", age_to=None)),
            ["вік"])

    def test_place_closed_by_any_of_four(self):
        nowhere = dict(format=None, cities=[], countries=[], is_international=False)
        for key, val in (("format", "online"), ("cities", ["Київ"]),
                         ("countries", ["pl"]), ("is_international", True)):
            row = self._full(**nowhere)
            row[key] = val
            self.assertEqual(missing_required(row), [], key)


class SanitizeGate(unittest.TestCase):
    """Ворота стоять у _sanitize: неповний запис не може вийти активним."""

    def test_incomplete_record_becomes_draft_with_reason(self):
        out = _sanitize({
            "status": "active", "title": "Табір", "opportunity_type": "camp",
            "cost_type": "unknown", "format": None, "cities": [],
        })
        self.assertEqual(out["status"], "draft")
        for expected in ("вік", "вартість", "дата", "формат або місце"):
            self.assertIn(expected, out["admin_comment"])

    def test_complete_record_keeps_status(self):
        out = _sanitize({
            "status": "active", "age_from": 6, "age_to": 12,
            "deadline": "2026-10-01", "cost_type": "free",
            "opportunity_type": "camp", "format": "offline",
        })
        self.assertEqual(out["status"], "active")
        self.assertNotIn("бракує", out.get("admin_comment") or "")

    def test_unknown_type_still_saves_but_is_flagged(self):
        # opportunity_type NOT NULL — заглушка лишається, але брак видно.
        out = _sanitize({
            "status": "active", "age_from": 6, "age_to": 12,
            "deadline": "2026-10-01", "cost_type": "free",
            "opportunity_type": "невідомо", "format": "online",
        })
        self.assertEqual(out["opportunity_type"], "course")
        self.assertEqual(out["status"], "draft")
        self.assertIn("тип", out["admin_comment"])


class PromptKnowsEveryType(unittest.TestCase):
    """18.09.2026: пропозиція «Діалог українських дітей з Радою Європи»
    застрягла в чернетці з «бракує: тип». Причина — промпт перелічував
    16 типів із 30, які приймає база, і для онлайн-консультації в моделі
    просто не було слова. Перелік у промпті мусить дорівнювати словнику."""

    def block(self):
        start = SYSTEM_PROMPT.index("opportunity_type — ЛИШЕ одне значення")
        return SYSTEM_PROMPT[start:SYSTEM_PROMPT.index("cost_type —", start)]

    def test_prompt_lists_all_valid_types(self):
        block = self.block()
        missing = sorted(t for t in VALID_OPP_TYPES if f"- {t} —" not in block)
        self.assertEqual(missing, [], f"немає в промпті: {missing}")

    def test_prompt_invents_no_type(self):
        listed = set(re.findall(r"^- ([a-z_]+) —", self.block(), re.M))
        self.assertEqual(listed - VALID_OPP_TYPES, set())


if __name__ == "__main__":
    unittest.main()


class NoInventedRecurrence(unittest.TestCase):
    """20.09.2026, курс AI Kids Academy: один набір на три місяці приїхав як
    periodic + recurrence=annual, хоч у статті немає ні слова про повторення.
    «Щороку» без підстави в тексті — обіцянка, яку нема кому виконати."""

    BASE = {"title": "AI Kids Academy", "summary": "Безкоштовний курс зі штучного інтелекту",
            "age_from": 13, "age_to": 15, "opportunity_type": "course",
            "cost_type": "free", "format": "offline", "cities": ["Львів"]}

    def test_no_signal_strips_both(self):
        out = strip_invented_repeat(
            dict(self.BASE, timing_kind="periodic", recurrence="annual"),
            "Курс триватиме три місяці, 12 тренінгів щосуботи")
        self.assertIsNone(out["timing_kind"])
        self.assertIsNone(out["recurrence"])
        self.assertIn("немає ознак повторюваності", out["admin_comment"])

    def test_signal_keeps_both(self):
        out = strip_invented_repeat(
            dict(self.BASE, timing_kind="periodic", recurrence="annual"),
            "Щорічний конкурс для школярів, IV всеукраїнський")
        self.assertEqual(out["timing_kind"], "periodic")
        self.assertEqual(out["recurrence"], "annual")
        self.assertNotIn("admin_comment", out)

    def test_olympiad_is_periodic_by_definition(self):
        out = strip_invented_repeat(
            dict(self.BASE, opportunity_type="olympiad", timing_kind="periodic",
                 recurrence="annual"), "Умови участі")
        self.assertEqual(out["timing_kind"], "periodic")
        self.assertEqual(out["recurrence"], "annual")

    def test_ongoing_and_one_time_untouched(self):
        out = strip_invented_repeat(
            dict(self.BASE, timing_kind="permanent", recurrence="ongoing"),
            "Набір триває постійно")
        self.assertEqual(out["timing_kind"], "permanent")
        self.assertEqual(out["recurrence"], "ongoing")


class FormatFromText(unittest.TestCase):
    """«Онлайн» у назві чи описі — факт, а не здогад (21.09.2026: «ТВОЯ ШКОЛА —
    українська онлайн-школа» стояла в черзі з «бракує: формат або місце»)."""

    def fmt(self, title, summary="", fmt=None):
        from normalizer import _apply_format_from_text
        d = {"title": title, "summary": summary, "format": fmt, "cities": []}
        _apply_format_from_text(d)
        return d

    def test_online_school_in_title(self):
        d = self.fmt("ТВОЯ ШКОЛА – українська онлайн-школа для дітей за кордоном")
        self.assertEqual(d["format"], "online")
        self.assertEqual(d["cities"], ["Онлайн"])
        self.assertIn("прямо в назві", d["admin_comment"])

    def test_title_starting_with_online(self):
        self.assertEqual(self.fmt("Online лессенреекс нідерландської мови")["format"], "online")

    def test_online_and_in_person_is_hybrid(self):
        d = self.fmt("Гурток «Аквабіотехніка»",
                     "заняття проходять очно та також в онлайн-форматі")
        self.assertEqual(d["format"], "hybrid")
        self.assertEqual(d["cities"], [])

    def test_applying_online_is_not_the_format(self):
        # Подати документи онлайн — це спосіб подачі, а не формат можливості.
        self.assertIsNone(self.fmt("Допомога при усиновленні",
                                   "Заяву можна подати онлайн через Дію.")["format"])
        self.assertIsNone(self.fmt("Літній табір у Карпатах",
                                   "Онлайн-реєстрація відкрита до 1 травня.")["format"])
        self.assertIsNone(self.fmt("Конкурс малюнка",
                                   "Роботи приймаються через онлайн-форму.")["format"])

    def test_model_answer_wins(self):
        self.assertEqual(self.fmt("Онлайн-курс", fmt="offline")["format"], "offline")


class AdultParticipant(unittest.TestCase):
    """Учасник — дорослий, діти лише умова участі (21.09.2026)."""

    def check(self, title, summary="", typ="grant"):
        from normalizer import looks_adult_participant
        return looks_adult_participant({"title": title, "summary": summary, "opportunity_type": typ})

    def test_business_program_for_parents(self):
        self.assertTrue(self.check(
            "Безкоштовна бізнес-програма для батьків із можливістю отримати грант на власну справу",
            "Онлайн-навчання з підприємництва для батьків сімей із дітьми до 18 років"))

    def test_grant_for_women_entrepreneurs(self):
        self.assertTrue(self.check("Грантова програма для жінок «СТВОРЮЙ!»",
                                   "підтримка підприємиць у виробництві"))

    def test_child_is_the_participant(self):
        self.assertFalse(self.check("Курс підприємництва для школярів", "бізнес-план для підлітків"))
        self.assertFalse(self.check("Табір для дітей ветеранів", "оздоровлення дітей", typ="camp"))

    def test_payment_for_the_child_is_in_scope(self):
        self.assertFalse(self.check("Допомога для батьків на відкриття бізнесу",
                                    "виплата родинам з дітьми", typ="allowance"))

    def test_goes_to_a_human_not_to_the_site(self):
        from normalizer import _sanitize
        d = _sanitize({"title": "Бізнес-програма для батьків", "summary": "грант на власну справу",
                       "opportunity_type": "grant", "cost_type": "free", "format": "online",
                       "age_from": 0, "age_to": 18, "recurrence": "annual"})
        self.assertEqual(d["status"], "draft")
        self.assertIn("не для дітей", d["admin_comment"])
