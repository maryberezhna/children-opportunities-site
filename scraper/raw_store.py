"""Шар сирих знахідок (raw_items) — між скрапером і LLM-екстракцією.

Навіщо. Раніше знахідки йшли зі скрапера прямо в Haiku, і будь-який збій
(429, вичерпані кредити, таймаут) означав мовчазну втрату: пост у каналі чи
RSS-вікно вже не повернуться. Тепер усе знайдене спершу лягає в raw_items,
а екстракція читає чергу pending — включно з учорашніми невдахами.

Другий ефект — хеш-гейт: та сама сторінка з незмінним вмістом має той самий
content_hash і вставляється лише раз (on_conflict do nothing), тож LLM більше
не переекстрагує весь каталог щодня. Платимо лише за нове і змінене.
"""
import hashlib
import logging

from canonical import canonical_url

logger = logging.getLogger(__name__)

# Скільки спроб екстракції дати одному сирцю, перш ніж чесно здатись.
MAX_ATTEMPTS = 5


def raw_hash(source_url: str, raw_text: str) -> str:
    return hashlib.sha256(f"{source_url}|{raw_text}".encode()).hexdigest()[:32]


def store_raw_items(client, source_name: str, raw_items: list[dict]) -> int:
    """Записує знахідки скрапера в raw_items. Повертає кількість НОВИХ
    (раніше не бачених) — це і є сигнал «джерело змінилось» для реєстру."""
    new_count = 0
    for raw in raw_items:
        text = (raw.get("raw_text") or "").strip()
        url = (raw.get("source_url") or "").strip()
        if not text:
            continue
        row = {
            "source_name": raw.get("source", source_name),
            "source_url": url or None,
            "canonical_url": canonical_url(url),
            "raw_title": raw.get("raw_title"),
            "raw_text": text,
            "content_hash": raw_hash(url, text),
        }
        try:
            result = (
                client.table("raw_items")
                .upsert(row, on_conflict="content_hash", ignore_duplicates=True)
                .execute()
            )
            if result.data:
                new_count += 1
        except Exception as e:
            logger.error(f"raw_items insert failed ({source_name}): {e}")
    return new_count


def fetch_pending(client, limit: int = 300) -> list[dict]:
    """Черга на екстракцію: найстаріші перші, з обмеженням спроб.
    Ліміт тримає вартість одного запуску передбачуваною — хвіст дочекається
    наступного запуску."""
    try:
        result = (
            client.table("raw_items")
            .select("id, source_name, source_url, raw_title, raw_text, attempts")
            .eq("status", "pending")
            .lt("attempts", MAX_ATTEMPTS)
            .order("fetched_at")
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"fetch_pending failed: {e}")
        return []


def mark(client, raw_id: str, status: str, *, error: str = None,
         opportunity_id: str = None, attempts: int = None) -> None:
    from datetime import datetime, timezone
    patch = {"status": status}
    if status in ("processed", "rejected", "failed"):
        patch["processed_at"] = datetime.now(timezone.utc).isoformat()
    if error is not None:
        patch["last_error"] = error[:500]
    if opportunity_id is not None:
        patch["opportunity_id"] = opportunity_id
    if attempts is not None:
        patch["attempts"] = attempts
    try:
        client.table("raw_items").update(patch).eq("id", raw_id).execute()
    except Exception as e:
        logger.error(f"raw_items mark failed ({raw_id} → {status}): {e}")


def bump_attempt(client, raw_item: dict, error: str) -> None:
    """Невдала екстракція: +1 спроба. Вичерпали MAX_ATTEMPTS → failed
    (потрапить у денний звіт), інакше лишається pending на наступний запуск."""
    attempts = (raw_item.get("attempts") or 0) + 1
    status = "failed" if attempts >= MAX_ATTEMPTS else "pending"
    mark(client, raw_item["id"], status, error=error, attempts=attempts)
