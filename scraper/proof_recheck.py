"""Чернетки, що чекають доказу: машина перечитує сторінку сама.

Світлофор (Марія, 22.09.2026): запис виходить на сайт лише з дослівною
цитатою зі сторінки на кожне обовʼязкове поле. Те, чому бракує лише цитати,
людина в щоденній черзі не бачить — «машина перечитає його, коли сторінка
зміниться». Ось цей перечит.

Чому окремий модуль. Стара переверифікація за TTL (ttl_requeue.run) вимкнена
17.09.2026: її замінила планова перевірка lifecycle.py. Але lifecycle працює
з активними й закритими записами й судить їх моделлю, а тут потрібне інше й
дешевше: витягнути сторінку і, якщо текст змінився, віддати її на повторну
екстракцію звичайним шляхом — через raw_items. Тому це не «ще один власник
дати», а частина нічного скрапу: він і так приносить сирий текст.

Вартість під контролем: не більше PROOF_LIMIT_PER_RUN сторінок за прогін,
і текст без змін у модель не йде взагалі.
"""
import logging
from datetime import datetime, timezone

import raw_store
from proof import missing_proof

logger = logging.getLogger(__name__)

# Скільки чернеток читаємо за прогін. Перевірені відсуваються в кінець черги
# (updated_at), тож за кілька ночей проходять усі.
PROOF_LIMIT_PER_RUN = 20
# Скільки тягнемо з бази, щоб було з чого відібрати: цитат бракує не всім.
FETCH_WINDOW = 400
FIELDS = "id, title, source, source_url, opportunity_type, evidence, updated_at"


def pick(rows, limit=PROOF_LIMIT_PER_RUN):
    """Кого читати цього разу. Чиста функція — під тести."""
    return [r for r in rows if missing_proof(r)][:limit]


def run(client, fetch_text) -> dict:
    """Один прохід. Ніколи не кидає виняток: нічний скрап не має падати через
    те, що одна сторінка не відповіла.

    fetch_text — чим тягнути сторінку (у прогоні це ttl_requeue._fetch_text).
    """
    stats = {"checked": 0, "requeued": 0}
    try:
        now = datetime.now(timezone.utc)
        rows = (
            client.table("opportunities")
            .select(FIELDS)
            .eq("status", "draft")
            .order("updated_at")
            .limit(FETCH_WINDOW)
            .execute()
            .data or []
        )
        waiting = pick(rows)
        if not waiting:
            return stats
        print(f"\n🔍 Чекають доказу: {len(waiting)} чернеток — читаю сторінки")
        for r in waiting:
            stats["checked"] += 1
            # Відсуваємо в кінець черги одразу: навіть якщо сторінка не
            # відповість, наступного разу підуть інші.
            client.table("opportunities").update(
                {"updated_at": now.isoformat()}
            ).eq("id", r["id"]).execute()
            url = r.get("source_url") or ""
            text = fetch_text(url) if url.startswith("http") else None
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
            stats["requeued"] += 1
        print(f"✅ Чекають доказу: {stats['requeued']} зі {stats['checked']} "
              f"пішли на повторну екстракцію (решта — сторінка без змін або недоступна)")
    except Exception as e:
        logger.error("proof_recheck failed: %s", e)
    return stats
