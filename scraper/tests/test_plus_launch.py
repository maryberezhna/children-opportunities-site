"""Розсилка про запуск Dityam+ — кому яким ботом (24.09.2026).

Правило Марії: службового бота «Dityam Адмінка 🛠» не має бачити ніхто, крім
неї. Троє людей зі списку очікування записались через нього ще в серпні —
інакше до них не достукатись, бо Telegram не дозволяє боту написати першим
тому, хто його не запускав. Тому звідти йде одне коротке «переплутали чат,
вам сюди, а цей видаляйте», а не повний лист про запуск.

Тест тримає саме це: повний лист не сміє піти службовим ботом.
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


def load_plus_launch():
    spec = importlib.util.spec_from_file_location("plus_launch_mod", ROOT / "plus_launch.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class WhichBot(unittest.TestCase):
    def setUp(self):
        self.pl = load_plus_launch()

    def test_plus_bot_rows_get_the_launch_letter(self):
        for source in ("plus_bot:site", "plus_bot:detail_page"):
            self.assertTrue(self.pl.via_plus_bot({"source": source}), source)

    def test_main_bot_rows_get_the_wrong_chat_note(self):
        self.assertFalse(self.pl.via_plus_bot({"source": "telegram_post"}))
        text = self.pl.wrong_chat_text()
        self.assertIn("переплутали чат", text)
        self.assertIn("видаляйте", text)
        self.assertIn(self.pl.PLUS_BOT, text)

    def test_wrong_chat_note_is_not_the_launch_letter(self):
        """Інакше службовий бот розсилав би сторонім людям повний лист."""
        self.assertNotEqual(self.pl.wrong_chat_text(), self.pl.telegram_text())
        self.assertNotIn("Ви були в списку перших", self.pl.wrong_chat_text())

    def test_both_texts_keep_the_promised_prices(self):
        """Знижку обіцяли обом групам — цифри мусять збігатися з промокодом."""
        for text in (self.pl.telegram_text(), self.pl.wrong_chat_text()):
            self.assertIn(str(self.pl.PROMO), text)
            self.assertIn(f"{self.pl.PROMO_PRICE} грн замість {self.pl.PRICE}", text)
            self.assertIn(str(self.pl.PROMO_PRICE_YEAR), text)


if __name__ == "__main__":
    unittest.main()
