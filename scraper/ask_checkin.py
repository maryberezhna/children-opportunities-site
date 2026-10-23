"""ask_checkin.py — Dityam+: «Чи вдалося на щось подати заявку?»

Марія, 23.10.2026: «зроби так щоб дітям сам залежно від активності
користування питав у користувача фідбек чи вдалося на щось податися».

Чим відрізняється від ask_outcomes.py. Той питає «Ви подавалися?» про
конкретну можливість, яку людина позначила 👍 і яка вже минула. 22.10.2026
таких було 16, і жодна ще не минула — тобто людей ніхто нічого не питав.
Цей скрипт питає про досвід загалом, без конкретної можливості.

Як часто — залежить від активності (рішення 23.10.2026):
  • активні — хто за останні ACTIVE_DAYS днів сам щось робив у боті: 👍/👎
    під карткою чи постом, відповідь на «Ви подавалися?», відгук одним
    натиском. Перше питання через 5 днів після підписки, далі раз на 14;
  • тихі — без жодної дії. Перше теж через 5 днів, далі раз на 21: людину,
    яка мовчить, частіше не смикаємо.
  (Спершу було 14/30 і 21/45; Марія того ж дня: «треба частіше, перше за 5 днів».)
Не частіше одного повідомлення-питання на добу разом з ask_outcomes.py.

Відповідь лягає в plus_checkins (кнопки pchk:… обробляє
/api/telegram/plus). Тексти кнопок — ті самі, що в lib/plusCheckins.js;
тест tests/plus-checkin.test.mjs звіряє їх.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_PLUS_BOT_TOKEN.

Прапорці:
  --dry-run   нічого не шле й не пише — лише друкує, кому що пішло б
  --any-time  ігнорувати ворота часу (див. send_window.py)
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

import send_window
from personal_digest import send_telegram

logger = logging.getLogger("ask_checkin")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

ACTIVE_DAYS = 30
# Марія, 23.10.2026: «треба частіше, перше за 5 днів».
FIRST_AFTER = {"active": 5, "quiet": 5}
EVERY = {"active": 14, "quiet": 21}
ONE_PER_HOURS = 24

QUESTION = ("Як ваші успіхи? 🙂\n\n"
            "Чи вдалося за останній час подати заявку на щось із того, що ми надсилали?")
ANSWERS = [
    ("applied", "✅ Так, подали"),
    ("preparing", "⏳ Ще ні, готуємось"),
    ("nothing_fit", "🤷 Не знайшли підходящого"),
    ("not_looked", "😴 Ще не дивились"),
]


def keyboard(checkin_id: str) -> dict:
    btn = [{"text": label, "callback_data": f"pchk:{code}:{checkin_id}"} for code, label in ANSWERS]
    return {"inline_keyboard": [btn[:2], btn[2:]]}


def parse_ts(value):
    if not value:
        return None
    text = str(value).strip().replace(" ", "T")
    if text.endswith("+00"):
        text = text[:-3] + "+00:00"
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def kind_of(actions: list, now: datetime) -> str:
    """'active', якщо людина сама щось робила за ACTIVE_DAYS днів, інакше 'quiet'."""
    edge = now - timedelta(days=ACTIVE_DAYS)
    return "active" if any((t := parse_ts(a)) and t >= edge for a in actions) else "quiet"


def due(sub: dict, kind: str, checkins: list, other_asked: list, now: datetime) -> bool:
    """Чи час питати цю людину зараз.

    checkins — її рядки plus_checkins, other_asked — asked_at з plus_applications
    (питання «Ви подавалися?»)."""
    edge = now - timedelta(hours=ONE_PER_HOURS)
    recent = [parse_ts(c.get("asked_at")) for c in checkins] + [parse_ts(a) for a in other_asked]
    if any(t and t >= edge for t in recent):
        return False
    last = max((t for t in (parse_ts(c.get("asked_at")) for c in checkins) if t), default=None)
    if last:
        return now - last >= timedelta(days=EVERY[kind])
    start = parse_ts(sub.get("consent_at")) or parse_ts(sub.get("created_at"))
    return bool(start) and now - start >= timedelta(days=FIRST_AFTER[kind])


def _by(rows: list, key: str) -> dict:
    out: dict = {}
    for r in rows:
        if r.get(key) is not None:
            out.setdefault(str(r[key]), []).append(r)
    return out


def _chunks(items: list, n: int = 200):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--any-time", action="store_true")
    args = ap.parse_args()

    if not (args.dry_run or args.any_time) and send_window.too_early():
        return 0

    from db import get_client
    client = get_client()

    subs = (client.table("digest_subscribers")
            .select("id, telegram_chat_id, status, created_at, consent_at")
            .eq("status", "active").execute().data or [])
    subs = [s for s in subs if s.get("telegram_chat_id")]
    logger.info("Активних підписників із Telegram: %d", len(subs))
    if not subs:
        return 0

    ids = [s["id"] for s in subs]
    chats = [str(s["telegram_chat_id"]) for s in subs]
    apps, checkins, ofb, pfb = [], [], [], []
    for part in _chunks(ids):
        apps += client.table("plus_applications").select("*").in_("subscriber_id", part).execute().data or []
        checkins += (client.table("plus_checkins").select("id, subscriber_id, asked_at, answer")
                     .in_("subscriber_id", part).execute().data or [])
    for part in _chunks(chats):
        ofb += (client.table("opportunity_feedback").select("telegram_user_id, created_at, updated_at")
                .in_("telegram_user_id", part).execute().data or [])
        pfb += (client.table("product_feedback").select("telegram_chat_id, created_at, updated_at")
                .in_("telegram_chat_id", part).execute().data or [])
    apps_by, chk_by = _by(apps, "subscriber_id"), _by(checkins, "subscriber_id")
    ofb_by, pfb_by = _by(ofb, "telegram_user_id"), _by(pfb, "telegram_chat_id")

    now = datetime.now(timezone.utc)
    asked = {"active": 0, "quiet": 0}
    for sub in subs:
        sid, chat = str(sub["id"]), str(sub["telegram_chat_id"])
        my_apps = apps_by.get(sid, [])
        # Дії самої людини. asked_at — наш слід, тож не рахується.
        actions = ([r.get("updated_at") or r.get("created_at") for r in ofb_by.get(chat, [])]
                   + [r.get("updated_at") or r.get("created_at") for r in pfb_by.get(chat, [])]
                   + [r.get("answered_at") for r in my_apps]
                   + [r.get("updated_at") for r in my_apps if r.get("stage") in ("interested", "applying")]
                   + [c.get("asked_at") for c in chk_by.get(sid, []) if c.get("answer")])
        kind = kind_of(actions, now)
        if not due(sub, kind, chk_by.get(sid, []), [r.get("asked_at") for r in my_apps], now):
            continue
        if args.dry_run:
            logger.info("[dry] sub=%s → питання (%s)", sid, kind)
            asked[kind] += 1
            continue
        try:
            row = (client.table("plus_checkins").insert({"subscriber_id": sid, "kind": kind})
                   .execute().data or [None])[0]
        except Exception as e:
            logger.warning("plus_checkins insert %s failed: %s", sid, e)
            continue
        if not row:
            continue
        if not send_telegram(chat, QUESTION, reply_markup=keyboard(row["id"])):
            # Не дійшло — рядок прибираємо, щоб наступного дня спробувати знову.
            client.table("plus_checkins").delete().eq("id", row["id"]).execute()
            continue
        asked[kind] += 1

    logger.info("Done. Питань надіслано: активним %d, тихим %d", asked["active"], asked["quiet"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
