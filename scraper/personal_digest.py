"""personal_digest.py — Dityam+ персональна підбірка раз на 2 тижні.

Для кожного активного платного підписника (`digest_subscribers`) добирає активні
можливості під його профіль (вік-діапазон × інтереси × вартість) і шле підбірку в
його канал — Telegram або email. Персоналізація, НЕ ексклюзив: можливості завжди
лишаються в каталозі для всіх; підписник купує підібраний під дитину пуш.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN,
     GMAIL_FROM, GMAIL_APP_PASSWORD, SITE_URL (optional).

Прапорці:
  --dry-run   нічого не шле й не оновлює last_sent_at — лише друкує, кому що пішло б
  --force     ігнорує вікно «14 днів» (слати всім активним зараз)
  --demo      синтетичний підписник — прев'ю матчингу без доступу до таблиці підписників
"""
import argparse
import html
import logging
import os
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger("personal_digest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SITE_URL = os.environ.get("SITE_URL", "https://dityam.com.ua")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GMAIL_FROM = os.environ.get("GMAIL_FROM", "mashaberezhna0209@gmail.com")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
MAX_ITEMS = 8             # максимум можливостей в одному сповіщенні

# --- 12 канонічних тем (у синхроні з lib/themes.js / keywords.py) ---
THEME_CATEGORIES = {
    "format": ["гурток", "гуртк", "студія", "студії", "секці", "курс", "майстер-клас", "воркшоп", "інтенсив", "буткемп", "факультатив", "спецкурс", "майстерн", "дитяча академія", "розвивальні заняття", "ранній розвиток", "підготовка до школи"],
    "stem": ["stem", "steam", "робототехн", "програмуванн", "coding", "scratch", "python", "дитяче it", "юний технік", "винахідник", "наука для дітей", "науковий гурток", "астроном", "біотех", "дрон", "інженер"],
    "arts": ["арт-студія", "малюванн", "живопис", "керамік", "гончар", "музична школа", "вокал", "хоровий", "театр", "акторськ", "танц", "хореограф", "дизайн", "анімаці", "мультипліка", "фотошкол", "фотограф", "креативн", "мистецьк"],
    "sport": ["спортивна секці", "спортивна школа", "дюсш", "плаванн", "гімнастик", "єдиноборств", "скелелазінн", "фізична активн", "адаптивн спорт", "інклюзивний спорт", "футбол", "баскетбол", "шахи"],
    "languages": ["мовна школа", "англійськ", "розмовний клуб", "language club", "білінгвальн", "cambridge", "ielts", "друга іноземна", "мовний табір", "німецьк", "французьк", "іспанськ"],
    "soft_skills": ["soft skills", "лідерств", "публічні виступи", "ораторськ", "дебати", "критичне мисленн", "емоційний інтелект", "тайм-менеджмент", "фінансова грамотн", "особистісний розвиток"],
    "contests": ["олімпіад", "конкурс", "турнір", "змаганн", "хакатон", "челендж", "вікторин", "кастинг", "open call", "конкурс проєктів", "конкурс есе", "конкурс малюнків"],
    "camps": ["табір", "табор", "stem-camp", "кемп", " camp", "літня школа", "зимова школа", "виїзний інтенсив", "оздоровленн"],
    "career": ["профорієнтац", "career", "стажуванн", "internship", "job shadowing", "підприємництв", "стартап", "акселератор", "менторств", "наставництв", "mentorship"],
    "international": ["exchange", "обмін", "flex", "erasmus", "uwc", "issos", "summer school", "scholarship", "стипенді", "youth program", "international", "mobility", "upshift", "за кордон"],
    "online": ["онлайн-курс", "онлайн-школа", "онлайн курс", "вебінар", "дистанційн", "освітня платформа", "self-paced", "безкоштовний онлайн"],
    "nonformal": ["позашкільн", "неформальна освіта", "додаткова освіта", "проєктне навчання", "освітній хаб", "дитячий простір"],
}
THEME_LABEL = {"format": "Гуртки/курси", "stem": "STEM/IT", "arts": "Творчість", "sport": "Спорт", "languages": "Мови", "soft_skills": "Soft skills", "contests": "Конкурси/олімпіади", "camps": "Табори", "career": "Кар'єра", "international": "Міжнародні", "online": "Онлайн", "nonformal": "Позашкілля"}
AGE_BANDS = {"0-3": (0, 3), "4-6": (4, 6), "7-10": (7, 10), "11-14": (11, 14), "15-18": (15, 18)}


def match_themes(text: str) -> set:
    low = (text or "").lower()
    return {k for k, kws in THEME_CATEGORIES.items() if any(kw in low for kw in kws)}


def age_overlaps(a_from, a_to, bands) -> bool:
    if not bands:
        return True
    for b in bands:
        r = AGE_BANDS.get(b)
        if r and a_from <= r[1] and a_to >= r[0]:
            return True
    return False


def parse_ts(s):
    if not s:
        return None
    s = str(s).strip().replace(" ", "T")
    if s.endswith("+00"):
        s = s[:-3] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def pick_for(sub: dict, opps: list, since=None) -> list:
    """Можливості під профіль. since (datetime) — брати лише новіші за цей момент."""
    interests = set(sub.get("interests") or [])
    bands = sub.get("age_bands") or []
    free_only = sub.get("cost_pref") == "free_only"
    out = []
    for o in opps:
        if since and (o["_created"] is None or o["_created"] <= since):
            continue
        if free_only and o.get("cost_type") != "free":
            continue
        if not age_overlaps(o["age_from"], o["age_to"], bands):
            continue
        if interests and not (interests & o["_themes"]):
            continue
        out.append(o)
    out.sort(key=lambda o: o.get("created_at") or "", reverse=True)
    return out[:MAX_ITEMS]


def _meta(o) -> str:
    bits = [THEME_LABEL.get(next(iter(o["_themes"]), ""), "") or "Можливість"]
    bits.append(f"{o['age_from']}–{o['age_to']} р.")
    if o.get("cost_type") == "free":
        bits.append("безкоштовно")
    return " · ".join(b for b in bits if b)


def build_telegram(sub, items) -> str:
    lines = ["🧡 <b>Нові можливості для твоєї дитини</b>", ""]
    for o in items:
        url = f"{SITE_URL}/o/{o['slug']}"
        lines.append(f"🔸 <a href=\"{html.escape(url)}\"><b>{html.escape(o['title'])}</b></a>")
        lines.append(html.escape(_meta(o)))
        lines.append("")
    lines.append("<i>Це доповнення — усі можливості завжди доступні безкоштовно на сайті.</i>")
    lines.append("Відписатись — /stop")
    return "\n".join(lines)


def build_email(sub, items) -> str:
    rows = []
    for o in items:
        url = f"{SITE_URL}/o/{o['slug']}"
        rows.append(
            f'<tr><td style="padding:14px 0;border-bottom:1px solid #eee">'
            f'<a href="{html.escape(url)}" style="color:#131b28;font-size:16px;font-weight:700;text-decoration:none">{html.escape(o["title"])}</a>'
            f'<div style="color:#54617a;font-size:13px;margin-top:4px">{html.escape(_meta(o))}</div></td></tr>'
        )
    unsub = f"{SITE_URL}/api/unsubscribe?t={sub['unsub_token']}"
    return (
        f'<div style="max-width:560px;margin:0 auto;font-family:system-ui,Arial,sans-serif;color:#131b28">'
        f'<div style="font-size:12px;color:#db5a1e;font-weight:700;letter-spacing:.04em">DITYAM+</div>'
        f'<h1 style="font-size:22px;margin:6px 0 4px">Нові можливості для вашої дитини</h1>'
        f'<p style="color:#54617a;font-size:14px;margin:0 0 8px">Підібрано під вік та інтереси дитини.</p>'
        f'<table style="width:100%;border-collapse:collapse">{"".join(rows)}</table>'
        f'<p style="color:#8a94a6;font-size:12px;margin-top:20px">Усі можливості завжди безкоштовні на <a href="{SITE_URL}" style="color:#1e4fd6">dityam.com.ua</a>. '
        f'<a href="{html.escape(unsub)}" style="color:#8a94a6">Відписатись</a>.</p></div>'
    )


def send_telegram(chat_id, text) -> bool:
    if not BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set")
        return False
    r = httpx.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", json={
        "chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True,
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("ok")
    if not ok:
        logger.warning("TG send failed for %s: %s", chat_id, r.text[:200])
    return bool(ok)


def send_email(to_addr, html_body) -> bool:
    if not GMAIL_APP_PASSWORD:
        logger.warning("GMAIL_APP_PASSWORD not set")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🧡 Нові можливості для вашої дитини — Dityam+"
    msg["From"] = f"Dityam.com.ua <{GMAIL_FROM}>"
    msg["To"] = to_addr
    msg.attach(MIMEText("Відкрий лист у HTML, щоб побачити підбірку. dityam.com.ua", "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_FROM, GMAIL_APP_PASSWORD)
            smtp.sendmail(GMAIL_FROM, [to_addr], msg.as_string())
        return True
    except Exception as e:
        logger.warning("Email send failed for %s: %s", to_addr, e)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    from db import get_client
    client = get_client()

    opps = client.table("opportunities").select(
        "id, title, summary, slug, age_from, age_to, cost_type, created_at"
    ).eq("status", "active").execute().data or []
    for o in opps:
        o["_themes"] = match_themes(f"{o['title']} {o.get('summary') or ''}")
        o["_created"] = parse_ts(o.get("created_at"))
    logger.info("Loaded %d active opportunities", len(opps))

    if args.demo:
        subs = [{
            "id": "demo", "channel": "telegram", "telegram_chat_id": None,
            "email": None, "unsub_token": "demo",
            "age_bands": ["7-10", "11-14"], "interests": ["stem", "arts", "contests"],
            "cost_pref": "free_only", "last_sent_at": None,
        }]
    else:
        subs = client.table("digest_subscribers").select("*").eq("status", "active").execute().data or []
    logger.info("Active subscribers: %d", len(subs))

    sent = 0
    for sub in subs:
        # Шлемо лише можливості, що зʼявились після останнього сповіщення.
        # --force / --demo ігнорують новизну (для тесту).
        since = None if (args.force or args.demo) else parse_ts(sub.get("last_sent_at"))
        items = pick_for(sub, opps, since)
        if not items:
            logger.info("sub %s — no new matching opportunities, skip", sub["id"])
            continue

        if args.dry_run or args.demo:
            titles = " | ".join(i["title"][:48] for i in items)
            logger.info("[dry] sub=%s ch=%s → %d items: %s", sub["id"], sub["channel"], len(items), titles)
            continue

        ok = False
        if sub["channel"] == "telegram" and sub.get("telegram_chat_id"):
            ok = send_telegram(sub["telegram_chat_id"], build_telegram(sub, items))
        elif sub["channel"] == "email" and sub.get("email"):
            ok = send_email(sub["email"], build_email(sub, items))
        else:
            logger.info("sub %s — channel not connected yet, skip", sub["id"])
            continue

        if ok:
            client.table("digest_subscribers").update(
                {"last_sent_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", sub["id"]).execute()
            sent += 1

    logger.info("Done. Digests sent: %d", sent)


if __name__ == "__main__":
    sys.exit(main())
