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
import time
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup

import raw_store
from proof import missing_proof

logger = logging.getLogger(__name__)

# Скільки днів запис без дедлайну живе без підтвердження, за типом.
TTL_DAYS = {
    "competition": 60, "olympiad": 60, "hackathon": 60, "camp": 60,
    "exchange": 90, "grant": 90, "scholarship": 90, "course": 90,
    "festival": 60, "workshop": 90,
    "club": 120, "educational_material": 120,
}
DEFAULT_TTL = 120

# Джерела-агрегатори тримаємо на коротшому повідку. Гурток не має дедлайну,
# тож дата його не закриє ніколи — єдине, що відрізняє живий запис від
# мертвого, це оця переперевірка. А в чужому переліку гурток може зникнути,
# змінити ціну чи адресу, і сам перелік нам про це не скаже.
# Переперевірка тут майже безкоштовна: сторінки цих трьох сайтів віддають
# стабільний текст, тож хеш збігається і повторна екстракція не запускається.
AGGREGATOR_SOURCES = {
    "Гурток (gurtok.org)",
    "Школяр (shkolyar.org.ua)",
    "ЦПР Святошинського району (cprs.kiev.ua)",
}
AGGREGATOR_TTL_DAYS = 45

# Пропускна здатність. Записів без дедлайну після додавання переліків гуртків
# стане близько 1 100. За 20 на ніч повний круг тривав би 55 ночей — тобто
# запис міг бути неправдою півтора місяця навіть за коротким TTL. За 60 на
# ніч круг займає ~19 ночей і TTL нарешті означає те, що написано.
LIMIT_PER_RUN = 60
# Вікно вибірки має бути помітно більшим за ліміт: із нього ще відсіюються
# ті, кому TTL не настав.
FETCH_WINDOW = 400
# Після імпорту в тисячі записів однакова дата оновлення, тож ніч легко
# може виявитись шістдесятьма запитами поспіль до одного сайту.
DELAY_BETWEEN_CHECKS = 0.5
# Сезонні перевірки закритих подій (recheck_at, ставить check-deadlines при
# закритті фестивалю/табору: closed + 11 місяців — подивитися, чи не
# з'явилась нова річна програма).
SEASONAL_LIMIT_PER_RUN = 10

# Чернетки, яким бракує лише цитати зі сторінки («чекає доказу», 22.09.2026).
# Людина їх не бачить: у черзі лежить те, де потрібне ЇЇ рішення, а тут —
# те, що машина може дочекатись сама. Перечитуємо сторінку; текст той самий —
# нових цитат на ньому не буде, просто відсуваємо в кінець черги, змінився —
# віддаємо на повторну екстракцію, і запис може стати зеленим без людини.
PROOF_LIMIT_PER_RUN = 20
# Поля, яких вистачає, щоб порахувати, чого бракує (proof.missing_proof).
PROOF_FIELDS = "id, title, source, source_url, opportunity_type, evidence, updated_at"

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
             "seasonal_checked": 0, "seasonal_requeued": 0,
             "proof_checked": 0, "proof_requeued": 0}
    try:
        now = datetime.now(timezone.utc)
        rows = (
            client.table("opportunities")
            .select("id, title, source, source_url, opportunity_type, updated_at")
            .eq("status", "active")
            .is_("deadline", "null")
            .order("updated_at")
            .limit(FETCH_WINDOW)
            .execute()
            .data or []
        )
        due = []
        for r in rows:
            if r.get("source") in AGGREGATOR_SOURCES:
                ttl = AGGREGATOR_TTL_DAYS
            else:
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
                if stats["checked"] > 1:
                    time.sleep(DELAY_BETWEEN_CHECKS)
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
        # --- Чекають доказу: чернетки без цитати на обовʼязкове поле ---
        # Найдавніше перевірені — перші; після перевірки запис відсувається в
        # кінець черги (updated_at), тож за кілька прогонів проходять усі.
        waiting = [
            r for r in (
                client.table("opportunities")
                .select(PROOF_FIELDS)
                .eq("status", "draft")
                .order("updated_at")
                .limit(FETCH_WINDOW)
                .execute()
                .data or []
            )
            if missing_proof(r)
        ][:PROOF_LIMIT_PER_RUN]
        if waiting:
            print(f"\n🔍 Чекають доказу: {len(waiting)} чернеток — читаю сторінки")
            for r in waiting:
                stats["proof_checked"] += 1
                # Відсуваємо в кінець черги одразу: навіть якщо сторінка не
                # відповість, наступного разу підуть інші.
                client.table("opportunities").update(
                    {"updated_at": now.isoformat()}
                ).eq("id", r["id"]).execute()
                url = r.get("source_url") or ""
                text = _fetch_text(url) if url.startswith("http") else None
                if not text:
                    continue
                content_hash = raw_store.raw_hash(url, text)
                if (client.table("raw_items").select("id")
                        .eq("content_hash", content_hash).limit(1).execute().data):
                    continue  # текст той самий — нових цитат на ньому не буде
                raw_store.store_raw_items(client, r.get("source") or "proof-recheck", [{
                    "source": r.get("source") or "proof-recheck",
                    "source_url": url,
                    "raw_title": r.get("title"),
                    "raw_text": text,
                }])
                stats["proof_requeued"] += 1
            print(f"✅ Чекають доказу: {stats['proof_requeued']} зі {stats['proof_checked']} "
                  f"пішли на повторну екстракцію (решта — сторінка без змін або недоступна)")
    except Exception as e:
        logger.error("ttl_requeue failed: %s", e)
    return stats
