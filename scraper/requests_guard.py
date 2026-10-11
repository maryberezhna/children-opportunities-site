"""Записи зі «Звернень» автоматика не чіпає (Марія, 11.10.2026).

«Якщо це приходить зі звернень, то ніколи не чіпай його при перевірці» — і
навіть дедлайн їх не закриває: «то не чіпай їх». Привід — аудит першоджерел
того ж дня зняв у чернетки три конкурси Порталу «Експеримент», платного
партнера, якого Марія опублікувала вручну; повертала вона їх сама.

Ознака — позначки, які пишуть шляхи «людина принесла»: форма на сайті
(process_suggestions), кнопка адмінки «опублікувати вручну», «принесла Марія».
Дзеркало — SQL-функція close_expired_opportunities() (міграція
20261011_requests_untouchable.sql).
"""
from __future__ import annotations

MARKS = (
    "💡 пропозиція з форми на сайті",
    "опубліковано вручну за рішенням Марії",
    "💡 принесла Марія",
)


def is_request(row: dict) -> bool:
    """Запис прийшов від людини (звернення) — автоматика його не змінює."""
    comment = (row or {}).get("admin_comment") or ""
    return any(m in comment for m in MARKS)


def protected_ids(db) -> set:
    """id усіх таких записів — щоб писарі могли спитати «можна?» за самим id."""
    ids: set = set()
    for mark in MARKS:
        rows = (db.table("opportunities").select("id")
                .ilike("admin_comment", f"%{mark}%").execute().data or [])
        ids.update(r["id"] for r in rows)
    return ids
