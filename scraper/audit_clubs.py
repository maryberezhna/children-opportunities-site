"""audit_clubs.py — чи живі гуртки, які ми колись зібрали масово.

Навіщо. 30.08–01.09.2026 гурткові скрапери поклали в базу понад пів тисячі
постійних гуртків: gurtok.org (житомирський довідник), «Школяр» (довідник по
містах), ЦПР Святошинського району, палаци творчості Харкова, Запоріжжя,
Франківська, Луцька, Дніпра. 01.09 Марія ці скрапери вимкнула, а записи
лишились: на 21.09.2026 це 563 з 1095 активних можливостей, і 349 з них —
Житомир. Відтоді їх ніхто не перечитував. Марія: «нам треба прогнати ті 700
гуртків, бо це капець» — і обрала перевірку, а не приховування.

Чому довідник — не доказ. Сторінка на gurtok.org чи «Школярі» не має жодної
дати: вона каже, що гурток колись існував. На «Школярі» поруч із гуртком
стоїть шаблонний «Lorem ipsum», а сайт «Творчої майстерні 2S» —
business.site, який Google закрив 2024 року. Тож для довідника дивимось
далі — на сайт самого організатора. Палаци й ЦПР — це і є сайти
організаторів, їхня сторінка сама по собі свідчить, що гурток у переліку.

Де взяти сайт організатора. На «Школярі» він буває в картці («Адреса
сайту»), частіше там лише Facebook, який без входу не прочитати. На
gurtok.org його немає зовсім: замаскований телефон, логотип міськради й
посилання на розробника в підвалі. Тому, коли на сторінці довідника сайту
немає або він не відкривається, модель шукає офіційну сторінку закладу
вебпошуком за назвою й адресою, а ми її завантажуємо самі — і висновок
«підтверджено» приймаємо лише з дослівною цитатою з того, що завантажили.

Висновки:
  confirmed    — сайт організатора описує цей гурток для дітей і не каже,
                 що він закрився. Лишаємо, правимо вік і вартість лише з
                 дослівною цитатою, ставимо content_checked_at («Перевірено»);
  gone         — сторінка ПРЯМО каже, що гурток чи заклад не працює →
                 closed, як це робить lifecycle.py;
  not_children — лише для дорослих → draft із поясненням, як audit_seed.py;
  unverified   — гурток описує лише довідник: сайту організатора немає, він
                 не відкривається або про цей гурток мовчить. Що з ними
                 робити, вирішує Марія після сухого прогону; до того —
                 нічого (або --hide-unverified → draft).

«Перевірено» на картці ставимо тільки підтвердженим: для непідтвердженого
це була б неправда (shared.js показує content_checked_at людям).

Запуск (ключ Anthropic — лише в секретах GitHub, див. audit-clubs.yml):
    python audit_clubs.py --dry-run --report report.jsonl
    python audit_clubs.py --limit 50
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from timing import evidence_in_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("audit_clubs")

MODEL = "claude-haiku-4-5-20251001"
UA = "Mozilla/5.0 (compatible; DityamClubAudit/1.0; +https://dityam.com.ua)"
PAGE_CHARS = 3500          # на кожну сторінку в промпті
MIN_PAGE_CHARS = 300
MAX_ORGANIZER_PAGES = 2
MAX_SEARCHES = 2           # вебпошуків на один гурток
WORKERS = 4

# Масові гурткові джерела. True — довідник (сторонній сайт), False — сайт
# самого організатора. Підпис джерела в базі: «Гурток (gurtok.org)» тощо.
BULK_SOURCES = {
    "gurtok.org": True,
    "shkolyar.org.ua": True,
    "cprs.kiev.ua": False,
    "firstpalace.kh.ua": False,
    "gordiy.zp.ua": False,
    "ocnttum.if.ua": False,
    "pum-lutsk.org": False,
    "palats.dp.ua": False,
}

# Посилання, які не є сайтом організатора: соцмережі (сторінку Facebook без
# входу не прочитати), карти, шерінг, самі довідники й конструктори-заглушки.
NOT_ORGANIZER = re.compile(
    r"(facebook\.com|fb\.com|instagram\.com|t\.me|telegram\.|tiktok\.com|youtube\.com|"
    r"youtu\.be|twitter\.com|x\.com|viber\.|wa\.me|whatsapp|google\.[a-z.]+/maps|"
    r"maps\.google|goo\.gl/maps|maps\.app\.goo\.gl|2gis\.|linkedin\.com|pinterest\.|"
    r"gurtok\.org|shkolyar\.org\.ua|schema\.org|w3\.org|gstatic|googleapis|"
    r"googletagmanager|google-analytics|doubleclick|wordpress\.org|gravatar|"
    # Підвал gurtok.org на кожній сторінці: логотип міськради й розробник.
    r"zt-rada\.gov\.ua|rostdigital\.com)",
    re.I,
)
URL_IN_TEXT = re.compile(r"https?://[^\s\"'<>()«»,]+", re.I)

SELECT = ("id, slug, title, summary, source, source_url, age_from, age_to, "
          "cost_type, cities, opportunity_type, admin_comment, content_checked_at")


def bulk_domain(source: str) -> str | None:
    s = (source or "").lower()
    return next((d for d in BULK_SOURCES if d in s), None)


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def organizer_links(html: str, page_url: str) -> list[str]:
    """Сайти організатора зі сторінки довідника: посилання й адреси в тексті,
    без соцмереж, карт і самого довідника. Порядок — як на сторінці."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    for tag in soup.select('[class*="footer"]'):
        tag.decompose()
    found = [a.get("href") or "" for a in soup.find_all("a")]
    found += URL_IN_TEXT.findall(soup.get_text(" "))
    own = _host(page_url)
    out, hosts = [], set()
    for raw in found:
        url = urljoin(page_url, raw.strip().rstrip(".;:"))
        host = _host(url)
        if (not url.startswith(("http://", "https://")) or not host or host == own
                or NOT_ORGANIZER.search(url) or host in hosts):
            continue
        hosts.add(host)
        out.append(url)
    return out


def page_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "svg"]):
        tag.decompose()
    return " ".join(soup.get_text(" ").split())


def fetch(client: httpx.Client, url: str) -> tuple[str | None, str | None, str]:
    """(html, текст, стан). Стан — коротко для моделі й звіту."""
    for attempt in range(2):
        try:
            r = client.get(url)
        except Exception as e:
            return None, None, f"не відкривається ({type(e).__name__})"
        # Палац у Харкові на паралельні запити відповідав 508 — один повтор.
        if r.status_code < 500 or attempt:
            break
        time.sleep(5)
    if r.status_code >= 400:
        return None, None, f"HTTP {r.status_code}"
    text = page_text(r.text)
    if len(text) < MIN_PAGE_CHARS:
        return r.text, None, f"порожня сторінка ({len(text)} символів)"
    return r.text, text, "відкривається"


TOOL = {
    "name": "audit_club",
    "description": "Чи підтверджують сторінки, що гурток існує, і чи правильна картка",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["confirmed", "gone", "not_children", "unverified"],
            },
            "evidence": {
                "type": "string",
                "description": "Дослівна цитата зі сторінки організатора (для "
                               "confirmed, gone, not_children). Порожньо для unverified.",
            },
            "age_from": {"type": "integer", "description": "Вік зі сторінки, якщо він інший, ніж у картці"},
            "age_to": {"type": "integer", "description": "Вік зі сторінки, якщо він інший, ніж у картці"},
            "age_evidence": {"type": "string", "description": "Дослівна цитата про вік або клас"},
            "cost": {"type": "string", "enum": ["", "free", "paid"],
                     "description": "Вартість зі сторінки, якщо вона ПРЯМО названа"},
            "cost_evidence": {"type": "string", "description": "Дослівна цитата про вартість"},
            "reason": {"type": "string", "description": "Одне речення українською"},
        },
        "required": ["verdict", "reason"],
    },
}

SYSTEM = """Ти перевіряєш, чи існує дитячий гурток із картки на платформі
можливостей для дітей 0-18 років, і чи правильні в картці вік і вартість.

Тобі дають картку, сторінку, з якої її колись узяли, і — якщо вона довідник —
сторінки сайту організатора, на які довідник посилається.

Висновок:
- confirmed — СТОРІНКА ОРГАНІЗАТОРА (його власний сайт: палац творчості,
  центр, студія, школа) описує цей гурток чи цей напрям для дітей і не каже,
  що він закрився. Сторінка довідника (gurtok.org, shkolyar.org.ua) сама
  по собі — НЕ підтвердження: там немає дат, і гурток міг давно закритися.
  Якщо джерело позначене як «сайт організатора», достатньо його сторінки.
- gone — сторінка ПРЯМО каже, що гурток, студія чи заклад не працює,
  закрились, набір припинено назавжди. Лише з дослівною цитатою.
- not_children — сторінка ПРЯМО каже, що заняття лише для дорослих.
- unverified — усе інше: сайту організатора немає, він не відкривається,
  це головна сторінка без жодного слова про цей гурток, або там про інше.
  Сумніваєшся — unverified.

Вік: лише якщо сторінка організатора ПРЯМО називає інший вік чи клас, ніж
у картці. Клас — не вік: 1 клас = 6 років, 4 клас = 9, 5 клас = 10,
9 клас = 14, 11 клас = 16-17. «З 3-х років» без верхньої межі — age_from=3,
age_to не заповнюй.

Вартість: free — лише якщо ПРЯМО сказано «безкоштовно», «безоплатно».
paid — якщо названо ціну, «платні заняття», абонемент. Якщо родина платить
хоч щось — це paid. Нічого не сказано — лиши порожнім.

evidence, age_evidence, cost_evidence — короткі дослівні цитати (5-25 слів),
скопійовані зі сторінки організатора символ у символ: без переказу, без
«...», без власних висновків. Для confirmed цитата має називати сам гурток
чи напрям занять, а не лише адресу чи назву закладу. Немає такої цитати —
це unverified. reason — одне речення."""


SEARCH_PROMPT = """Знайди в інтернеті ОФІЦІЙНУ сторінку закладу, який веде цей
дитячий гурток: власний сайт палацу, центру, студії, школи чи клубу, або
сторінку закладу на сайті міськради чи управління освіти. Не довідники
гуртків (gurtok.org, shkolyar.org.ua та подібні каталоги) і не соцмережі.

Гурток: {title}
Місто: {city}
Зі сторінки довідника (назва закладу, адреса): {excerpt}

Відповідай лише JSON без пояснень: {{"urls": ["https://..."]}} — до двох
адрес, найточніша перша. Не знайшов офіційної сторінки — {{"urls": []}}."""

JSON_URLS = re.compile(r'\{\s*"urls"\s*:\s*\[.*?\]\s*\}', re.S)


def parse_urls(text: str) -> list[str]:
    """Адреси з відповіді пошуку: лише http(s), без довідників і соцмереж."""
    m = JSON_URLS.search(text or "")
    if not m:
        return []
    try:
        urls = json.loads(m.group(0)).get("urls") or []
    except ValueError:
        return []
    return [u for u in urls if isinstance(u, str) and u.startswith(("http://", "https://"))
            and not NOT_ORGANIZER.search(u)][:MAX_ORGANIZER_PAGES]


def usage_of(resp) -> dict:
    """Токени й пошуки одного виклику — щоб ціну повного прогону рахувати, а не вгадувати."""
    try:
        u = resp.usage.model_dump()
    except Exception:
        return {}
    return {"in": u.get("input_tokens") or 0, "out": u.get("output_tokens") or 0,
            "searches": (u.get("server_tool_use") or {}).get("web_search_requests") or 0}


def search_organizer(ai, row: dict, directory_text: str) -> tuple[list[str], dict]:
    """(адреси офіційних сторінок, витрата виклику)."""
    excerpt = directory_text[:1200]
    prompt = SEARCH_PROMPT.format(title=row.get("title") or "",
                                  city=", ".join(row.get("cities") or []) or "—",
                                  excerpt=excerpt)
    try:
        resp = ai.messages.create(
            model=MODEL, max_tokens=1500,
            tools=[{"type": "web_search_20250305", "name": "web_search",
                    "max_uses": MAX_SEARCHES}],
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        logger.warning("пошук упав для %s: %s", row.get("title"), e)
        return [], {}
    text = "".join(b.text for b in resp.content if b.type == "text")
    return parse_urls(text), usage_of(resp)


def build_message(row: dict, source_text: str | None, source_state: str,
                  directory: bool, organizer: list[tuple[str, str | None, str]]) -> str:
    card = (f"НАЗВА: {row.get('title') or ''}\n"
            f"ОПИС: {row.get('summary') or ''}\n"
            f"МІСТО: {', '.join(row.get('cities') or []) or '—'}\n"
            f"ВІК: {row.get('age_from')}-{row.get('age_to')}\n"
            f"ВАРТІСТЬ: {row.get('cost_type')}")
    kind = "довідник (не підтвердження)" if directory else "сайт організатора"
    parts = [f"КАРТКА:\n{card}",
             f"ДЖЕРЕЛО ({kind}) {row.get('source_url')} — {source_state}:\n"
             f"{(source_text or '')[:PAGE_CHARS]}"]
    if directory:
        if not organizer:
            parts.append("САЙТ ОРГАНІЗАТОРА: на сторінці довідника посилання немає.")
        for url, text, state in organizer:
            parts.append(f"САЙТ ОРГАНІЗАТОРА {url} — {state}:\n{(text or '')[:PAGE_CHARS]}")
    return "\n\n---\n\n".join(parts)


def ask(ai, message: str) -> tuple[dict | None, dict]:
    import anthropic
    for attempt in range(3):
        try:
            resp = ai.messages.create(
                model=MODEL, max_tokens=700, system=SYSTEM, tools=[TOOL],
                tool_choice={"type": "tool", "name": "audit_club"},
                messages=[{"role": "user", "content": message}],
            )
            break
        except anthropic.APIStatusError as e:
            if e.status_code not in (429, 500, 502, 503, 529) or attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
        except (anthropic.APIConnectionError, anthropic.APITimeoutError):
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
    return next((b.input for b in resp.content if b.type == "tool_use"), None), usage_of(resp)


# Слова з назви, які нічого не кажуть про сам гурток: вони є на кожній
# сторінці будь-якого центру.
GENERIC = {"гурток", "гуртка", "гуртки", "студія", "студії", "клуб", "клубу", "секція",
           "школа", "школи", "центр", "центру", "курси", "курс", "заняття", "дитяча",
           "дитячий", "дітей", "дитини", "житомир", "житомирі", "харків", "київ",
           "років", "від", "для", "the", "club", "school", "kids"}


_APOS = str.maketrans({"'": "ʼ", "’": "ʼ"})


def names_activity(evidence: str, title: str) -> bool:
    """Цитата згадує сам гурток чи напрям, а не лише заклад.

    Пробний прогін 21.09.2026: «Зарубіжну літературу» «підтверджено» цитатою
    «Адреса: 10003 м. Житомир вул Троянівська 20» — це доказ, що є будинок,
    а не гурток. Досить спільного кореня хоча б одного змістовного слова
    назви: «інструменти» — «інструментів», «Шахи» — «шахи»."""
    ev = (evidence or "").lower().translate(_APOS)
    words = re.findall(r"[^\W\d_]+(?:ʼ[^\W\d_]+)?", (title or "").lower().translate(_APOS))
    stems = [w[:max(4, min(6, len(w) - 2))] for w in words if len(w) >= 4 and w not in GENERIC]
    return any(s in ev for s in stems)


def quoted(evidence: str, text: str) -> bool:
    """Цитата справді є на сторінці. Модель інколи пише власний висновок
    замість цитати — такий висновок не приймаємо (як у lifecycle.py)."""
    return bool(evidence) and evidence_in_text(evidence, text)


def build_patch(row: dict, ans: dict, evidence_text: str, today: str,
                hide_unverified: bool = False) -> tuple[str, dict, str]:
    """(підсумковий висновок, патч, рядок для звіту). Чиста функція — під тести.

    evidence_text — текст сторінок, яким можна підтвердити висновок: для
    довідника це лише сайт організатора, не сам довідник."""
    verdict = ans.get("verdict")
    reason = (ans.get("reason") or "").strip()
    evidence = (ans.get("evidence") or "").strip()
    mark = f"перевірка гуртків {today}"

    if verdict in ("confirmed", "gone", "not_children") and not quoted(evidence, evidence_text):
        verdict, reason = "unverified", f"{verdict} без цитати зі сторінки організатора: {reason}"
    elif verdict == "confirmed" and not names_activity(evidence, row.get("title")):
        verdict, reason = "unverified", f"цитата не називає гурток: {evidence[:120]}"

    if verdict == "gone":
        return verdict, {"status": "closed", "recheck_at": None,
                         "admin_comment": _trace(row, f"{mark}: не працює — {evidence}")}, reason
    if verdict == "not_children":
        return verdict, {"status": "draft",
                         "moderation_note": f"{mark}: лише для дорослих. {evidence}"[:1000]}, reason
    if verdict == "unverified":
        if not hide_unverified:
            return verdict, {}, reason
        return verdict, {"status": "draft",
                         "moderation_note": f"{mark}: не підтверджено сайтом організатора. {reason}"[:1000]}, reason

    patch = {"content_checked_at": datetime.now(timezone.utc).isoformat()}
    fixes = []
    af, at = ans.get("age_from"), ans.get("age_to")
    if (af is not None or at is not None) and quoted(ans.get("age_evidence") or "", evidence_text):
        new_from = af if isinstance(af, int) and 0 <= af <= 18 else row.get("age_from")
        new_to = at if isinstance(at, int) and 0 <= at <= 18 else row.get("age_to")
        if new_from is not None and new_to is not None and new_from <= new_to:
            if new_from != row.get("age_from"):
                patch["age_from"] = new_from
            if new_to != row.get("age_to"):
                patch["age_to"] = new_to
            if "age_from" in patch or "age_to" in patch:
                fixes.append(f"вік {row.get('age_from')}-{row.get('age_to')} → {new_from}-{new_to}")
    cost = ans.get("cost") or ""
    if cost and quoted(ans.get("cost_evidence") or "", evidence_text):
        current = row.get("cost_type")
        new = "free" if cost == "free" else (current if current in ("paid_affordable", "paid_premium")
                                              else "paid_affordable")
        if new != current:
            patch["cost_type"] = new
            fixes.append(f"вартість {current} → {new}")
    note = f"{mark}: підтверджено — {evidence}"
    if fixes:
        note += " · " + "; ".join(fixes)
    patch["admin_comment"] = _trace(row, note[:240])
    return verdict, patch, "; ".join(fixes) or reason


def _trace(row: dict, note: str) -> str:
    prev = (row.get("admin_comment") or "").strip()
    return (f"{prev} · {note}" if prev else note)[:500]


def load_rows(db, since: str | None) -> list[dict]:
    rows, off = [], 0
    while True:
        part = (db.table("opportunities").select(SELECT)
                .eq("status", "active").is_("canonical_slug", "null")
                .is_("verified_at", "null")
                .in_("opportunity_type", ["club", "course"])
                .eq("timing_kind", "permanent")
                .order("id").range(off, off + 999).execute().data or [])
        rows += part
        if len(part) < 1000:
            break
        off += 1000
    rows = [r for r in rows if bulk_domain(r.get("source"))]
    if since:
        # Уже підтверджені цим прогоном — не питаємо модель удруге.
        rows = [r for r in rows if not (r.get("content_checked_at") or "") >= since]
    return rows


def check_one(ai, row: dict, search: bool = True) -> dict:
    domain = bulk_domain(row.get("source"))
    directory = BULK_SOURCES[domain]
    url = (row.get("source_url") or "").strip()
    result = {"id": row["id"], "slug": row.get("slug"), "title": row.get("title"),
              "source": domain, "source_url": url, "cities": row.get("cities")}
    with httpx.Client(timeout=20, follow_redirects=True,
                      headers={"User-Agent": UA, "Accept-Language": "uk,en;q=0.8"}) as client:
        html, text, state = fetch(client, url) if url.startswith("http") else (None, None, "немає адреси")
        result["source_state"] = state
        organizer, result["usage"] = [], {}
        if directory and html:
            for link in organizer_links(html, url)[:MAX_ORGANIZER_PAGES]:
                _, otext, ostate = fetch(client, link)
                organizer.append((link, otext, ostate))
            # Сайту в довіднику немає або він мертвий — шукаємо заклад самі.
            if search and text and not any(t for _, t, _ in organizer):
                found, result["usage"] = search_organizer(ai, row, text)
                for link in found:
                    _, otext, ostate = fetch(client, link)
                    organizer.append((link, otext, f"{ostate}, знайдено пошуком"))
        result["organizer"] = [{"url": u, "state": s} for u, _, s in organizer]
    if not text:
        result.update(verdict="unverified", reason=f"сторінка джерела: {state}", ans=None)
        return result
    evidence_text = " ".join(t for _, t, _ in organizer if t) if directory else text
    ans, used = ask(ai, build_message(row, text, state, directory, organizer))
    result["usage"] = {k: result["usage"].get(k, 0) + v for k, v in used.items()}
    result.update(ans=ans, evidence_text=evidence_text)
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--source", default=None, help="лише одне джерело, напр. gurtok.org")
    ap.add_argument("--hide-unverified", action="store_true",
                    help="непідтверджені → draft (лише після рішення Марії)")
    ap.add_argument("--no-search", action="store_true",
                    help="не шукати сайт організатора вебпошуком")
    ap.add_argument("--report", default="audit_clubs_report.jsonl")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("Немає ANTHROPIC_API_KEY")
        return 1
    import api_guard
    from db import get_client

    db = get_client()
    ai = api_guard.client(api_key=os.environ["ANTHROPIC_API_KEY"])
    today = datetime.now(timezone.utc).date().isoformat()
    rows = load_rows(db, since=today)
    if args.source:
        rows = [r for r in rows if bulk_domain(r.get("source")) == args.source]
    if args.limit:
        rows = rows[:args.limit]
    logger.info("Гуртків до перевірки: %d (%s)", len(rows),
                ", ".join(f"{k}: {v}" for k, v in Counter(bulk_domain(r["source"]) for r in rows).most_common()))

    by_id = {r["id"]: r for r in rows}
    stats, fixes = Counter(), 0
    with ThreadPoolExecutor(WORKERS) as pool, open(args.report, "w", encoding="utf-8") as out:
        for res in pool.map(lambda r: check_one(ai, r, not args.no_search), rows):
            row = by_id[res["id"]]
            if res.get("ans"):
                verdict, patch, note = build_patch(row, res["ans"], res.pop("evidence_text", ""),
                                                   today, args.hide_unverified)
            else:
                verdict, patch, note = "unverified", {}, res["reason"]
                res.pop("evidence_text", None)
            stats[f"{res['source']}:{verdict}"] += 1
            stats[verdict] += 1
            for k, v in (res.get("usage") or {}).items():
                stats[f"usage_{k}"] += v
            if "age_from" in patch or "age_to" in patch or "cost_type" in patch:
                fixes += 1
            res.update(final=verdict, note=note,
                       patch={k: v for k, v in patch.items() if k != "admin_comment"})
            out.write(json.dumps(res, ensure_ascii=False) + "\n")
            logger.info("%-12s %-50s | %s", verdict, (row.get("title") or "")[:50], note[:120])
            if patch and not args.dry_run:
                db.table("opportunities").update(patch).eq("id", row["id"]).execute()

    logger.info("Готово%s. Підтверджено: %d (з них виправлено поля: %d) | не працює: %d | "
                "лише дорослим: %d | не підтверджено: %d",
                " (dry-run, нічого не записано)" if args.dry_run else "",
                stats["confirmed"], fixes, stats["gone"], stats["not_children"], stats["unverified"])
    # Haiku 4.5: $1 / $5 за мільйон токенів, вебпошук — $10 за тисячу.
    cost = stats["usage_in"] / 1e6 + stats["usage_out"] * 5 / 1e6 + stats["usage_searches"] * 0.01
    logger.info("Витрата: %d вхідних токенів, %d вихідних, %d вебпошуків ≈ $%.2f (≈ $%.3f на гурток)",
                stats["usage_in"], stats["usage_out"], stats["usage_searches"], cost,
                cost / max(1, len(rows)))
    for key in sorted(k for k in stats if ":" in k):
        logger.info("  %s: %d", key, stats[key])
    return 0


if __name__ == "__main__":
    sys.exit(main())
