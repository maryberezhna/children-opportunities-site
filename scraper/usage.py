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

04.10.2026 (баланс API закінчився 03.10): лічильник був лише в нічному скрапі,
решта процесів витрачала наосліп. Тепер кожен плановий скрипт із моделлю
веде `Spend` — по `Meter` на модель — і пише його в `llm_usage` наприкінці
прогону. Вебпошук рахується окремо від токенів, $10 за 1000 пошуків.
"""
from __future__ import annotations

import logging
import os
import re
import threading
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
# Вебпошук тарифікується поштучно, поверх токенів: $10 за 1000 пошуків.
# Окремої колонки в llm_usage під нього немає — сума йде в cost_usd, тож
# cost_usd агентів пошуку більший, ніж дали б самі токени (04.10.2026).
WEB_SEARCH_USD = 10.00 / 1000


def cost_usd(model: str, *, uncached_in: int = 0, cache_read: int = 0,
             cache_write: int = 0, output: int = 0, web_searches: int = 0) -> float:
    """Скільки коштував виклик. Чиста функція — під тести."""
    price_in, price_out = PRICES.get(model, (0.0, 0.0))
    return round(
        (uncached_in * price_in
         + cache_read * price_in * CACHE_READ_RATE
         + cache_write * price_in * CACHE_WRITE_RATE
         + output * price_out) / 1_000_000
        + web_searches * WEB_SEARCH_USD,
        6,
    )


def _field(obj, key):
    """Поле відповіді API — і з обʼєкта SDK, і з сирого JSON (httpx у пошукових
    агентах повертає dict)."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _count(value) -> int:
    """Лише справжнє ціле. Мок у тестах чи None — нуль, а не TypeError посеред
    прогону: облік не має права зламати роботу, яку він рахує."""
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


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
    web_searches: int = 0
    extra: dict = field(default_factory=dict)

    def add(self, resp) -> None:
        """Відповідь SDK або сирий JSON відповіді (dict) — однаково."""
        u = _field(resp, "usage")
        if u is None:
            return
        self.calls += 1
        self.uncached_in += _count(_field(u, "input_tokens"))
        self.cache_read += _count(_field(u, "cache_read_input_tokens"))
        self.cache_write += _count(_field(u, "cache_creation_input_tokens"))
        self.output += _count(_field(u, "output_tokens"))
        self.web_searches += _count(_field(_field(u, "server_tool_use"), "web_search_requests"))

    def add_totals(self, *, calls: int = 0, uncached_in: int = 0, cache_read: int = 0,
                   cache_write: int = 0, output: int = 0, web_searches: int = 0) -> None:
        """Для процесів, які вже рахують токени самі (normalizer)."""
        self.calls += calls
        self.uncached_in += uncached_in
        self.cache_read += cache_read
        self.cache_write += cache_write
        self.output += output
        self.web_searches += web_searches

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
                        cache_write=self.cache_write, output=self.output,
                        web_searches=self.web_searches)

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
        searches = f" · пошуків {self.web_searches}" if self.web_searches else ""
        return (f"💸 {self.workflow} [{self.model.split('-2025')[0]}]: {self.calls} викликів · "
                f"вхід {self.total_in:,} ({self.cache_hit_pct}% з кешу) · "
                f"вихід {self.output:,}{searches} · ${self.cost:.4f}")


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


_WORKFLOW_FILE = re.compile(r"/workflows/([^/@]+)\.ya?ml@")


def workflow_name(default: str) -> str:
    """Імʼя файла воркфлоу без розширення — з GITHUB_WORKFLOW_REF.

    Один скрипт ходить у кількох воркфлоу: discover_agent.py — у discover.yml
    і discover-rare.yml, lifecycle.py — ще й у публікаторах через
    verify-before-post.mjs. GITHUB_WORKFLOW віддає людську назву («Рідкісне за
    кордоном — …»), а питання «скільки коштує discover-rare» ставлять за
    файлом. Поза Actions (локальний запуск) — default.
    """
    m = _WORKFLOW_FILE.search(os.environ.get("GITHUB_WORKFLOW_REF") or "")
    return m.group(1) if m else default


class Spend:
    """Лічильники одного прогону скрипта: по `Meter` на кожну модель.

    Лежить на рівні модуля: `SPEND.add(MODEL, resp)` після кожної відповіді
    API, `SPEND.record(db)` наприкінці прогону — у finally, щоб і прогін, що
    впав посеред, записав уже витрачене. `dry = True` — лише рядок у лог:
    сухий прогін обіцяє не писати в базу нічого, і llm_usage теж (04.10.2026).

    Ні add, ні record ніколи не кидають: облік витрат не варте того, щоб через
    нього зупинився конвеєр. Замок — для translate_en, що кличе модель із
    кількох потоків.
    """

    def __init__(self, default_workflow: str):
        self.default_workflow = default_workflow
        self.dry = False
        self.meters: dict[str, Meter] = {}
        self._lock = threading.Lock()

    def _meter(self, model: str) -> Meter:
        meter = self.meters.get(model)
        if meter is None:
            meter = self.meters[model] = Meter(
                workflow=workflow_name(self.default_workflow), model=model)
        return meter

    def add(self, model: str, resp) -> None:
        try:
            with self._lock:
                self._meter(model).add(resp)
        except Exception as e:                               # noqa: BLE001
            logger.warning("облік витрат пропустив відповідь (%s): %s", model, e)

    def add_totals(self, model: str, **totals) -> None:
        """Для процесів, що рахують токени самі (Normalizer у пропозиціях)."""
        try:
            with self._lock:
                self._meter(model).add_totals(**{k: _count(v) for k, v in totals.items()})
        except Exception as e:                               # noqa: BLE001
            logger.warning("облік витрат пропустив підсумок (%s): %s", model, e)

    def record(self, client=None, day: date | None = None) -> int:
        """Записати й обнулити. Повертає, скільки рядків llm_usage записано.

        client=None — клієнта створимо самі: скрипт міг упасти раніше, ніж
        зʼявився його клієнт бази, а витрати до того вже були."""
        written = 0
        try:
            with self._lock:
                meters = [m for m in self.meters.values() if m.calls]
                self.meters = {}
            for meter in meters:
                print(meter.line(), flush=True)
            if not meters or self.dry:
                return 0
            if client is None:
                from db import get_client
                client = get_client()
            for meter in meters:
                written += 1 if record(client, meter, day) else 0
        except Exception as e:                               # noqa: BLE001
            logger.error("llm_usage не записано (%s): %s", self.default_workflow, e)
        return written
