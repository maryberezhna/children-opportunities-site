"""Тендери й вакансії в заголовку не йдуть у модель (21.09.2026): за весь час
80 таких сирців, прийнятих 0. Заголовки — справжні з raw_items."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import raw_store  # noqa: E402


class Prefilter(unittest.TestCase):
    def test_tenders_and_vacancies(self):
        for title in ("Закупівля послуг: спеціалісти/ки організаційного розвитку",
                      "Продовження тендеру на закупівлю послуг логопедів",
                      "УВАГА!!! ЗАКУПІВЛЯ!!!",
                      "Запит цінових пропозицій на закупівлю обладнання",
                      "Вакансія проєктного менеджера/-ки в «Інтерньюз-Україна»",
                      "Добірка актуальних вакансій:",
                      "#вакансії"):
            self.assertTrue(raw_store.not_an_opportunity(title), title)

    def test_real_opportunities_pass(self):
        # «Закупівля обладнання» в ТЕКСТІ гранту — мета витрат; заголовок чистий.
        for title in ("Грантовий конкурс «ВАРТО: КРОК ВПЕРЕД» для ветеранського бізнесу",
                      "Молодіжний обмін Erasmus+ «WITHIN»",
                      "Всеукраїнський інженерно-технологічний хакатон",
                      "", None):
            self.assertFalse(raw_store.not_an_opportunity(title), title)


if __name__ == "__main__":
    unittest.main()
