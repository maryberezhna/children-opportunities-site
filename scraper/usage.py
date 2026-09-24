"""Скільки токенів з'їв кожен процес — у базу, а не в лог Actions.

Навіщо. 23.09.2026 на питання Марії «де паляться токени» довелось відповідати
оцінками: лічильники були лише в екстракції (normalizer) і друкувались у
stdout GitHub Actions, який зникає. Усі процеси на Sonnet — агент пошуку,
розвідник джерел, триаж карантину, обробка нотаток — не рахували нічого.

Тут один лічильник для всіх: `Meter` збирає usage з відповідей API, `record`
дописує денний підсумок у `llm_usage`. Одне джерело правди для питання
«скільки коштував учорашній конвеєр».

Ціни — з прайсу Anthropic на 24.09.2026, $ за мільйон токенів. Кеш: читання
0.1× вхідної ціни, запис 1.25×. Модель поза таблицею рахується за нулем, але
токени все одно пишуться: краще запис без суми, ніж жодного запису.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date

logger = logging.getLogger(__name__)

PRICES = {                       # $ за 1 млн токенів: (вхід, вихід)
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-sonnet-5": (2.00, 10.00),
    "claude-opus-5": (5.00, 25.00),
    "claude-opus-4-8": (5.00, 25.00),
}
CACHE_READ_RATE = 0.10           # читання кешу — 10% вхідної ціни
CACHE_WRITE_RATE = 1.25          # запис у кеш — 125% вхідної


def cost_usd(model: str, *, uncached_in: int = 0, cache_read: int = 0,
             cache_write: int = 0, output: int = 0) -> float:
    """Скільки коштував виклик. Чиста функція — під тести."""
    price_in, price_out = PRICES.get(model, (0.0, 0.0))
    return round(
        (uncached_in * price_in
         + cache_read * price_in * CACHE_READ_RATE
         + cache_write * price_in * CACHE_WRITE_RATE
         + output * price_out) / 1_000_000,
        6,
    )


@dataclass
class Meter:
    """Накопичує usage за прогін одного процесу.

    Кладеться поруч із клієнтом API: `meter.add(resp)` після кожної відповіді.
    Відповідь без usage (мок у тестах, помилка) просто не рахується.
    """
    workflow: str
    model: str
    calls: int = 0
    uncached_in: int = 0
    cache_read: int = 0
    cache_write: int = 0
    output: int = 0
    extra: dict = field(default_factory=dict)

    def add(self, resp) -> None:
        u = getattr(resp, "usage", None)
        if u is None:
            return
        self.calls += 1
        self.uncached_in += getattr(u, "input_tokens", 0) or 0
        self.cache_read += getattr(u, "cache_read_input_tokens", 0) or 0
        self.cache_write += getattr(u, "cache_creation_input_tokens", 0) or 0
        self.output += getattr(u, "output_tokens", 0) or 0

    def add_totals(self, *, calls: int = 0, uncached_in: int = 0, cache_read: int = 0,
                   cache_write: int = 0, output: int = 0) -> None:
        """Для процесів, які вже рахують токени самі (normalizer)."""
        self.calls += calls
        self.uncached_in += uncached_in
        self.cache_read += cache_read
        self.cache_write += cache_write
        self.output += output

    @property
    def total_in(self) -> int:
        return self.uncached_in + self.cache_read + self.cache_write

    @property
    def cache_hit_pct(self) -> int:
        # Ціле ділення — щоб цифра збігалася з рядком у логу нічного скрапу,
        # який рахує так само (main.py).
        return self.cache_read * 100 // self.total_in if self.total_in else 0

    @property
    def cost(self) -> float:
        return cost_usd(self.model, uncached_in=self.uncached_in, cache_read=self.cache_read,
                        cache_write=self.cache_write, output=self.output)

    def as_row(self, day: date | None = None) -> dict:
        return {
            "day": (day or date.today()).isoformat(),
            "workflow": self.workflow,
            "model": self.model,
            "calls": self.calls,
            "input_tokens": self.uncached_in,
            "cache_read_tokens": self.cache_read,
            "cache_write_tokens": self.cache_write,
            "output_tokens": self.output,
            "cost_usd": self.cost,
        }

    def line(self) -> str:
        """Рядок для логу: те саме, що пишемо в базу, лише для людини."""
        return (f"💸 {self.workflow} [{self.model.split('-2025')[0]}]: {self.calls} викликів · "
                f"вхід {self.total_in:,} ({self.cache_hit_pct}% з кешу) · "
                f"вихід {self.output:,} · ${self.cost:.4f}")


def record(client, meter: Meter, day: date | None = None) -> bool:
    """Дописати підсумок прогону в llm_usage. Помилка не валить процес:
    облік витрат не варте того, щоб через нього впав скрап."""
    if not meter.calls:
        return False
    row = meter.as_row(day)
    try:
        existing = (
            client.table("llm_usage")
            .select("calls, input_tokens, cache_read_tokens, cache_write_tokens, "
                    "output_tokens, cost_usd")
            .eq("day", row["day"]).eq("workflow", row["workflow"]).eq("model", row["model"])
            .limit(1).execute().data
        )
        if existing:
            # Кілька запусків на добу складаються: у personal-digest і
            # deadline-reminders три cron-записи на день, і кожен звітує сам.
            old = existing[0]
            for key in ("calls", "input_tokens", "cache_read_tokens",
                        "cache_write_tokens", "output_tokens"):
                row[key] += old.get(key) or 0
            row["cost_usd"] = round(row["cost_usd"] + float(old.get("cost_usd") or 0), 6)
        client.table("llm_usage").upsert(row, on_conflict="day,workflow,model").execute()
        return True
    except Exception as e:                                   # noqa: BLE001
        logger.error("llm_usage не записано (%s): %s", meter.workflow, e)
        return False
