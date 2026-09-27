"""Наступна сходинка в Dityam+ (рішення Марії 27.09.2026).

Що тримаємо:
  • у добірку йде лише підтверджене людиною, лише після позначки родини і лише
    те, що дитині підходить за віком, вартістю й місцем;
  • 👎 і вже показане не повертаються;
  • модель не може вигадати програму: з її відповіді беремо тільки номери
    зі списку кандидатів;
  • блок у повідомленні має власний заголовок і рядок «Після «X»…», а номери
    продовжують добірку — кнопки під повідомленням спільні.
"""
import importlib.util
import pathlib
import sys
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    import httpx  # noqa: F401
except ImportError:  # локально без залежностей скрапера
    sys.modules["httpx"] = types.ModuleType("httpx")

import ladder  # noqa: E402


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pd = load("personal_digest_ladder_under_test", "personal_digest.py")
lp = load("ladder_propose_under_test", "ladder_propose.py")


def opp(i, **kw):
    o = {"id": i, "slug": f"s-{i}", "title": f"Програма {i}", "age_from": 11, "age_to": 17,
         "cost_type": "free", "format": "online", "cities": [], "countries": [],
         "opportunity_type": "olympiad", "created_at": "2026-09-01T00:00:00+00:00",
         "_themes": {"stem"}}
    o.update(kw)
    return o


SUB = {"id": "sub1", "cost_pref": "any", "places": []}
KID = {"position": 1, "age_bands": ["11-14"], "likes": [], "formats": [], "needs": []}
CONFIRMED = {"x": [{"id": "l1", "from_id": "x", "to_id": "y"}]}
TITLES = {"x": "Олімпіада МОН"}


class NextSteps(unittest.TestCase):
    def steps(self, marked=None, pool=None, sent=(), skip=(), sub=SUB, kids=(KID,)):
        return ladder.next_steps(sub, list(kids), marked or {"x": "applying"}, CONFIRMED,
                                 pool if pool is not None else {"y": opp("y")},
                                 TITLES, set(sent), set(skip))

    def test_confirmed_step_after_mark(self):
        out = self.steps()
        self.assertEqual([o["id"] for o in out], ["y"])
        self.assertEqual(out[0]["_ladder_id"], "l1")
        self.assertEqual(ladder.after_line(out[0]),
                         "Після «Олімпіада МОН», на яку ви подаєтесь.")

    def test_no_mark_no_step(self):
        self.assertEqual(self.steps(marked={"other": "applying"}), [])

    def test_skipped_mark_gives_no_step(self):
        # Родина передумала — драбину від цієї програми не будуємо.
        self.assertEqual(self.steps(marked={"x": "skipped"}), [])

    def test_accepted_wording(self):
        out = self.steps(marked={"x": "accepted"})
        self.assertIn("куди дитину взяли", ladder.after_line(out[0]))

    def test_only_what_digest_may_send(self):
        # Y немає в пулі (закрита, дедлайн завтра, «набір постійний» як припущення).
        self.assertEqual(self.steps(pool={}), [])

    def test_already_sent_or_disliked(self):
        self.assertEqual(self.steps(sent={"l1"}), [])
        self.assertEqual(self.steps(skip={"y"}), [])

    def test_age_must_fit_a_child(self):
        self.assertEqual(self.steps(pool={"y": opp("y", age_from=16, age_to=18)}), [])

    def test_free_only_family(self):
        sub = dict(SUB, cost_pref="free_only")
        self.assertEqual(self.steps(sub=sub, pool={"y": opp("y", cost_type="paid_affordable")}), [])

    def test_city_family_gets_online_but_not_other_city(self):
        sub = dict(SUB, places=["Львів"])
        self.assertEqual(len(self.steps(sub=sub)), 1)
        offline = opp("y", format="offline", cities=["Київ"])
        self.assertEqual(self.steps(sub=sub, pool={"y": offline}), [])

    def test_for_line_with_two_kids(self):
        older = {"position": 2, "age_bands": ["15-18"], "likes": [], "formats": [], "needs": []}
        out = self.steps(kids=(KID, older), pool={"y": opp("y", age_from=15, age_to=17)})
        self.assertEqual(out[0]["_for"], "для: Дитина 2 (15–18 р.)")


class ParseAnswer(unittest.TestCase):
    CANDS = [opp("a"), opp("b"), opp("c")]

    def test_takes_listed_numbers_only(self):
        got = lp.parse_answer({"next": [{"n": 2, "why": "вищий рівень"},
                                        {"n": 9, "why": "вигадана"}]}, self.CANDS)
        self.assertEqual([(o["id"], why) for o, why in got], [("b", "вищий рівень")])

    def test_empty_is_a_valid_answer(self):
        self.assertEqual(lp.parse_answer({"next": []}, self.CANDS), [])
        self.assertEqual(lp.parse_answer(None, self.CANDS), [])

    def test_no_reason_no_link(self):
        self.assertEqual(lp.parse_answer({"next": [{"n": 1, "why": "  "}]}, self.CANDS), [])

    def test_no_duplicates_and_max_two(self):
        got = lp.parse_answer({"next": [{"n": 1, "why": "a"}, {"n": 1, "why": "a"},
                                        {"n": 3, "why": "c"}]}, self.CANDS)
        self.assertEqual([o["id"] for o, _ in got], ["a"])


class Candidates(unittest.TestCase):
    def test_same_direction_and_age(self):
        x = opp("x", _themes={"stem", "contests"})
        same = opp("same", opportunity_type="competition", _themes={"stem"})
        other_topic = opp("arts", opportunity_type="competition", _themes={"arts"})
        too_old = opp("old", age_from=22, age_to=30)
        club = opp("club", opportunity_type="club")
        assumed = opp("assumed", timing_assumed=True)
        got = [o["id"] for o in lp.candidates_for(x, [x, same, other_topic, too_old, club, assumed])]
        self.assertEqual(got, ["same"])

    def test_same_type_counts_without_shared_topic(self):
        x = opp("x", _themes=set())
        other = opp("o2", _themes={"arts"})
        self.assertEqual([o["id"] for o in lp.candidates_for(x, [x, other])], ["o2"])


class Cost(unittest.TestCase):
    """Рішення Марії 27.09.2026 «можна якось дешевше»: ціну складає вхід."""

    def test_candidates_capped_and_short(self):
        x = opp("x")
        many = [opp(f"c{i}", summary="а" * 500) for i in range(60)]
        cands = lp.candidates_for(x, [x] + many)
        self.assertEqual(len(cands), 25)
        self.assertLessEqual(len(lp._card(cands[0]).split("Опис: ")[1]), 160)

    def test_full_queue_asks_only_about_marked(self):
        marked, plain = opp("m"), opp("p")
        self.assertEqual([o["id"] for o in lp.pick_sources([plain, marked], {"m"}, {}, 5,
                                                           marked_only=True)], ["m"])
        self.assertEqual([o["id"] for o in lp.pick_sources([plain], set(), {}, 5,
                                                           marked_only=True)], [])
        self.assertEqual(len(lp.pick_sources([plain, marked], {"m"}, {}, 5)), 2)


class DigestMessage(unittest.TestCase):
    def test_steps_block_continues_numbering(self):
        item = opp("n1", title="Нове під профіль")
        step = dict(opp("y", title="Мала академія наук"), _after="Олімпіада МОН",
                    _stage="applying", _ladder_id="l1")
        text = pd.build_telegram(SUB, [item], steps=[step])
        self.assertIn("🧡 <b>Нові можливості для вашої дитини</b>", text)
        self.assertIn("🪜 <b>Наступна сходинка</b>", text)
        self.assertIn("2. <a href", text)
        self.assertIn("Після «Олімпіада МОН», на яку ви подаєтесь.", text)
        kb = pd.telegram_keyboard([item, step])["inline_keyboard"]
        self.assertEqual(kb[1][0]["text"], "✍️ 2")

    def test_only_steps(self):
        step = dict(opp("y"), _after="X", _stage="applying", _ladder_id="l1")
        text = pd.build_telegram(SUB, [], steps=[step])
        self.assertTrue(text.startswith("🪜 <b>Наступна сходинка</b>"))
        self.assertNotIn("Нові можливості", text)


class AdminCard(unittest.TestCase):
    def test_callback_fits_telegram_limit(self):
        kb = lp.card_keyboard("12345678-1234-1234-1234-123456789012")
        for btn in kb["inline_keyboard"][0]:
            self.assertLessEqual(len(btn["callback_data"].encode()), 64)
        self.assertEqual(kb["inline_keyboard"][0][0]["callback_data"],
                         "lad:yes:12345678-1234-1234-1234-123456789012")


if __name__ == "__main__":
    unittest.main()
