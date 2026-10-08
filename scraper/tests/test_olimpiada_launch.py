"""Лист «ми стартували» для списку очікування олімпіади (scraper/olimpiada_launch.py).

Лист іде всім, хто лишив email до старту, тож числа в ньому мусять збігатися
з сайтом (lib/olimpiada.js), посилання — вести на форму з UTM, а сам скрипт —
не надсилати нічого, поки на сайті не відкрито реєстрацію.
"""
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import olimpiada_launch as launch  # noqa: E402


class LaunchTest(unittest.TestCase):
    def test_numbers_match_site_config(self):
        js = (ROOT.parent / "lib" / "olimpiada.js").read_text(encoding="utf-8")

        def num(key):
            return int(re.search(rf"{key}:\s*(\d+)", js).group(1))
        self.assertEqual(launch.QUESTIONS, num("questionCount"))
        self.assertEqual(launch.MINUTES, num("minutes"))
        self.assertEqual(launch.PRINT_PRICE, num("printPrice"))
        self.assertEqual(launch.GIFT_DAYS, num("giftDays"))

    def test_message(self):
        subject, text, body = launch.build_message()
        self.assertIn("стартувала", subject)
        for part in (text, body):
            self.assertIn("utm_source=email", part)
            self.assertIn("#uchast", part)
            # З 08.10.2026 участь безкоштовна; платний лише друкований диплом.
            self.assertIn("безкоштовна", part)
            self.assertIn("199 грн", part)
            self.assertNotIn("внесок", part)
            self.assertIn("Марія Шутяк", part)
            self.assertNotIn("Dityam+ —", part)
        self.assertIn('<a href="https://dityam.com.ua/olimpiada?utm_source=email', body)

    def test_only_when_registration_is_open(self):
        # Ознака — кнопка, яку сторінка малює лише з OLIMP_OPEN = true.
        page = (ROOT.parent / "app" / "olimpiada" / "page.js").read_text(encoding="utf-8")
        self.assertIn("OLIMP_OPEN ? 'Взяти участь безкоштовно'", page)
        self.assertTrue(launch.registration_open('<a class="ol-btn">Взяти участь безкоштовно</a>'))
        self.assertFalse(launch.registration_open('<a class="ol-btn">Повідомити про старт</a>'))

    def test_workflow_is_manual_with_confirmation(self):
        wf = (ROOT.parent / ".github" / "workflows" / "olimpiada-launch.yml").read_text(encoding="utf-8")
        self.assertNotIn("schedule:", wf)
        self.assertIn('"$CONFIRM" != "СТАРТ"', wf)


if __name__ == "__main__":
    unittest.main()
