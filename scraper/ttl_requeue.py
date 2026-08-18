"""TTL-переверифікація записів без дедлайну (Фаза 4).

85% активних записів не мають дедлайну — автоархівація по даті їх ніколи не
торкнеться, і вони висіли б вічно. Правило: запис, що давно не оновлювався,
відправляється на ПОВТОРНУ ЕКСТРАКЦІЮ, а не видаляється:

  • сторінку тягнемо свіжою → текст у raw_items → нічна екстракція з
    enrollment_status вирішує: набір відкритий (запис живе, TTL скинувся)
    чи «реєстрацію завершено» (запис закривається автоматично);
  • текст не змінився з минулого разу (той самий content_hash) — минулий
    висновок екстрактора досі чинний, просто скидаємо TTL (updated_at);
  • сторінка не відповідає — нічого не робимо: мертві лінки добиває
    щоденний verify-links своєю стан-машиною.

Ліміт на запуск тримає вартість передбачуваною; найстаріші — перші.
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup

import raw_store

logger = logging.getLogger(__name__)

# Скільки днів запис без дедлайну живе без підтвердження, за типом.
TTL_DAYS = {
    "competition": 60, "olympiad": 60, "hackathon": 60, "camp": 60,
    "exchange": 90, "grant": 90, "scholarship": 90, "course": 90,
    "festival": 60, "workshop": 90,
    "club": 120, "educational_material": 120,
}
DEFAULT_TTL = 120
LIMIT_PER_RUN = 20
# Сезонні перевірки закритих подій (recheck_at, ставить check-deadlines при
# закритті фестивалю/табору: closed + 11 місяців — подивитися, чи не
# з'явилась нова річна програма).
SEASONAL_LIMIT_PER_RUN = 10
UA = "Mozilla/5.0 (compatible; DityamTTLCheck/1.0; +https://dityam.com.ua)"


def _fetch_text(url: str) -> str | None:
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
        return text[:8000] if text else None
    except Exception:
        return None


def run(client) -> dict:
    """Один прохід TTL. Ніколи не кидає виняток."""
    stats = {"checked": 0, "requeued": 0, "refreshed": 0, "skipped": 0,
             "seasonal_checked": 0, "seasonal_requeued": 0}
    try:
        now = datetime.now(timezone.utc)
        rows = (
            client.table("opportunities")
            .select("id, title, source, source_url, opportunity_type, updated_at")
            .eq("status", "active")
            .is_("deadline", "null")
            .order("updated_at")
            .limit(120)
            .execute()
            .data or []
        )
        due = []
        for r in rows:
            ttl = TTL_DAYS.get(r.get("opportunity_type"), DEFAULT_TTL)
            updated = r.get("updated_at") or ""
            try:
                age = now - datetime.fromisoformat(updated.replace("Z", "+00:00"))
            except ValueError:
                continue
            if age > timedelta(days=ttl) and (r.get("source_url") or "").startswith("http"):
                due.append(r)
            if len(due) >= LIMIT_PER_RUN:
                break
        if due:
            print(f"\n{'=' * 70}\n⏳ TTL: {len(due)} записів без дедлайну на переверифікацію\n{'=' * 70}")
            for r in due:
                stats["checked"] += 1
                text = _fetch_text(r["source_url"])
                if not text:
                    stats["skipped"] += 1  # мертвий/недоступний — справа verify-links
                    continue
                content_hash = raw_store.raw_hash(r["source_url"], text)
                existing = (
                    client.table("raw_items").select("id")
                    .eq("content_hash", content_hash).limit(1).execute().data
                )
                if existing:
                    # Сторінка не змінилась — минулий висновок чинний, TTL скидаємо.
                    client.table("opportunities").update(
                        {"updated_at": now.isoformat()}
                    ).eq("id", r["id"]).execute()
                    stats["refreshed"] += 1
                else:
                    raw_store.store_raw_items(client, r.get("source") or "ttl-recheck", [{
                        "source": r.get("source") or "ttl-recheck",
                        "source_url": r["source_url"],
                        "raw_title": r.get("title"),
                        "raw_text": text,
                    }])
                    stats["requeued"] += 1
            print(f"✅ TTL: {stats['requeued']} у чергу на переекстракцію, "
                  f"{stats['refreshed']} підтверджено без змін, "
                  f"{stats['skipped']} недоступні (лишаються verify-links)")

        # --- Сезонні перевірки: закриті події, яким настав recheck_at ---
        # Одна спроба на сезон: recheck_at знімаємо одразу, щоб не зациклитись.
        # Якщо сторінка змінилась — переекстракція вирішить долю запису
        # (нова річна програма з відкритим набором оживить його в normalizer).
        seasonal = (
            client.table("opportunities")
            .select("id, title, source, source_url, recheck_at")
            .eq("status", "closed")
            .lte("recheck_at", now.date().isoformat())
            .order("recheck_at")
            .limit(SEASONAL_LIMIT_PER_RUN)
            .execute()
            .data or []
        )
        if seasonal:
            print(f"\n⏰ Сезонні перевірки: {len(seasonal)} закритих подій (recheck_at настав)")
            for r in seasonal:
                stats["seasonal_checked"] += 1
                client.table("opportunities").update(
                    {"recheck_at": None}
                ).eq("id", r["id"]).execute()
                url = r.get("source_url") or ""
                text = _fetch_text(url) if url.startswith("http") else None
                if not text:
                    continue  # сторінка мертва — подія лишається closed
                content_hash = raw_store.raw_hash(url, text)
                if (client.table("raw_items").select("id")
                        .eq("content_hash", content_hash).limit(1).execute().data):
                    continue  # сторінка як була — нового сезону немає
                raw_store.store_raw_items(client, r.get("source") or "seasonal-recheck", [{
                    "source": r.get("source") or "seasonal-recheck",
                    "source_url": url,
                    "raw_title": r.get("title"),
                    "raw_text": text,
                }])
                stats["seasonal_requeued"] += 1
            print(f"✅ Сезонні: {stats['seasonal_requeued']} з {stats['seasonal_checked']} "
                  f"пішли на переекстракцію (решта без змін або недоступні)")
    except Exception as e:
        logger.error("ttl_requeue failed: %s", e)
    return stats
