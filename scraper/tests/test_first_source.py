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

    def test_html_escaping_in_href_is_undone(self):
        # Реальне посилання з допису @Mozhlyvosti: через «&amp;» адреса була
        # бита, і сторінка курсу просто не відкривалась.
        self.assertEqual(
            external_links(["https://skvot.io/uk/course/3769-t-adobe-premiere"
                            "?utm_source=tg&amp;utm_term=sio_200"]),
            ["https://skvot.io/uk/course/3769-t-adobe-premiere"])

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


class Chain(unittest.TestCase):
    """Ланцюг переказів: канал → znayshov → childrenkinofest (24.09.2026)."""

    # Кінець статті на znayshov.com.
    ZNAYSHOV = ("Дітей безкоштовно навчатимуть створювати кіно… для дітей віком "
                "від 6 до 14 років… Джерело: НУШ")
    # Посилання з тієї сторінки, у порядку появи.
    ZNAYSHOV_LINKS = [
        "https://www.youtube.com/playlist?list=PLPF2sh78dxCs",
        "https://childrenkinofest.com/ua/contest/u-kadri-kriz-ditjachii-obektiv-kinoprograma.htm",
        "https://nus.org.ua/2026/09/04/ditej-bezkoshtovno-navchatymut-stvoryuvaty-kino",
        "https://t.me/novashkola",
    ]

    def test_retelling_is_recognised(self):
        from first_source import is_retelling
        self.assertTrue(is_retelling(self.ZNAYSHOV))
        self.assertFalse(is_retelling("Реєстрація триває до 20 жовтня. Вік: 6–14 років."))

    def test_deeper_goes_to_the_organiser_not_to_another_retelling(self):
        from first_source import deeper_link
        # Під написом «Джерело» стоїть НУШ — теж переказ. Беремо сайт
        # організатора, який у тексті згаданий раніше.
        self.assertEqual(
            deeper_link(self.ZNAYSHOV, self.ZNAYSHOV_LINKS, ("znayshov.com",)),
            "https://childrenkinofest.com/ua/contest/u-kadri-kriz-ditjachii-obektiv-kinoprograma.htm")

    def test_page_that_is_not_a_retelling_ends_the_chain(self):
        from first_source import deeper_link
        self.assertIsNone(deeper_link("Реєстрація до 20 жовтня", self.ZNAYSHOV_LINKS, ()))

    def test_visited_host_is_not_revisited(self):
        from first_source import deeper_link
        links = ["https://znayshov.com/News/Details/inshe", "https://school.ua/camp"]
        self.assertEqual(deeper_link(self.ZNAYSHOV, links, ("znayshov.com",)),
                         "https://school.ua/camp")


class MentionedLinks(unittest.TestCase):
    def test_forms_are_kept_for_apply_url(self):
        from first_source import mentioned_links
        # Тут форма ПОТРІБНА: модель бачить текст, а не href, і без цього
        # рядка вона не знайде, куди подаватись.
        self.assertEqual(
            mentioned_links(["https://forms.gle/abc", "https://t.me/channel"]),
            ["https://forms.gle/abc"])

    def test_own_host_and_social_are_skipped(self):
        from first_source import mentioned_links
        self.assertEqual(
            mentioned_links(["https://znayshov.com/News/x", "https://childrenkinofest.com/ua"],
                            skip_hosts=("znayshov.com",)),
            ["https://childrenkinofest.com/ua"])

    def test_limit(self):
        from first_source import mentioned_links
        links = [f"https://a{i}.ua/x" for i in range(9)]
        self.assertEqual(len(mentioned_links(links)), 3)


if __name__ == "__main__":
    unittest.main()
