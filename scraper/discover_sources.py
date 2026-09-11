"""discover_sources.py — щоденний агент-розвідник ДЖЕРЕЛ.

Чим відрізняється від discover_agent.py: той шукає окремі можливості, цей
шукає САЙТИ, які їх публікують. Різниця принципова. Поки ми шукаємо лише
можливості, наповнення лишається пасивним: ми знаходимо те, що вже лежить
там, куди ми ходимо. Нове джерело — це десятки можливостей щороку, і саме
джерел нам бракує найбільше.

Акцент — українські діти ЗА КОРДОНОМ: фонди, міжнародні організації,
стипендійні програми, діаспорні спільноти. Це найдефіцитніша категорія в
базі й водночас найцінніша для родини.

Мови. Шукаємо будь-якою: польською, румунською, угорською, словацькою,
німецькою, чеською, англійською, французькою. Українською такі програми
часто не описані взагалі, і саме тому родина їх не знаходить.

Окремий акцент — країни-сусіди України: Польща, Румунія, Молдова,
Угорщина, Словаччина. Туди виїхало найбільше родин, і саме там програми
описані місцевою мовою, якої батьки не знають. Росія й Білорусь виключені
назавжди. Мова джерела записується як є; переклад
українською робить конвеєр на етапі екстракції, не цей агент.

Що робить з кандидатом:
  1. канонізує домен і відкидає той, що вже є в sources або в кандидатах;
  2. ПРОБУЄ сторінку — чи відповідає, чи є на ній ознаки переліку;
  3. оцінює за рубрикою (0-100) з поясненням;
  4. кладе в source_candidates зі статусом pending.

У каталог звідси не потрапляє НІЧОГО. Джерело заводить людина.

Env:
  ANTHROPIC_API_KEY          — ключ (web search має бути увімкнений)
  SUPABASE_URL / SUPABASE_SERVICE_KEY
  DISCOVER_SOURCES_MODEL     — опц., модель (деф. claude-sonnet-5)
  DISCOVER_SOURCES_MAX       — опц., скільки кандидатів просити (деф. 6)
  DISCOVER_SOURCES_THEME     — опц., перебити тему дня
  DRY_RUN=true               — лише вивести, нічого не писати
"""
import json
import logging
import os
from datetime import date, datetime, timezone
from urllib.parse import urlparse

import httpx

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

MODEL = os.environ.get("DISCOVER_SOURCES_MODEL") or "claude-sonnet-5"
MAX_CANDIDATES = int(os.environ.get("DISCOVER_SOURCES_MAX", "6"))
DRY_RUN = os.environ.get("DRY_RUN") == "true"

# Мінімальний бал, щоб кандидат узагалі потрапив у чергу. Нижче — шум:
# новинні агрегатори, сторінки організацій без програм, комерційні курси.
MIN_SCORE = 45

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk,en;q=0.9,de;q=0.8,pl;q=0.7",
}

# Теми ротуються по днях, щоб за тиждень агент обійшов усі напрями, а не
# перепитував одне й те саме. Перелік навмисно вузький і весь про дітей.
THEMES = [
    "фонди, які фінансують освіту українських дітей за кордоном",
    "стипендії для українських школярів у школах Європи",
    "міжнародні організації з програмами для дітей-біженців з України",
    "літні табори й обміни для українських дітей у Німеччині, Польщі, Чехії",
    "програми для українських дітей у країнах-сусідах: Польща, Румунія, "
    "Молдова, Угорщина, Словаччина",
    "українські суботні школи та освітні центри діаспори",
    "гранти й конкурси для підлітків 13-18 з України, відкриті з-за кордону",
    "психологічна й освітня підтримка дітей з України від європейських НУО",
]


def theme_of_day() -> str:
    override = (os.environ.get("DISCOVER_SOURCES_THEME") or "").strip()
    if override:
        return override
    return THEMES[date.today().timetuple().tm_yday % len(THEMES)]


PROMPT = """Ти шукаєш ДЖЕРЕЛА для платформи Dityam.com.ua — вона збирає
можливості для українських дітей 0–18 років.

Тема пошуку на сьогодні: {theme}

Шукай САЙТИ, які регулярно публікують такі можливості: фонди, міжнародні
організації, стипендійні програми, освітні центри, державні агенції інших
країн, діаспорні спільноти. НЕ шукай окремі можливості — шукай того, хто їх
публікує раз за разом.

Шукай БУДЬ-ЯКОЮ мовою: польською, румунською, угорською, словацькою,
німецькою, чеською, англійською, французькою. Українською ці програми часто
не описані взагалі — і саме тому родина їх не знаходить.

Окремий пріоритет — КРАЇНИ-СУСІДИ України: Польща, Румунія, Молдова,
Угорщина, Словаччина. Туди виїхало найбільше родин. Росію й Білорусь не
розглядай узагалі, за жодних умов.

Для кожного сайту поверни:
- name — назва організації її власною мовою
- url — адреса сторінки, де лежить ПЕРЕЛІК програм (не головна, якщо перелік
  на окремій сторінці)
- kind — одне з: foundation, international_org, government, school, community,
  media, other
- language — мова сайту двома літерами (de, pl, en, cs, fr, uk)
- countries — країни, яких стосується, кодами ISO alpha-2
- why — одне речення українською: чому це джерело нам підходить
- evidence — назви 1–3 КОНКРЕТНИХ програм для дітей, які ти там побачив

ГОЛОВНЕ ПРАВИЛО: нічого не вигадуй. Якщо ти не бачив на сайті конкретних
програм для дітей — не додавай його. Порожній список краще за вигаданий.
Не додавай агрегатори чужих можливостей і новинні портали.

Поверни ТІЛЬКИ JSON-масив із {max_n} або менше обʼєктів, без пояснень.
"""


def _extract_json_array(text: str):
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch != "[":
            continue
        try:
            value, _ = decoder.raw_decode(text, i)
            if isinstance(value, list):
                return value
        except json.JSONDecodeError:
            continue
    return None


def search(theme: str) -> list[dict]:
    body = {
        "model": MODEL,
        "max_tokens": 6000,
        "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}],
        "messages": [{"role": "user",
                      "content": PROMPT.format(theme=theme, max_n=MAX_CANDIDATES)}],
    }
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
            timeout=240,
        )
    except Exception as e:
        logger.error("Запит не вдався: %s", e)
        return []
    if r.status_code != 200:
        detail = r.text[:400]
        try:
            detail = r.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Anthropic API HTTP %s: %s", r.status_code, detail)
        return []
    data = r.json()
    text = "".join(b.get("text", "") for b in data.get("content", [])
                   if b.get("type") == "text")
    used = data.get("usage", {}).get("server_tool_use", {}).get("web_search_requests")
    logger.info("  веб-пошуків використано: %s", used)
    parsed = _extract_json_array(text)
    if parsed is None:
        logger.info("  JSON не виділено. Початок відповіді: %s",
                    text[:200].replace("\n", " "))
        return []
    return [c for c in parsed if isinstance(c, dict)]


def domain_of(url: str) -> str:
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


# Ознаки того, що на сторінці справді перелік, а не стаття: багато посилань
# усередину сайту й слова про подачу. Груба евристика навмисно: точну
# придатність усе одно вирішує людина, а нам треба лише розвести
# «машиною читається» і «дивитись руками».
LISTING_WORDS = (
    "apply", "application", "deadline", "programme", "program", "scholarship",
    "stipend", "bewerbung", "stypendium", "nabór", "konkurs", "grant",
    "заявка", "подати", "стипенді", "конкурс",
)


def probe(url: str) -> tuple[str, str, list[str]]:
    """Чи можемо ми взагалі це читати. Повертає (scrapable, probe_status, зразки)."""
    try:
        with httpx.Client(headers=_HEADERS, timeout=25.0, follow_redirects=True) as c:
            r = c.get(url)
    except Exception as e:
        return "no", f"не відповів: {type(e).__name__}", []
    status = f"HTTP {r.status_code}"
    if r.status_code == 403 and "cloudflare" in r.headers.get("server", "").lower():
        # Сайт живий, але за антиботом: людині він відкриється, нам ні.
        return "manual", f"{status} · Cloudflare", []
    if r.status_code >= 400:
        return "no", status, []
    html = r.text
    low = html.lower()
    hits = [w for w in LISTING_WORDS if w in low]
    links = low.count("<a ")
    if hits and links > 20:
        return "yes", f"{status} · ознак переліку: {len(hits)}", hits[:5]
    return "manual", f"{status} · переліку не видно (посилань {links})", hits[:5]


SCORE_TOOL = {
    "name": "score_source",
    "description": "Оцінка джерела для платформи можливостей для дітей",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100},
            "reason": {"type": "string",
                       "description": "Одне-два речення українською"},
        },
        "required": ["score", "reason"],
    },
}

SCORE_PROMPT = """Оціни джерело для Dityam.com.ua — платформи можливостей для
українських дітей 0–18 років.

Джерело: {name}
Адреса: {url}
Тип: {kind} · мова: {language} · країни: {countries}
Що агент там побачив: {evidence}
Чому пропонує: {why}
Технічна проба: {probe}

Рубрика, 0–100:
- 40 балів: чи є там САМЕ можливості для дітей 0–18 (а не для дорослих,
  студентів вишів, вчителів або організацій);
- 25 балів: чи доступні вони українській дитині — в Україні або за кордоном;
- 20 балів: чи це першоджерело (організатор), а не переказ чужих можливостей;
- 15 балів: чи оновлюється — нові набори щороку або частіше.

Знижуй різко, якщо: це агрегатор, новинний портал, комерційні платні курси,
сторінка однієї минулої події, або якщо з наданого не видно жодної конкретної
програми для дитини.

НІЧОГО НЕ ВИГАДУЙ: оцінюй лише те, що бачиш у цих даних. Якщо даних мало —
низький бал і скажи про це прямо."""


def score(client_key: str, cand: dict, probe_status: str) -> tuple[int, str]:
    body = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 600,
        "tools": [SCORE_TOOL],
        "tool_choice": {"type": "tool", "name": "score_source"},
        "messages": [{"role": "user", "content": SCORE_PROMPT.format(
            name=cand.get("name", ""), url=cand.get("url", ""),
            kind=cand.get("kind", "?"), language=cand.get("language", "?"),
            countries=", ".join(cand.get("countries") or []) or "?",
            evidence="; ".join(cand.get("evidence") or []) or "нічого не названо",
            why=cand.get("why", ""), probe=probe_status)}],
    }
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages",
                       headers={"x-api-key": client_key,
                                "anthropic-version": "2023-06-01",
                                "content-type": "application/json"},
                       json=body, timeout=90)
        r.raise_for_status()
        for block in r.json().get("content", []):
            if block.get("type") == "tool_use":
                out = block["input"]
                return int(out.get("score", 0)), (out.get("reason") or "")[:400]
    except Exception as e:
        logger.warning("  оцінювач не відповів (%s) — ставлю 0", type(e).__name__)
    return 0, "оцінювач не відповів"


def known_domains(sb) -> set[str]:
    """Домени, які вже є: і в реєстрі джерел, і серед кандидатів, і серед
    опублікованих записів. Пропонувати те, що вже працює, — шум."""
    known = set()
    for row in (sb.table("source_candidates").select("domain").execute().data or []):
        known.add(row["domain"])
    for row in (sb.table("sources").select("name, config").execute().data or []):
        cfg = row.get("config") or {}
        for key in ("url", "list_url", "start_url", "sitemap"):
            if cfg.get(key):
                known.add(domain_of(cfg[key]))
    for row in (sb.table("opportunities").select("source_url")
                .not_.is_("source_url", "null").limit(2000).execute().data or []):
        d = domain_of(row["source_url"] or "")
        if d:
            known.add(d)
    known.discard("")
    return known


def main() -> int:
    theme = theme_of_day()
    logger.info("🔎 Розвідник джерел — тема дня: «%s» (модель %s)%s",
                theme, MODEL, " [DRY RUN]" if DRY_RUN else "")

    cands = search(theme)
    logger.info("  кандидатів від агента: %d", len(cands))
    if not cands:
        return 0

    sb = get_client()
    known = known_domains(sb)
    key = os.environ["ANTHROPIC_API_KEY"]

    kept = 0
    for c in cands:
        url = (c.get("url") or "").strip()
        name = (c.get("name") or "").strip()
        if not url.startswith("http") or not name:
            continue
        dom = domain_of(url)
        if not dom:
            continue
        if dom in known:
            logger.info("  ↩︎ %s — уже знаємо", dom)
            continue

        scrapable, probe_status, samples = probe(url)
        pts, reason = score(key, c, probe_status)
        mark = "✅" if pts >= MIN_SCORE else "▫️"
        logger.info("  %s %-34s %3d балів · %s · %s", mark, dom[:34], pts,
                    scrapable, probe_status)
        if pts < MIN_SCORE:
            continue

        row = {
            "domain": dom,
            "url": url[:500],
            "name": name[:200],
            "kind": (c.get("kind") or "other")[:40],
            "language": (c.get("language") or "")[:5] or None,
            "countries": [str(x)[:2].lower() for x in (c.get("countries") or [])][:8] or None,
            "score": max(0, min(100, pts)),
            "score_reason": reason,
            "probe_status": probe_status[:200],
            "scrapable": scrapable,
            "sample": {"evidence": (c.get("evidence") or [])[:3],
                       "why": c.get("why", ""), "words": samples},
            "found_by": f"тема: {theme}",
        }
        if DRY_RUN:
            logger.info("     (dry run, не пишу) %s", json.dumps(row, ensure_ascii=False)[:220])
        else:
            try:
                sb.table("source_candidates").insert(row).execute()
            except Exception as e:
                logger.warning("     не записалось: %s", e)
                continue
        known.add(dom)
        kept += 1

    logger.info("\nГотово: %d кандидатів у черзі на перегляд (поріг %d балів).",
                kept, MIN_SCORE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
