"""Запрошення стати амбасадором після 3 місяців Dityam+ (Марія, 13.10.2026:
«можна додати вчителю і батькам питання якщо 3 місяці користуються дітям+ чи
бажають вони стати амбасадором»).

Кому: активна підписка, роль — мама/тато, опікун, вчитель або не вказана
(старі підписники — батьки). Підліткам — ні: амбасадори на сторінці — батьки й
педагоги. Від першої оплати Dityam+ минуло 90 днів. Один раз: дата в
digest_subscribers.ambassador_invited_at.

Текст — лише те, що обіцяє сторінка /ambasadory.
"""
from datetime import datetime, timedelta, timezone

INVITE_AFTER = timedelta(days=90)
ROLES = {None, "", "parent", "guardian", "teacher"}
URL = "https://dityam.com.ua/ambasadory"

TEXT = (
    "🧡 <b>Ви з Dityam+ уже 3 місяці — дякуємо!</b>\n\n"
    "Хочете стати амбасадором Dityam.com.ua? Амбасадори розповідають про можливості "
    "для дітей батькам, колегам і учням, допомагають додавати нові можливості на сайт "
    "і впливають на розвиток платформи.\n\n"
    "Амбасадори першими дізнаються про наші олімпіади й конкурси, отримують сертифікат "
    "і подяку, а Dityam+ для них безкоштовний."
)
KEYBOARD = {"inline_keyboard": [[{"text": "🤝 Стати амбасадором", "url": URL}]]}


def _ts(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def due(sub: dict, first_paid, now=None) -> bool:
    """Чи пора запросити цього підписника."""
    now = now or datetime.now(timezone.utc)
    if sub.get("status") != "active" or sub.get("ambassador_invited_at"):
        return False
    if sub.get("role") not in ROLES or not sub.get("telegram_chat_id"):
        return False
    return bool(first_paid) and now - first_paid >= INVITE_AFTER


def first_payments(client) -> dict:
    """chat_id → перша оплата Dityam+ (пробний місяць за 1 грн теж рахується)."""
    rows = (client.table("payments").select("telegram_chat_id, paid_at, product")
            .like("product", "plus_%").execute().data or [])
    out = {}
    for r in rows:
        chat, at = str(r.get("telegram_chat_id") or ""), _ts(r.get("paid_at"))
        if chat and at and (chat not in out or at < out[chat]):
            out[chat] = at
    return out


def run(client, subs, send, dry_run=False, logger=None, now=None) -> int:
    paid = first_payments(client)
    sent = 0
    for sub in subs:
        if not due(sub, paid.get(str(sub.get("telegram_chat_id"))), now):
            continue
        if dry_run:
            if logger:
                logger.info("ambassador invite (dry-run): %s", sub.get("id"))
            continue
        if send(sub["telegram_chat_id"], TEXT, KEYBOARD):
            at = datetime.now(timezone.utc).isoformat()
            client.table("digest_subscribers").update({"ambassador_invited_at": at}).eq("id", sub["id"]).execute()
            sent += 1
    return sent
