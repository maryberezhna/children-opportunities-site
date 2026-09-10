"""audit_seed.py — звірка старих записів із їхньою живою сторінкою.

Навіщо. 21 квітня 2026 в базу лягло 140 записів зі 122 різних джерел —
приблизно по одному на джерело. Це не скрап, а стартовий набір, написаний
моделлю з загальних знань: жодної сторінки ніхто не читав. Наслідки видно
досі — Chevening (магістратура) стоїть із віком 17, DAAD «літні мовні школи
15–17» насправді студентські, Global UGRAD описано як програму для школярів,
хоча вона для студентів вишів.

Чому цього не полагодив жоден із наявних механізмів. Усі запобіжники
конвеєра стоять НА ВХОДІ: перевірка живого посилання при додаванні,
enrollment_status, закриття минулих подій, вимір географії. Усі вони
з'явилися в серпні. Квітневий набір зайшов, коли дверей ще не було, і жоден
із них не вміє повертатись назад.

Чому не проста переекстракція через raw_items. Upsert шукає наявний запис за
content_hash АБО slug АБО canonical_url+назва. Заголовок, написаний моделлю у
квітні, не збігається з тим, що модель витягне зі справжньої сторінки, тож
переекстракція створила б ДРУГИЙ запис замість виправлення першого. Тому тут
звірка: читаємо сторінку, порівнюємо з тим, що збережено, і правимо поля
на місці за id.

Що робить з висновком:
  ok             — сторінка підтверджує запис, лише скидаємо updated_at;
  fix            — та сама можливість, але поля хибні: правимо вік / тип /
                   вартість на місці;
  wrong_audience — сторінка ПРЯМО каже, що це для студентів вишів чи
                   дорослих → status='draft' + пояснення в moderation_note;
  unclear        — сторінка нічого не підтверджує й нічого не спростовує →
                   НІЧОГО не робимо, лише пишемо в лог.

Чому немає висновку «сторінка про інше». Перший сухий прогін 10.09.2026 дав
його 15 записам із 25 — Yale Young Global Scholars, PASCH, Microsoft Imagine
Cup Junior, BBC Learning English. Усі вони існують. Причина в тому, що
квітневі записи часто вказують на ГОЛОВНУ сторінку сайту, а не на сторінку
програми: pasch-net.de віддає 8 КБ німецької навігації про вебінари для
вчителів, bbc.co.uk/learningenglish — саме меню, Yale за межами України
відповідає 403. Модель чесно бачила, що сторінка не описує запис, і робила з
цього хибний висновок, що запис неправдивий. «Не сказано» і «сказано інше» —
різні речі, і тепер перше не веде до жодної дії.

Чому draft, а не видалення: рішення ухвалює модель по одній сторінці, і
помилитись вона може. Draft ховає запис із сайту, але лишає його Марії на
перегляд. note_status свідомо НЕ ставимо в 'pending' — інакше погодинний
process_notes.py прийме наше пояснення за вказівку редактора й почне його
виконувати.

Запуск:
    python scraper/audit_seed.py --dry-run              # показати, нічого не писати
    python scraper/audit_seed.py --limit 20             # обережний перший прогін
    python scraper/audit_seed.py --created 2026-04-21   # інша дата набору
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import anthropic
import httpx
from bs4 import BeautifulSoup

from db import get_client
from normalizer import VALID_COST_TYPES, VALID_OPP_TYPES

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("audit_seed")

MODEL = "claude-haiku-4-5-20251001"
SEED_DATE = "2026-04-21"
PAGE_LIMIT = 6000          # символів сторінки в промпт
MIN_PAGE_CHARS = 400       # коротше — сторінка-заглушка, не зміст
BLOCK_MARKERS = (
    "403 forbidden", "404 not found", "access denied", "just a moment",
    "enable javascript", "checking your browser", "are you a robot",
    "captcha", "сторінку не знайдено", "доступ заборонено",
)
DELAY_BETWEEN = 0.5        # пауза між зверненнями до чужих сайтів
UA = "Mozilla/5.0 (compatible; DityamSeedAudit/1.0; +https://dityam.com.ua)"

TOOL = {
    "name": "audit_record",
    "description": "Звірка збереженого запису з текстом його живої сторінки",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["ok", "fix", "wrong_audience", "unclear"],
                "description": (
                    "ok — сторінка підтверджує збережені дані; "
                    "fix — та сама можливість, але вік/тип/вартість хибні "
                    "(сторінка ПРЯМО називає інший вік); "
                    "wrong_audience — сторінка ПРЯМО каже, що це для "
                    "студентів вишів, магістратури або дорослих; "
                    "unclear — сторінка не описує цю можливість або майже не "
                    "має змісту (головна сторінка сайту, саме меню, "
                    "captcha, сторінка помилки). ЦЕ ЗНАЧЕННЯ ЗА "
                    "ЗАМОВЧУВАННЯМ, коли доказів немає"
                ),
            },
            "age_from": {"type": "integer", "description": "Виправлений мінімальний вік, 0-18"},
            "age_to": {"type": "integer", "description": "Виправлений максимальний вік, 0-18"},
            "opportunity_type": {"type": "string", "description": "Виправлений тип або порожньо"},
            "cost_type": {"type": "string", "description": "Виправлена вартість або порожньо"},
            "reason": {
                "type": "string",
                "description": "Одне речення українською: що саме на сторінці "
                               "суперечить запису. Обов'язкове для всіх "
                               "висновків, окрім ok.",
            },
        },
        "required": ["verdict", "reason"],
    },
}

SYSTEM = """Ти звіряєш картку можливості з текстом її справжньої сторінки.

Платформа збирає можливості для ДІТЕЙ І ПІДЛІТКІВ 0-18 років. Картки, що
насправді описують програми для студентів вишів, магістратури чи дорослих,
на платформі бути не повинні — навіть якщо в назві є слово «молодь».

ГОЛОВНЕ ПРАВИЛО. Багато карток вказують на головну сторінку сайту, а не на
сторінку конкретної програми. Тоді в тексті буде меню, новини, загальний
опис організації — і жодного слова про саму можливість. Це НЕ доказ, що
картка неправдива. Такий випадок — unclear, і ми нічого не робимо.

Діяти можна лише тоді, коли сторінка ПРЯМО щось стверджує:
- verdict = wrong_audience, якщо на сторінці написано, що учасники —
  студенти вишів, випускники, магістранти або дорослі: «bachelor's degree»,
  «undergraduate students», «for university students», «магістратура»,
  «18+». Наведи цю фразу в reason.
- verdict = fix, якщо сторінка ПРЯМО називає інший вік або клас, ніж у
  картці: «учні 8-10 класів», «ages 15-17». Наведи цю фразу в reason.
- verdict = ok, якщо сторінка підтверджує суть картки й не суперечить віку.
- verdict = unclear в усіх інших випадках: сторінка ні про що конкретне,
  саме навігація, іншою мовою без деталей, captcha, «403», «сторінку не
  знайдено», або просто нічого про цю можливість не сказано.

Сумніваєшся — unclear. Помилковий unclear нічого не коштує: запис лишається
як був. Помилковий wrong_audience ховає із сайту справжню можливість.

reason пиши одним реченням українською. Для wrong_audience і fix — з
цитатою зі сторінки."""


def fetch_text(url: str) -> str | None:
    """Текст сторінки або None. Недоступна сторінка — не наша справа:
    мертві посилання добиває щоденний verify-links своєю стан-машиною."""
    try:
        with httpx.Client(timeout=15, follow_redirects=True,
                          headers={"User-Agent": UA}) as client:
            r = client.get(url)
        if r.status_code >= 400:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text(" ").split())
        if not text:
            return None
        # Сторінка-заглушка. Yale за межами України віддає 68 символів «403
        # Forbidden» із кодом 403, але деякі захисти повертають те саме з
        # кодом 200 — на код покладатись не можна. Такий текст моделі краще
        # не показувати взагалі: вона з нього робить висновок, якого там нема.
        if len(text) < MIN_PAGE_CHARS:
            return None
        low = text[:400].lower()
        if any(m in low for m in BLOCK_MARKERS):
            return None
        return text[:PAGE_LIMIT]
    except Exception:
        return None


def ask(ai: anthropic.Anthropic, row: dict, page: str) -> dict | None:
    stored = (
        f"НАЗВА: {row.get('title') or ''}\n"
        f"ОПИС: {row.get('summary') or ''}\n"
        f"ВІК У КАРТЦІ: {row.get('age_from')}-{row.get('age_to')}\n"
        f"ТИП: {row.get('opportunity_type')}\n"
        f"ВАРТІСТЬ: {row.get('cost_type')}"
    )
    msg = f"ЗБЕРЕЖЕНА КАРТКА:\n{stored}\n\n---\n\nТЕКСТ ЖИВОЇ СТОРІНКИ:\n{page}"
    for attempt in range(3):
        try:
            resp = ai.messages.create(
                model=MODEL, max_tokens=600, system=SYSTEM, tools=[TOOL],
                tool_choice={"type": "tool", "name": "audit_record"},
                messages=[{"role": "user", "content": msg}],
            )
            break
        except anthropic.APIStatusError as e:
            # Помилку оплати повторювати немає сенсу — вона не мине.
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    for block in resp.content:
        if block.type == "tool_use":
            return block.input
    return None


def _age(value, fallback):
    """Вік лишається в межах 0-18: модель інколи повертає 22 для програми,
    яку сама ж визнала шкільною."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return fallback
    return n if 0 <= n <= 18 else fallback


def build_patch(row: dict, ans: dict) -> tuple[dict, str]:
    """Патч для запису й короткий рядок для лога."""
    verdict = ans.get("verdict")
    reason = (ans.get("reason") or "").strip()

    if verdict == "wrong_audience":
        label = "не для дітей 0-18"
        return ({
            "status": "draft",
            # note_status НЕ чіпаємо: 'pending' запустив би process_notes.py,
            # який прийняв би це пояснення за вказівку редактора.
            "moderation_note": f"Автозвірка {SEED_DATE}-набору: {label}. {reason}"[:1000],
        }, f"→ draft ({label})")

    if verdict == "fix":
        patch = {}
        af = _age(ans.get("age_from"), row.get("age_from"))
        at = _age(ans.get("age_to"), row.get("age_to"))
        if af is not None and at is not None and af <= at:
            if af != row.get("age_from"):
                patch["age_from"] = af
            if at != row.get("age_to"):
                patch["age_to"] = at
        ot = (ans.get("opportunity_type") or "").strip()
        if ot in VALID_OPP_TYPES and ot != row.get("opportunity_type"):
            patch["opportunity_type"] = ot
        ct = (ans.get("cost_type") or "").strip()
        if ct in VALID_COST_TYPES and ct != row.get("cost_type"):
            patch["cost_type"] = ct
        if not patch:
            return {}, "fix без змін — лишаємо як є"
        return patch, "→ " + ", ".join(f"{k}={v}" for k, v in patch.items())

    return {}, ("unclear" if verdict == "unclear" else "ok")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--created", default=SEED_DATE, help="дата набору (YYYY-MM-DD)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("Немає ANTHROPIC_API_KEY")
        return 1

    db = get_client()
    ai = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # verified_at — запис, який дивився модератор: його правки чужі, не чіпаємо.
    # canonical_slug — уже склеєний дубль, він і так не показується.
    rows = (db.table("opportunities")
            .select("id, title, summary, source_url, age_from, age_to, "
                    "opportunity_type, cost_type")
            .eq("status", "active")
            .is_("verified_at", "null")
            .is_("canonical_slug", "null")
            .gte("created_at", f"{args.created}T00:00:00Z")
            .lt("created_at", f"{args.created}T23:59:59Z")
            .order("id")
            .execute().data or [])
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Записів набору %s до звірки: %d", args.created, len(rows))

    stats = {"ok": 0, "fix": 0, "draft": 0, "unclear": 0,
             "unreachable": 0, "no_answer": 0}
    for i, row in enumerate(rows):
        if i:
            time.sleep(DELAY_BETWEEN)
        url = (row.get("source_url") or "").strip()
        title = (row.get("title") or "")[:58]
        if not url.startswith("http"):
            stats["unreachable"] += 1
            continue
        page = fetch_text(url)
        if not page:
            stats["unreachable"] += 1
            logger.info("%-58s | сторінка недоступна", title)
            continue

        ans = ask(ai, row, page)
        if not ans:
            stats["no_answer"] += 1
            logger.warning("%-58s | модель не відповіла", title)
            continue

        patch, note = build_patch(row, ans)
        if not patch:
            stats["unclear" if ans.get("verdict") == "unclear" else "ok"] += 1
            continue
        stats["draft" if patch.get("status") == "draft" else "fix"] += 1
        logger.info("%-58s | %s", title, note)
        if not args.dry_run:
            db.table("opportunities").update(patch).eq("id", row["id"]).execute()

    logger.info(
        "Готово. Підтверджено: %d | виправлено: %d | у чернетки: %d | "
        "без доказів: %d | недоступних: %d | без відповіді: %d%s",
        stats["ok"], stats["fix"], stats["draft"], stats["unclear"],
        stats["unreachable"], stats["no_answer"],
        "  (dry-run, нічого не записано)" if args.dry_run else "",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
