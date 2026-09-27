"""ladder_propose.py — модель пропонує «наступну сходинку», людина вирішує.

Рішення Марії 27.09.2026: звʼязок «після X → Y» пропонує модель, у добірку
Dityam+ іде лише підтверджене кнопкою в адмін-боті. Показуємо тільки в Dityam+.

Що робить один запуск:
  1. Бере кілька програм X (спершу ті, що родини позначили «✍️ подаюсь»,
     далі — конкурси, олімпіади, табори, обміни… яких модель ще не дивилась).
  2. Для кожної збирає з бази до 40 кандидатів того ж напряму й віку і питає
     модель, які 0–2 з них — справжня наступна сходинка. Лише номери зі
     списку: вигадати програму модель не може, а «нічого» — законна відповідь.
  3. Пропозиції лягають в opportunity_ladder зі status='proposed'.
  4. Надсилає в адмін-бот картки «Після X → Y? ✅ / ❌» — не більше MAX_CARDS
     за раз і не більше MAX_PENDING без відповіді (модерація ~10 хв на день).

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (картки), SITE_URL (опц.),
     LADDER_MODEL (опц., за замовчуванням claude-opus-5).

Прапорці:
  --limit N       скільки програм X розглянути (деф. 5)
  --max-cards N   скільки карток надіслати (деф. 5)
  --dry-run       питає модель і друкує, що запропонувала б, і скільки це
                  коштувало; у базу не пише й карток не шле
  --cards-only    лише дослати картки з уже запропонованого, без моделі
"""
import argparse
import html
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

import httpx

import api_guard
import personal_digest as pd

logger = logging.getLogger("ladder_propose")

SITE_URL = os.environ.get("SITE_URL", "https://dityam.com.ua")
MODEL = os.environ.get("LADDER_MODEL") or "claude-opus-5"
# $ за мільйон токенів (вхід, вихід) — лише щоб друкувати ціну запуску
# (рішення Марії 21.09.2026: спершу цифри витрат на AI).
PRICES = {"claude-opus-5": (5.0, 25.0), "claude-sonnet-5": (2.0, 10.0),
          "claude-haiku-4-5": (1.0, 5.0)}
MAX_CANDIDATES = 40
MAX_PENDING = int(os.environ.get("LADDER_MAX_PENDING", "10"))
RECHECK_DAYS = 60   # за стільки зʼявляються нові записи — варто глянути знову

# Типи, де «наступна сходинка» має сенс: розвиток дитини, а не довідка.
# Виплати, гуманітарка, реабілітація, гуртки з «набір постійний» — ні.
GROWTH_TYPES = {
    "competition", "olympiad", "camp", "exchange", "scholarship", "grant", "course",
    "volunteer", "festival", "conference", "study_program", "sport_tournament",
    "internship", "summer_school", "hackathon", "mentorship", "residency",
}
# Надто загальні теми: збіг лише за ними ще не робить програми одного напряму.
BROAD_THEMES = {"format", "online", "nonformal", "international", "contests", "camps"}

FIELDS = ("id, title, summary, slug, age_from, age_to, cost_type, created_at, deadline, "
          "event_start_date, event_end_date, timing_assumed, opportunity_type, format, "
          "cities, countries, is_international, categories, telegram_posted_at")

TOOL = {
    "name": "propose_next",
    "description": "Наступні сходинки після програми X — номери зі списку кандидатів.",
    "input_schema": {
        "type": "object",
        "properties": {
            "next": {
                "type": "array",
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {
                        "n": {"type": "integer", "description": "Номер кандидата зі списку."},
                        "why": {"type": "string",
                                "description": "Одне речення українською, до 160 символів: "
                                               "чому це наступний крок після X. Лише факти "
                                               "із записів."},
                    },
                    "required": ["n", "why"],
                },
            },
        },
        "required": ["next"],
    },
}

SYSTEM = """Ти допомагаєш платформі можливостей для дітей 0–18 років будувати «драбину розвитку».

Дано програму X і пронумерований список кандидатів із бази. Обери 0–2 кандидати, які є природною НАСТУПНОЮ СХОДИНКОЮ для дитини, що бере участь у X.

Наступна сходинка — програма, куди логічно йти ПІСЛЯ X:
- той самий напрям, але вищий рівень (школа → область чи Україна → міжнародний рівень);
- або програма, що прямо спирається на результат чи навичку з X (відбір для учасників чи переможців, поглиблений курс після базового).

НЕ сходинка:
- схожа програма того самого рівня — це альтернатива X, а не наступний крок;
- програма іншого напряму;
- загальний ресурс, довідка, виплата.

Бери номери лише зі списку. Якщо жоден кандидат не є справжньою наступною сходинкою — поверни порожній список: пропущена сходинка краща за хибну.
У why — одне речення до 160 символів лише з фактів, що є в записах (рівень, організатор, вік). Нічого не вигадуй.
Відповідай лише викликом propose_next."""


def load_active(client) -> list:
    """Усі активні записи сторінками (PostgREST віддає максимум 1000 рядків)."""
    out = []
    for start in range(0, 20000, 1000):
        page = (client.table("opportunities").select(FIELDS)
                .eq("status", "active").is_("canonical_slug", "null")
                .order("id").range(start, start + 999).execute().data or [])
        out.extend(page)
        if len(page) < 1000:
            break
    for o in out:
        o["_themes"] = pd.themes_of(o)
    return out


def growth(o: dict) -> bool:
    """Запис, з якого чи до якого може вести сходинка. «Набір постійний» як
    припущення (timing_assumed) — ні: у добірку він однаково не піде."""
    return o.get("opportunity_type") in GROWTH_TYPES and not o.get("timing_assumed")


def pick_sources(opps: list, marked_ids: set, checked: dict, limit: int, now=None) -> list:
    """Програми X для цього запуску. Спершу позначені родинами — там сходинка
    потрібна вже зараз; далі — новіші записи, яких модель ще не дивилась або
    дивилась понад RECHECK_DAYS тому."""
    now = now or datetime.now(timezone.utc)
    fresh_before = now - timedelta(days=RECHECK_DAYS)

    def due(o):
        at = pd.parse_ts(checked.get(o["id"]))
        return at is None or at < fresh_before

    first = [o for o in opps if o["id"] in marked_ids and due(o)]
    rest = sorted((o for o in opps if o["id"] not in marked_ids and growth(o) and due(o)),
                  key=lambda o: o.get("created_at") or "", reverse=True)
    return (first + rest)[:limit]


def candidates_for(x: dict, opps: list, limit: int = MAX_CANDIDATES) -> list:
    """Кандидати в наступну сходинку після X: той самий напрям (спільна
    змістовна тема) і вік, що перетинається з віком X або старший до 4 років.
    Це лише звуження для моделі — вирішує вона, а остаточно людина."""
    x_from, x_to = x.get("age_from") or 0, x.get("age_to") or 18
    x_themes = (x.get("_themes") or set()) - BROAD_THEMES
    scored = []
    for o in opps:
        if o["id"] == x["id"] or not growth(o):
            continue
        o_from, o_to = o.get("age_from") or 0, o.get("age_to") or 18
        if o_to < x_from or o_from > x_to + 4:
            continue
        shared = len(x_themes & ((o.get("_themes") or set()) - BROAD_THEMES))
        same_type = o.get("opportunity_type") == x.get("opportunity_type")
        if not shared and not same_type:
            continue
        scored.append((shared, same_type, o.get("created_at") or "", o))
    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    return [t[3] for t in scored[:limit]]


def _card(o: dict) -> str:
    where = "міжнародна" if o.get("is_international") else ", ".join((o.get("cities") or [])[:3])
    bits = [f"Назва: {o.get('title')}",
            f"Тип: {o.get('opportunity_type')} · Вік: {o.get('age_from')}–{o.get('age_to')}"
            + (f" · Де: {where}" if where else "")
            + (f" · Дедлайн: {o['deadline']}" if o.get("deadline") else ""),
            f"Опис: {(o.get('summary') or '')[:300]}"]
    return "\n".join(bits)


def parse_answer(tool_input, cands: list) -> list:
    """[(кандидат, why)] — лише валідні номери, без повторів, з поясненням.
    Усе інше відкидаємо мовчки: краще нічого, ніж звʼязок, якого модель не
    вибирала."""
    out, seen = [], set()
    items = (tool_input or {}).get("next") or []
    if not isinstance(items, list):
        return []
    for it in items[:2]:
        if not isinstance(it, dict):
            continue
        n, why = it.get("n"), (it.get("why") or "").strip()
        if not isinstance(n, int) or not (1 <= n <= len(cands)) or n in seen or not why:
            continue
        seen.add(n)
        out.append((cands[n - 1], why[:300]))
    return out


def ask_model(llm, x: dict, cands: list, usage: dict) -> list:
    listing = "\n\n".join(f"{i}. {_card(o)}" for i, o in enumerate(cands, 1))
    resp = llm.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "propose_next"},
        messages=[{"role": "user", "content":
                   f"ПРОГРАМА X:\n{_card(x)}\n\nКАНДИДАТИ:\n\n{listing}"}],
        # Відмова класифікатора не має залишати програму без відповіді назавжди:
        # сервер сам перезапустить запит на моделі, що погодиться.
        extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
        extra_body={"fallbacks": "default"},
    )
    u = getattr(resp, "usage", None)
    usage["in"] += getattr(u, "input_tokens", 0) or 0
    usage["out"] += getattr(u, "output_tokens", 0) or 0
    if getattr(resp, "stop_reason", None) == "refusal":
        logger.warning("модель відмовилась щодо «%s»", x.get("title"))
        return []
    block = next((b for b in resp.content if getattr(b, "type", None) == "tool_use"), None)
    return parse_answer(block.input if block else None, cands)


def cost(usage: dict) -> str:
    p = PRICES.get(MODEL)
    toks = f"{usage['in']} вхідних + {usage['out']} вихідних токенів"
    if not p:
        return toks
    usd = usage["in"] / 1e6 * p[0] + usage["out"] / 1e6 * p[1]
    return f"{toks} ≈ ${usd:.3f}"


def card_text(row: dict, x: dict, y: dict) -> str:
    def line(o):
        url = f"{SITE_URL}/o/{o['slug']}"
        return (f"<a href=\"{html.escape(url)}\">{html.escape(o['title'])}</a>\n"
                f"<i>{html.escape(pd._meta(o))}</i>")
    return (f"🪜 <b>Наступна сходинка?</b>\n\n"
            f"Після: {line(x)}\n\n"
            f"Далі: {line(y)}\n\n"
            f"Чому: {html.escape(row.get('reason') or '—')}\n\n"
            f"✅ — зʼявиться в добірці Dityam+ родинам, які позначили першу «✍️ подаюсь».")


def card_keyboard(ladder_id: str) -> dict:
    # callback_data ≤ 64 байти: lad:yes:<uuid> — 44.
    return {"inline_keyboard": [[
        {"text": "✅ Так, сходинка", "callback_data": f"lad:yes:{ladder_id}"},
        {"text": "❌ Ні", "callback_data": f"lad:no:{ladder_id}"},
    ]]}


def send_cards(client, by_id: dict, max_cards: int) -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
    if not token or not chat:
        logger.error("🔴 Немає TELEGRAM_BOT_TOKEN або TELEGRAM_ADMIN_CHAT_ID — картки нікуди слати")
        return -1
    waiting = (client.table("opportunity_ladder").select("id", count="exact")
               .eq("status", "proposed").not_.is_("asked_at", "null").execute().count or 0)
    room = min(max_cards, MAX_PENDING - waiting)
    if room <= 0:
        logger.info("Без відповіді вже %d карток — нових не шлю", waiting)
        return 0
    # Беремо із запасом: пари, де одну з програм уже закрили, пропускаємо, і
    # вони не мають загородити чергу собою.
    rows = (client.table("opportunity_ladder").select("id, from_id, to_id, reason")
            .eq("status", "proposed").is_("asked_at", "null")
            .order("created_at").limit(50).execute().data or [])
    sent = 0
    for row in rows:
        if sent >= room:
            break
        x, y = by_id.get(str(row["from_id"])), by_id.get(str(row["to_id"]))
        if not x or not y:
            # Одну з програм закрили, поки картка чекала: питати про неї нема сенсу.
            continue
        r = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json={
            "chat_id": chat, "text": card_text(row, x, y), "parse_mode": "HTML",
            "disable_web_page_preview": True, "reply_markup": card_keyboard(row["id"]),
        }, timeout=20)
        if r.status_code != 200:
            logger.error("🔴 Картка %s не пішла: %s %s", row["id"], r.status_code, r.text[:200])
            continue
        client.table("opportunity_ladder").update(
            {"asked_at": datetime.now(timezone.utc).isoformat()}).eq("id", row["id"]).execute()
        sent += 1
    return sent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--max-cards", type=int, default=5)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cards-only", action="store_true")
    args = ap.parse_args()

    from db import get_client
    client = get_client()
    opps = load_active(client)
    by_id = {str(o["id"]): o for o in opps}
    logger.info("Активних записів: %d, з них для сходинок: %d",
                len(opps), sum(1 for o in opps if growth(o)))

    if not args.cards_only:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            logger.error("🔴 Немає ANTHROPIC_API_KEY — пропонувати нічим")
            return 1
        llm = api_guard.client(api_key=key)
        marked = {str(r["opportunity_id"]) for r in (
            client.table("plus_applications").select("opportunity_id")
            .neq("stage", "skipped").execute().data or [])}
        checked = {str(r["opportunity_id"]): r["checked_at"] for r in (
            client.table("opportunity_ladder_checks").select("opportunity_id, checked_at")
            .execute().data or [])}
        existing = {(str(r["from_id"]), str(r["to_id"])) for r in (
            client.table("opportunity_ladder").select("from_id, to_id").execute().data or [])}

        usage = {"in": 0, "out": 0}
        proposed = 0
        for x in pick_sources(opps, marked, checked, args.limit):
            cands = [c for c in candidates_for(x, opps)
                     if (str(x["id"]), str(c["id"])) not in existing]
            picks = ask_model(llm, x, cands, usage) if cands else []
            logger.info("«%s» — кандидатів %d, запропоновано %d%s", x["title"][:60], len(cands),
                        len(picks), "".join(f"\n    → {y['title'][:70]} ({why})" for y, why in picks))
            if args.dry_run:
                continue
            for y, why in picks:
                client.table("opportunity_ladder").upsert({
                    "from_id": x["id"], "to_id": y["id"], "reason": why,
                    "status": "proposed", "proposed_by": "model", "model": MODEL,
                }, on_conflict="from_id,to_id", ignore_duplicates=True).execute()
                proposed += 1
            client.table("opportunity_ladder_checks").upsert({
                "opportunity_id": x["id"], "found": len(picks), "model": MODEL,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="opportunity_id").execute()
        logger.info("Модель: %s. Нових пропозицій: %d", cost(usage), proposed)

    if args.dry_run:
        return 0
    cards = send_cards(client, by_id, args.max_cards)
    logger.info("Карток в адмін-бот: %d", max(cards, 0))
    return 1 if cards < 0 else 0


if __name__ == "__main__":
    sys.exit(main())
