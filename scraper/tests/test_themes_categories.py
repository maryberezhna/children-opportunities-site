"""Теми можливості збираються з назви, опису Й категорій джерела.

Навіщо. Вподобання дитини в Dityam+ звіряються саме з темами, тож запис без
жодної теми не дійде до родини, яка обрала хоч один інтерес. Назва часто не
каже нічого («Зразковий колектив „Дивосвіт“»), а categories з екстракції
описують запис — але словника там немає: ~500 різних значень трьома мовами.

Дзеркало: tests/themes-categories.test.mjs — ті самі випадки.
"""
import importlib.util
import pathlib
import sys
import unittest

_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

# Вантажимо модуль зі шляху під власним іменем: test_deadline_reminders кладе
# в sys.modules заглушку "personal_digest", і звичайний import узяв би її.
_spec = importlib.util.spec_from_file_location(
    "personal_digest_for_themes_test", _ROOT / "personal_digest.py")
pd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pd)


def themes(title="", summary="", categories=None):
    return pd.themes_of({"title": title, "summary": summary, "categories": categories or []})


class CategoriesFeedThemes(unittest.TestCase):
    def test_category_speaks_where_title_is_silent(self):
        self.assertEqual(
            themes("Зразковий колектив «Дивосвіт»", categories=["dance", "музика"]),
            {"arts"},
        )

    def test_english_categories_map_to_our_themes(self):
        self.assertIn("international", themes("Програма", categories=["eu", "international"]))
        self.assertIn("soft_skills", themes("Клуб", categories=["leadership"]))
        self.assertIn("stem", themes("Проєкт", categories=["digital", "education"]))

    def test_ukrainian_categories_too(self):
        self.assertIn("sport", themes("Заняття", categories=["спорт"]))
        self.assertIn("soft_skills", themes("Заняття", categories=["медіаграмотність"]))

    def test_case_and_separators_do_not_matter(self):
        self.assertEqual(pd.normalize_category(" Mental_Health "), "mental health")
        self.assertIn("health", themes("x", categories=["Mental_Health"]))
        self.assertIn("sport", themes("x", categories=["MARTIAL-ARTS"]))

    def test_keywords_still_work(self):
        self.assertIn("stem", themes("Школа програмування для дітей"))
        self.assertIn("contests", themes("Олімпіада з математики"))

    def test_no_signal_no_theme(self):
        self.assertEqual(themes("Оголошення"), set())
        self.assertEqual(pd.themes_of({}), set())


if __name__ == "__main__":
    unittest.main()
