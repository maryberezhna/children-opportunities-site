"""Нічний збір: одне джерело не фарбує весь запуск у червоне (24.10.2026).

18–22.10.2026 «Telegram (веб)» щоночі падало з «not enough values to unpack
(expected 2, got 1)», і весь збір ставав червоним, хоч решта джерел
зберегли знахідки. Тут — три запобіжники: канал зі зламаною сторінкою
пропускаємо, файл не стає «сторінкою джерела», а червоне — від двох джерел.
"""
import asyncio
import os
import pathlib
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scrapers"))
from first_source import pick  # noqa: E402
from main import run_is_red  # noqa: E402
import telegram_web  # noqa: E402

import httpx  # noqa: E402

POST = """<div class="tgme_widget_message" data-post="tviyspace/1">
<div class="tgme_widget_message_text">Конкурс для школярів 12–17 років: подайте заявку на
участь у програмі до 30 листопада. Участь безкоштовна, дедлайн наближається, реєстрація
відкрита на сайті організатора для дітей та підлітків.</div></div>"""


class OneChannelDoesNotKillTheSource(unittest.TestCase):
    def test_broken_channel_is_skipped_and_others_survive(self):
        real_parse = telegram_web._parse_channel

        def parse(html, handle, display, since):
            if handle == "broken":
                raise ValueError("not enough values to unpack (expected 2, got 1)")
            return real_parse(html, handle, display, since)

        transport = httpx.MockTransport(lambda req: httpx.Response(200, text=POST))
        real_client = httpx.AsyncClient

        def client(**kw):
            kw.pop("transport", None)
            return real_client(transport=transport, **kw)

        with mock.patch.object(telegram_web, "channels", return_value=[("broken", "Зламаний"), ("tviyspace", "Твій космос")]), \
             mock.patch.object(telegram_web, "_parse_channel", side_effect=parse), \
             mock.patch.object(telegram_web, "is_relevant", return_value=True), \
             mock.patch.object(telegram_web.httpx, "AsyncClient", side_effect=client), \
             self.assertLogs(telegram_web.logger, level="ERROR"):
            items = asyncio.run(telegram_web.fetch_all())
        self.assertEqual([i["source"] for i in items], ["Твій космос"])


class FilesAreNotSourcePages(unittest.TestCase):
    def test_image_on_cdn_is_not_a_page(self):
        # Живий прогін 24.10.2026: крок «глибше» вів на картинку.
        self.assertIsNone(pick(["https://cdn.prod.website-files.com/63ef/69f8_photo_2026-05-04_15-08-22.jpg"]))

    def test_page_after_an_image_still_wins(self):
        self.assertEqual(
            pick(["https://cdn.example.com/poster.PNG", "https://svitloschool.com/uk/apply"]),
            "https://svitloschool.com/uk/apply")

    def test_pdf_with_rules_stays_a_source(self):
        self.assertEqual(pick(["https://org.example/polozhennia.pdf"]), "https://org.example/polozhennia.pdf")


class RunColour(unittest.TestCase):
    def test_one_failed_source_keeps_the_run_green(self):
        results = [{"name": "Telegram (веб)", "status": "error"}, {"name": "Eurodesk", "status": "success"}]
        self.assertFalse(run_is_red(results))

    def test_two_failed_sources_make_it_red(self):
        results = [{"name": "A", "status": "error"}, {"name": "B", "status": "error"}]
        self.assertTrue(run_is_red(results))

    def test_clean_run_is_green(self):
        self.assertFalse(run_is_red([{"name": "A", "status": "success"}]))


if __name__ == "__main__":
    unittest.main()
