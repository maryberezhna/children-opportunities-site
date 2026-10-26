"""verify_before_send.py — свіжа перевірка можливостей перед розсилкою Dityam+.

Марія, 26.10.2026: «перевіряй завжди на актуальність можливості перед
публікацією». Пости каналу вже йдуть через scripts/verify-before-post.mjs, а
персональна добірка й нагадування про дедлайн брали записи просто з бази —
закритий набір чи перенесена дата доходили до родини, якщо планова перевірка
стояла на пізніше.

Контракт той самий, що в JS: lifecycle.py --ids <id,…> --json-out <файл>
перечитує сторінки рівно цих записів (і лагодить базу), а keep_open вирішує,
що можна слати. Щоб не палити бюджет моделі:
  • перевіряємо унікальні записи одного запуску, а не на кожного підписника;
  • запис, чию сторінку вже перечитали сьогодні (content_checked_at) і який
    лишився активним, не перевіряємо вдруге — він і є свіжий.

PUBLISH_CHECK=off вимикає перевірку сторінок — лише для сухих прогонів.
Помилку перевірки не ковтаємо: краще не надіслати, ніж надіслати неперевірене.
"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
TIMEOUT_S = int(os.environ.get("PUBLISH_CHECK_TIMEOUT_S", "600"))

# Ті самі правила, що keepOpen у scripts/verify-before-post.mjs.
UNKNOWN = {"unclear", "unreadable"}


def check_disabled() -> bool:
    return os.environ.get("PUBLISH_CHECK", "").lower() == "off"


def _evergreen(v: dict) -> bool:
    return v.get("kind") == "permanent" and not v.get("has_dates") and not v.get("assumed")


def keep_open(rows: list, verdicts: dict) -> tuple[list, list]:
    """open + активний → шлемо; не зрозуміло, але вічна платформа → шлемо;
    решта й «вердикту немає» → ні. Повертає (kept, dropped[(row, why)])."""
    kept, dropped = [], []
    for row in rows:
        v = (verdicts or {}).get(row["id"])
        if not v:
            dropped.append((row, "без вердикту"))
            continue
        ok = v.get("status") == "active" and (
            v.get("state") == "open" or (v.get("state") in UNKNOWN and _evergreen(v)))
        if ok:
            kept.append(row)
        else:
            dropped.append((row, f"{v.get('state')}/{v.get('status') or '—'}"))
    return kept, dropped


def checked_today(row: dict, today: date | None = None) -> bool:
    """Сторінку вже перечитали сьогодні, і запис після цього лишився активним."""
    ts = row.get("content_checked_at")
    if not ts or row.get("status", "active") != "active":
        return False
    try:
        day = datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(timezone.utc).date()
    except ValueError:
        return False
    return day == (today or datetime.now(timezone.utc).date())


def run_lifecycle(ids: list, dry_run: bool = False) -> dict:
    """lifecycle.py --ids → вердикти {id: {...}}. Помилку піднімає."""
    with tempfile.TemporaryDirectory(prefix="dityam-check-") as tmp:
        out = Path(tmp) / "verdicts.json"
        cmd = [sys.executable, "lifecycle.py", "--ids", ",".join(ids), "--json-out", str(out)]
        if dry_run:
            cmd.append("--dry-run")
        res = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, timeout=TIMEOUT_S)
        if res.returncode != 0:
            raise RuntimeError(f"lifecycle.py вийшов з кодом {res.returncode}: {(res.stdout + res.stderr)[-1500:]}")
        return json.loads(out.read_text(encoding="utf-8"))


def verify_rows(rows: list, *, logger=None, dry_run: bool = False, run=run_lifecycle,
                today: date | None = None) -> tuple[set, list]:
    """Унікальні записи цього запуску → (id, які можна слати; відсіяні з причиною)."""
    uniq = list({r["id"]: r for r in rows if r and r.get("id")}.values())
    if not uniq or check_disabled():
        return {r["id"] for r in uniq}, []
    fresh = [r for r in uniq if checked_today(r, today)]
    stale = [r for r in uniq if not checked_today(r, today)]
    kept_ids = {r["id"] for r in fresh}
    dropped = []
    if stale:
        verdicts = run([r["id"] for r in stale], dry_run)
        kept, dropped = keep_open(stale, verdicts)
        kept_ids |= {r["id"] for r in kept}
    if logger:
        logger.info("Перевірка перед розсилкою: %d записів, сьогодні вже перевірені %d, "
                    "перечитано %d, відсіяно %d", len(uniq), len(fresh), len(stale), len(dropped))
        for row, why in dropped:
            logger.info("  ⛔ не шлемо «%s» — перевірка: %s", (row.get("title") or "")[:60], why)
    return kept_ids, dropped
