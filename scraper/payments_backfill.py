"""payments_backfill.py — разово переносить успішні оплати з WayForPay у таблицю payments.

Марія, 08.10.2026: «своя сторінка в адмінці — хто і скільки разів купував».
Журнал оплат сайт веде з 08.10.2026 (lib/payments.js); усе, що було раніше,
лежить лише в кабінеті WayForPay. Скрипт питає WayForPay TRANSACTION_LIST
вікнами по 30 днів і записує кожну успішну оплату тим самим ключем, що й
колбек (`номер замовлення|processingDate`), тож повторний запуск нічого не
задвоює, а оплату, яку вже записав колбек, не дублює.

Без --write нічого не пише — лише показує, що знайшов.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY.
"""
import argparse
import hashlib
import hmac
import logging
import os
import sys
import time
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("payments_backfill")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MERCHANT = os.environ.get("WAYFORPAY_MERCHANT_ACCOUNT", "")
SECRET = os.environ.get("WAYFORPAY_SECRET_KEY", "")
# Перші оплати Dityam+ — 24.09.2026; беремо із запасом.
START = datetime(2026, 9, 1, tzinfo=timezone.utc)
WINDOW = 30 * 24 * 3600


def product_of(ref: str, amount: float, half_price: float = 549) -> str:
    """Те саме, що productOf у lib/payments.js."""
    if ref.startswith("olimp-d-"):
        return "olimp_print"
    if ref.startswith("olimp-"):
        return "olimp_entry"
    parts = ref.split("-")
    tail = parts[2] if len(parts) > 2 else ""
    period = {"h": "halfyear", "y": "yearly", "m": "monthly"}.get(tail)
    if not period:
        period = "halfyear" if float(amount) >= half_price else "monthly"
    return f"plus_{period}"


def olimp_token(ref: str):
    parts = ref.split("-")
    if not ref.startswith("olimp-"):
        return None
    return parts[2] if ref.startswith("olimp-d-") else parts[1]


def approved(tx: dict) -> bool:
    """Лише успішні оплати; повернення (REFUND) і відмови — ні."""
    return tx.get("transactionStatus") == "Approved" and str(tx.get("transactionType") or "").upper() != "REFUND"


def tx_row(tx: dict, sub=None, entry=None) -> dict:
    ref = str(tx["orderReference"])
    processed = tx.get("processingDate") or tx.get("createdDate")
    paid_at = datetime.fromtimestamp(int(processed), tz=timezone.utc).isoformat() if processed else None
    row = {
        "tx_key": f"{ref}|{processed}",
        "order_reference": ref,
        "product": product_of(ref, tx.get("amount") or 0),
        "amount": float(tx.get("amount") or 0),
        "currency": tx.get("currency") or "UAH",
        "paid_at": paid_at,
        "email": (tx.get("email") or None),
        "source": "backfill",
    }
    if sub:
        row.update({
            "telegram_chat_id": str(sub["telegram_chat_id"]) if sub.get("telegram_chat_id") else None,
            "telegram_handle": sub.get("telegram_handle"),
            "subscriber_id": sub.get("id"),
        })
    if entry:
        row.update({"email": entry.get("parent_email") or row["email"], "name": entry.get("child_name"),
                    "olimp_token": entry.get("token")})
    return row


def fetch_window(begin: int, end: int) -> list:
    sig = hmac.new(SECRET.encode(), f"{MERCHANT};{begin};{end}".encode(), hashlib.md5).hexdigest()
    r = httpx.post("https://api.wayforpay.com/api", json={
        "transactionType": "TRANSACTION_LIST", "merchantAccount": MERCHANT,
        "merchantSignature": sig, "apiVersion": 1, "dateBegin": begin, "dateEnd": end,
    }, timeout=60)
    j = r.json()
    if "transactionList" not in j:
        raise RuntimeError(f"WayForPay: {j.get('reasonCode')} {j.get('reason')}")
    return j["transactionList"] or []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="записати в базу; без прапорця — лише показати")
    args = ap.parse_args()
    if not MERCHANT or not SECRET:
        logger.error("Немає WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY")
        return 1

    txs = []
    now = int(time.time())
    begin = int(START.timestamp())
    while begin < now:
        end = min(begin + WINDOW, now)
        txs.extend(fetch_window(begin, end))
        begin = end + 1
    ok = [t for t in txs if approved(t)]
    logger.info("Транзакцій у WayForPay: %d, успішних: %d", len(txs), len(ok))

    from db import get_client
    client = get_client()
    subs = client.table("digest_subscribers").select("id, unsub_token, telegram_chat_id, telegram_handle") \
        .limit(5000).execute().data or []
    by_token = {s["unsub_token"]: s for s in subs if s.get("unsub_token")}
    entries = client.table("olimpiada_entries").select("token, parent_email, child_name").limit(5000).execute().data or []
    by_entry = {e["token"]: e for e in entries}

    rows = []
    for t in ok:
        ref = str(t["orderReference"])
        tok = olimp_token(ref)
        rows.append(tx_row(t, sub=None if tok else by_token.get(ref.split("-")[0]), entry=by_entry.get(tok) if tok else None))
    for r in rows:
        logger.info("%s · %s · %s грн · %s", r["paid_at"], r["product"], r["amount"],
                    r.get("telegram_handle") or r.get("telegram_chat_id") or "—")

    if not args.write:
        logger.info("[dry] Нічого не записано. Щоб записати — confirm = WRITE.")
        return 0
    if rows:
        client.table("payments").upsert(rows, on_conflict="tx_key", ignore_duplicates=True).execute()
    logger.info("Записано (без дублів): %d", len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
