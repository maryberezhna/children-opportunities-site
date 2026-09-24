"""Джерелом має бути сторінка можливості, а не допис, який її переказує.

Привід (Марія, 24.09.2026): картка відеокурсу Чілдрен Кінофесту вела в
телеграм-канал, хоча сам допис посилався на сторінку з віком «від 6 до 14
років» і дедлайном 20 жовтня — тобто на цитати, яких у дописі немає.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from first_source import external_links, looks_like_page, merge_text, pick  # noqa: E402

# Посилання з реального допису @novashkola/26280.
NOVASHKOLA = [
    "https://t.me/novashkola",
    "https://t.me/novashkola/26280",
    "https://znayshov.com/News/Details/ditei_bezkoshtovno_navchatymut_stvoriuvaty_kino",
    "//core.telegram.org/widgets",
]


class ExternalLinks(unittest.TestCase):
    def test_real_post_keeps_only_the_article(self):
        self.assertEqual(
            external_links(NOVASHKOLA),
            ["https://znayshov.com/News/Details/ditei_bezkoshtovno_navchatymut_stvoriuvaty_kino"])

    def test_social_links_are_not_sources(self):
        self.assertEqual(external_links([
            "https://www.instagram.com/p/abc", "https://facebook.com/events/1",
            "https://x.com/some/status",
        ]), [])

    def test_shortener_stays_in_the_list(self):
        # За скорочувачем ідемо: він так само часто веде на сайт організатора.
        # Куди привів — перевіряє usable_destination уже після редиректу.
        self.assertEqual(external_links(["https://bit.ly/xyz"]), ["https://bit.ly/xyz"])

    def test_utm_tail_is_trimmed_so_the_same_page_is_one_link(self):
        self.assertEqual(
            external_links(["https://childrenkinofest.com/ua/contest?utm_source=telegram"]),
            ["https://childrenkinofest.com/ua/contest"])

    def test_duplicates_collapse_and_order_is_kept(self):
        self.assertEqual(
            external_links(["https://a.ua/x", "https://b.ua/y", "https://a.ua/x"]),
            ["https://a.ua/x", "https://b.ua/y"])

    def test_relative_and_anchor_links_are_ignored(self):
        self.assertEqual(external_links(["/local", "#top", "mailto:a@b.ua", None, ""]), [])


class Pick(unittest.TestCase):
    def test_page_wins_over_video(self):
        # Сторінка організатора має умови, плейлист — лише матеріал.
        self.assertEqual(
            pick(["https://www.youtube.com/playlist?list=PLPF",
                  "https://childrenkinofest.com/ua/contest"]),
            "https://childrenkinofest.com/ua/contest")

    def test_files_and_video_never_become_the_source(self):
        # Живий прогін 24.09.2026: тека Drive і Google-документ як «відкрити
        # джерело» гірші за сам допис.
        self.assertIsNone(pick(["https://youtu.be/abc"]))
        self.assertIsNone(pick(["https://drive.google.com/drive/folders/1ppo"]))
        self.assertIsNone(pick(["https://docs.google.com/document/d/1FQU/edit"]))

    def test_no_links_means_stay_with_the_post(self):
        self.assertIsNone(pick([]))
        self.assertIsNone(pick(["https://t.me/novashkola/26280"]))


class PageText(unittest.TestCase):
    def test_short_page_is_not_a_page(self):
        # Капча або заглушка: краще лишити допис, ніж підмінити його сміттям.
        self.assertFalse(looks_like_page("Доступ обмежено"))
        self.assertFalse(looks_like_page(""))
        self.assertTrue(looks_like_page("я" * 200))

    def test_merge_puts_the_page_first(self):
        merged = merge_text("допис", "текст сторінки", "https://znayshov.com/x")
        self.assertTrue(merged.startswith("текст сторінки"))
        self.assertIn("допис", merged)
        self.assertIn("https://znayshov.com/x", merged)

    def test_merge_without_page_keeps_the_post(self):
        self.assertEqual(merge_text("допис", "", "https://x.ua"), "допис")


class RealPostLinks(unittest.TestCase):
    """Посилання з живих дописів @tviyspace, знятих 24.09.2026."""

    def test_bot_preview_and_forms_are_not_sources(self):
        # У кожному другому дописі першим стоїть превʼю-картинка бота (403),
        # а далі — форма подачі. Ні те, ні те джерелом не є.
        self.assertEqual(pick([
            "http://telegraph.controller.bot/files/671895449/AgACAgIAAxk",
            "https://docs.google.com/forms/d/e/1FAIpQLSdNAu2RJooiIn15byLSQfB0",
        ]), None)
        self.assertEqual(pick([
            "http://telegraph.controller.bot/files/671895449/AgACAgIAAxk",
            "https://forms.gle/uBfQg1knM4tybJJK6",
        ]), None)

    def test_organiser_site_is_taken(self):
        self.assertEqual(
            pick(["http://telegraph.controller.bot/files/671895449/AgAC",
                  "https://eoukraine.com.ua/registration/"]),
            "https://eoukraine.com.ua/registration/")
        self.assertEqual(
            pick(["http://telegraph.controller.bot/files/1", "https://www.instagram.com/ilyk",
                  "https://ilyk.org.ua/courses/fundraising/"]),
            "https://ilyk.org.ua/courses/fundraising/")

    def test_shortener_is_followed_but_checked_after_redirect(self):
        self.assertEqual(pick(["https://clipr.cc/q99CP"]), "https://clipr.cc/q99CP")
        from first_source import usable_destination
        self.assertTrue(usable_destination("https://school.example.ua/camp"))
        self.assertFalse(usable_destination("https://forms.gle/uBfQg1knM4tybJJK6"))
        self.assertFalse(usable_destination("https://www.instagram.com/p/abc"))


if __name__ == "__main__":
    unittest.main()
