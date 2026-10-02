"""Записи, що чекають доказу: машина перечитує сторінку сама.

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

Що змінилось 02.10.2026. Перечит брав лише чернетки — а без цитат стояло 476
із 612 записів, які вже НА САЙТІ, з них 92 без жодної. Запис без цитати на
сайті виглядає так само впевнено, як перевірений, тож черга має дві половини:
чернетки (щоб їх можна було домодерувати) і живі записи (бо їх уже читають
батьки).

І головне — ворота за хешем мовчки тримали найгірші записи. Логіка «текст той
самий → нових цитат не буде» правдива лише тоді, коли сторінку вже читав
екстрактор, який цитати записує. Записи, зроблені ДО 22.09.2026, читав той,
що їх не записував: сторінка з того часу не змінилась, хеш збігається — і
такий запис не перечитувався ніколи. Тому порожні цитати тепер важать більше
за хеш: ознака «нас читала стара машина», а не «сторінка свіжа».

Вартість під контролем: не більше LIMIT_PER_RUN сторінок на кожну половину
черги за прогін, і текст без змін у модель не йде, якщо цитати вже є.
"""
import logging
import os
from datetime import datetime, timezone

import raw_store
from proof import missing_proof

logger = logging.getLogger(__name__)

# Скільки записів читаємо за прогін на КОЖЕН статус. Перевірені відсуваються в
# кінець черги (updated_at), тож за кілька ночей проходять усі. Межу можна
# підняти на один прогін через PROOF_LIMIT — 476 записів без повного набору
# цитат по 20 за ніч розходяться місяць, і разовий більший прохід дешевший за
# місяць чекання. Нічний скрап лишається на 20: бюджет часу екстракції
# (EXTRACT_BUDGET_SEC) ділиться з усім іншим.
PROOF_LIMIT_PER_RUN = int(os.environ.get("PROOF_LIMIT") or 20)
# Скільки тягнемо з бази, щоб було з чого відібрати: цитат бракує не всім.
FETCH_WINDOW = 400
FIELDS = ("id, title, source, source_url, opportunity_type, cost_type, "
          "countries, evidence, status, updated_at")

# Чернетки першими: їх перечит розблоковує модерацію. Живі записи другими, але
# в тому ж прогоні — вони вже на сайті, і чекати, поки розійдеться черга
# чернеток, означає показувати непідтверджене далі.
QUEUES = ("draft", "active")


def has_any_quote(row) -> bool:
    """Чи цей запис узагалі читала машина, що записує цитати."""
    ev = (row or {}).get("evidence")
    return isinstance(ev, dict) and any(
        isinstance(v, str) and v.strip() for v in ev.values()
    )


def needs_fresh_text(row) -> bool:
    """Чи має значення, що текст сторінки не змінився.

    Є хоч одна цитата — сторінку вже читав екстрактор зі світлофором, і на тому
    самому тексті він більше нічого не знайде: читати вдруге означає палити
    токени даремно. Цитат немає жодної — читала стара машина, і той самий
    текст дасть нові цитати.
    """
    return has_any_quote(row)


def pick(rows, limit=PROOF_LIMIT_PER_RUN):
    """Кого читати цього разу. Чиста функція — під тести.

    Спершу ті, у кого немає жодної цитати: вони і найгірші (ніхто не
    підтверджував жодного поля), і єдині, кому гарантовано допоможе перечит.
    """
    waiting = [r for r in rows if missing_proof(r)]
    waiting.sort(key=lambda r: has_any_quote(r))
    return waiting[:limit]


def _load(client, status):
    return (
        client.table("opportunities")
        .select(FIELDS)
        .eq("status", status)
        .order("updated_at")
        .limit(FETCH_WINDOW)
        .execute()
        .data or []
    )


def run(client, fetch_text) -> dict:
    """Один прохід. Ніколи не кидає виняток: нічний скрап не має падати через
    те, що одна сторінка не відповіла.

    fetch_text — чим тягнути сторінку (у прогоні це ttl_requeue._fetch_text).
    """
    stats = {"checked": 0, "requeued": 0, "unchanged": 0}
    try:
        now = datetime.now(timezone.utc)
        for status in QUEUES:
            waiting = pick(_load(client, status))
            if not waiting:
                continue
            label = "чернеток" if status == "draft" else "записів на сайті"
            blank = sum(1 for r in waiting if not has_any_quote(r))
            print(f"\n🔍 Чекають доказу: {len(waiting)} {label} "
                  f"(без жодної цитати: {blank}) — читаю сторінки")
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
                if needs_fresh_text(r) and (
                    client.table("raw_items").select("id")
                    .eq("content_hash", content_hash).limit(1).execute().data
                ):
                    # Текст той самий, і цитати вже є — нових на ньому не буде.
                    stats["unchanged"] += 1
                    continue
                raw_store.store_raw_items(client, r.get("source") or "proof-recheck", [{
                    "source": r.get("source") or "proof-recheck",
                    "source_url": url,
                    "raw_title": r.get("title"),
                    "raw_text": text,
                }])
                stats["requeued"] += 1
        if stats["checked"]:
            print(f"✅ Чекають доказу: {stats['requeued']} зі {stats['checked']} "
                  f"пішли на повторну екстракцію "
                  f"(сторінка без змін: {stats['unchanged']}, решта — недоступна)")
    except Exception as e:
        logger.error("proof_recheck failed: %s", e)
    return stats
