"""notifier.py — daily email report via Gmail SMTP.

Set these env vars / GitHub Secrets:
  GMAIL_APP_PASSWORD  — 16-char Gmail App Password (myaccount.google.com/apppasswords)
  GMAIL_FROM          — sender address (default: mashaberezhna0209@gmail.com)
"""
import json
import logging
import os
import smtplib
import urllib.request
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

GMAIL_FROM = os.environ.get("GMAIL_FROM", "mashaberezhna0209@gmail.com")
GMAIL_TO = "mashaberezhna0209@gmail.com"
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

_TYPE_EMOJI = {
    "course": "📚", "olympiad": "🏆", "competition": "🥇",
    "club": "🎭", "exchange": "✈️", "camp": "⛺",
    "scholarship": "🎓", "grant": "💰", "allowance": "💰",
    "festival": "🎪", "medical_aid": "🏥", "psychology": "🧠",
    "rehabilitation": "🏋️", "humanitarian": "🤲",
    "internship": "💼", "volunteer": "🌿",
}

_STATUS_COLOR = {"success": "#16a34a", "error": "#dc2626", "empty": "#d97706"}
_STATUS_LABEL = {"success": "✅ ок", "error": "❌ помилка", "empty": "⚠️ порожньо"}


TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

_tg_esc = lambda s: (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _days_left(deadline: str | None) -> int | None:
    """Скільки днів лишилось до дедлайну; None — якщо дедлайну немає/битий."""
    if not deadline:
        return None
    try:
        d = datetime.strptime(str(deadline)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    return (d - datetime.now().date()).days


def _deadline_label(deadline: str | None) -> str:
    """« ⏳ до 15.09 (27 дн.)» — те, за чим у звіті видно, чим зайнятись першим."""
    left = _days_left(deadline)
    if left is None:
        return " · <i>без дедлайну</i>"
    day = datetime.strptime(str(deadline)[:10], "%Y-%m-%d").strftime("%d.%m")
    if left < 0:
        return f" · 🔴 дедлайн минув ({day})"
    if left == 0:
        return f" · 🔥 <b>дедлайн сьогодні</b> ({day})"
    urgency = "🔥" if left <= 3 else ("⚡" if left <= 14 else "⏳")
    return f" · {urgency} до <b>{day}</b> ({left} дн.)"


def _deadline_sort_key(op: dict):
    """Найтерміновіші — вгору; записи без дедлайну — в кінець списку."""
    left = _days_left(op.get("deadline"))
    return (1, 0) if left is None else (0, left)


def _send_telegram_report(new_opps, health, results, archived, llm_alert) -> bool:
    """Компактний звіт скраперів в адмін-чат. Повертає True, якщо надіслано."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_ADMIN_CHAT_ID:
        return False

    today = datetime.now().strftime("%d.%m")
    lines = [f"🕷 <b>Скрапери — {today}</b>", ""]
    lines.append(
        f"💾 Збережено: <b>{len(new_opps)}</b> · "
        f"📚 активних: {health.get('total_active', 0)} · "
        f"🚪 закрито за текстом сторінки («набір завершено»): {archived}"
    )

    if llm_alert and llm_alert.get("is_billing"):
        lines += ["",
                  "❌ <b>Закінчились кредити Anthropic API</b>",
                  f"{llm_alert['failures']} записів витягнуто, але не збережено. "
                  "Поповнити: console.anthropic.com → Billing "
                  "(наступний запуск сам надолужить)."]
    elif llm_alert:
        lines += ["", f"⚠️ Помилок нормалізації (LLM): {llm_alert['failures']}",
                  f"<code>{_tg_esc(llm_alert.get('last_error', '')[:150])}</code>"]

    if new_opps:
        # Дедлайн — головне, за чим у звіті приймають рішення «зайнятись зараз
        # чи потім», тож він іде одразу після назви, зі скільки днів лишилось.
        lines += ["", "🆕 <b>Нові:</b>"]
        for op in sorted(new_opps, key=_deadline_sort_key)[:10]:
            title = _tg_esc(op.get("title", "—"))
            link = op.get("source_url")
            head = ('<a href="' + _tg_esc(link) + '">' + title + '</a>') if link else title
            lines.append(f"• {head}{_deadline_label(op.get('deadline'))}"
                         f" — {_tg_esc(op.get('source', ''))}")
        if len(new_opps) > 10:
            lines.append(f"…і ще {len(new_opps) - 10}")

    errors = [r for r in results if r["status"] == "error"]
    if errors:
        lines += ["", "⚠️ <b>Помилки скраперів:</b>"]
        for r in errors:
            lines.append(f"• {_tg_esc(r['name'])} → <code>{_tg_esc(str(r.get('error', ''))[:120])}</code>")

    empty = [r["name"] for r in results if r["status"] == "empty"]
    if empty:
        lines += ["", f"⚪ Порожні: {_tg_esc(', '.join(empty))}"]

    payload = {
        "chat_id": TELEGRAM_ADMIN_CHAT_ID,
        "text": "\n".join(lines)[:4000],
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    # Нові записи падають у чергу модерації — одразу даємо кнопку почати.
    if new_opps:
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": "▶️ Переглянути чергу", "callback_data": "mod:next"}]]
        }

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            ok = json.load(resp).get("ok", False)
        if ok:
            logger.info("Telegram report sent")
        return ok
    except Exception as e:
        logger.error("Telegram report failed: %s", e)
        return False


def send_daily_report(
    new_opportunities: list[dict],
    health: dict,
    results: list[dict],
    archived: int,
    llm_alert: dict | None = None,
) -> bool:
    """Щоденний звіт: основний канал — Telegram-бот в адмін-чат, email —
    запасний, якщо Telegram не налаштований або впав. Обидва одразу не шлемо:
    один звіт двічі — це шум, який привчає ігнорувати обидва."""
    if _send_telegram_report(new_opportunities, health, results, archived, llm_alert):
        return 'telegram'

    if not GMAIL_APP_PASSWORD:
        logger.warning("GMAIL_APP_PASSWORD not set — skipping daily email")
        return False

    today = datetime.now().strftime("%Y-%m-%d")
    n_new = len(new_opportunities)
    # Проблема з LLM важливіша за кількість записів — виносимо її в тему,
    # інакше лист «0 записів» виглядає як звичайний тихий день.
    if llm_alert and llm_alert.get("is_billing"):
        subject = f"❌ Dityam — {today}: закінчились кредити Anthropic, {n_new} збережено"
    elif llm_alert:
        subject = f"⚠️ Dityam — {today}: {llm_alert['failures']} помилок LLM, {n_new} збережено"
    else:
        subject = f"🎓 Dityam — {today}: {n_new} записів збережено"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_FROM
    msg["To"] = GMAIL_TO
    msg.attach(MIMEText(_build_text(today, new_opportunities, health, results, archived, llm_alert), "plain", "utf-8"))
    msg.attach(MIMEText(_build_html(today, new_opportunities, health, results, archived, llm_alert), "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_FROM, GMAIL_APP_PASSWORD)
            smtp.sendmail(GMAIL_FROM, [GMAIL_TO], msg.as_string())
        logger.info("Daily report sent: %s", subject)
        return 'email'  # запасний канал
    except Exception as e:
        logger.error("Failed to send email: %s", e)
        return False


# ── HTML builder ──────────────────────────────────────────────────────────────

def _llm_alert_html(llm_alert):
    if not llm_alert:
        return ""
    if llm_alert.get("is_billing"):
        return f"""
        <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="font-size:15px;font-weight:700;color:#dc2626;margin-bottom:6px;">
            ❌ Закінчились кредити Anthropic API
          </div>
          <div style="font-size:14px;color:#7f1d1d;line-height:1.5;">
            {llm_alert['failures']} записів витягнуто, але не нормалізовано — кожен виклик LLM
            падає з «credit balance too low». Скрапери працюють даремно, нові можливості
            не зберігаються.<br>
            <b>Що зробити:</b> поповнити кредити на
            <a href="https://console.anthropic.com/settings/billing" style="color:#dc2626;">console.anthropic.com → Billing</a>
            (і ввімкнути auto-reload, щоб не повторилось). Наступний запуск сам усе надолужить.
          </div>
        </div>"""
    return f"""
    <div style="background:#fffbeb;border:2px solid #d97706;border-radius:8px;padding:16px;margin-bottom:16px;">
      <div style="font-size:15px;font-weight:700;color:#b45309;margin-bottom:6px;">
        ⚠️ Помилки нормалізації (LLM): {llm_alert['failures']}
      </div>
      <div style="font-size:13px;color:#78350f;font-family:monospace;">{_esc(llm_alert.get('last_error',''))}</div>
    </div>"""


def _build_html(today, new_opps, health, results, archived, llm_alert=None):
    total_active = health.get("total_active", 0)
    total_archived = health.get("total_archived", 0)
    no_deadline = health.get("no_deadline", 0)
    deadline_bearing = health.get("deadline_bearing", 0)
    n_new = len(new_opps)
    errors = [r for r in results if r["status"] == "error"]

    # ── new opportunities table ───────────────────────────────────────────────
    if new_opps:
        rows = ""
        for op in new_opps:
            emoji = _TYPE_EMOJI.get(op.get("opportunity_type", ""), "🔹")
            age = _age_range(op)
            deadline = op.get("deadline") or "—"
            title_link = (
                f'<a href="{op["source_url"]}" style="color:#1a56db;text-decoration:none;">'
                f'{_esc(op.get("title", "—"))}</a>'
                if op.get("source_url") else _esc(op.get("title", "—"))
            )
            rows += (
                f'<tr style="border-bottom:1px solid #f0f0f0;">'
                f'<td style="padding:8px 12px;">{emoji} {title_link}</td>'
                f'<td style="padding:8px 12px;color:#555;font-size:13px;">{_esc(op.get("source",""))}</td>'
                f'<td style="padding:8px 12px;color:#555;font-size:13px;">{age}</td>'
                f'<td style="padding:8px 12px;color:#555;font-size:13px;">{deadline}</td>'
                f'</tr>'
            )
        new_section = f"""
        <h2 style="font-size:16px;color:#111;margin:24px 0 12px;">
          📋 Збережено сьогодні ({n_new})
        </h2>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Назва</th>
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Джерело</th>
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Вік</th>
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Дедлайн</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>"""
    else:
        new_section = """
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;color:#92400e;font-size:14px;">
          ℹ️ Сьогодні скрапери не повернули жодного запису.
        </div>"""

    # ── scraper results table ─────────────────────────────────────────────────
    scraper_rows = ""
    for r in results:
        color = _STATUS_COLOR.get(r["status"], "#555")
        label = _STATUS_LABEL.get(r["status"], r["status"])
        count = r.get("count", 0)
        dur = r.get("duration", 0)
        err_msg = f'<br><span style="color:#dc2626;font-size:12px;">{_esc(r.get("error",""))}</span>' if r.get("error") else ""
        scraper_rows += (
            f'<tr style="border-bottom:1px solid #f0f0f0;">'
            f'<td style="padding:8px 12px;font-weight:500;">{_esc(r["name"])}</td>'
            f'<td style="padding:8px 12px;color:{color};font-size:13px;">{label}{err_msg}</td>'
            f'<td style="padding:8px 12px;color:#555;font-size:13px;">{count}</td>'
            f'<td style="padding:8px 12px;color:#888;font-size:13px;">{dur:.1f}s</td>'
            f'</tr>'
        )

    # ── errors banner ─────────────────────────────────────────────────────────
    error_banner = ""
    if errors:
        names = ", ".join(r["name"] for r in errors)
        error_banner = f"""
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:16px;color:#991b1b;font-size:14px;">
          ❌ <strong>Помилки скраперів:</strong> {_esc(names)}<br>
          <span style="font-size:12px;">Перевірте GitHub Actions для деталей.</span>
        </div>"""

    # ── health warnings ───────────────────────────────────────────────────────
    warnings = []
    if deadline_bearing and no_deadline > deadline_bearing * 0.6:
        warnings.append(f"⚠️ {no_deadline} з {deadline_bearing} можливостей із дедлайн-типів ще без дати")
    if warnings:
        warning_html = "<br>".join(warnings)
        health_warn = f"""
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-top:16px;color:#92400e;font-size:13px;">
          {warning_html}
        </div>"""
    else:
        health_warn = ""

    return f"""<!DOCTYPE html>
<html lang="uk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#333;">
<div style="max-width:680px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#1e40af;color:white;padding:24px 28px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;font-size:20px;font-weight:700;">🎓 Dityam Scrapers</h1>
    <p style="margin:6px 0 0;opacity:.8;font-size:14px;">Щоденний звіт — {today}</p>
  </div>

  <!-- Stats row -->
  <div style="background:white;padding:20px 28px;display:flex;gap:12px;border-bottom:1px solid #e5e7eb;">
    <div style="flex:1;text-align:center;padding:14px;background:#eff6ff;border-radius:8px;">
      <div style="font-size:26px;font-weight:700;color:#1e40af;">{n_new}</div>
      <div style="color:#6b7280;font-size:12px;margin-top:2px;">збережено сьогодні</div>
    </div>
    <div style="flex:1;text-align:center;padding:14px;background:#f0fdf4;border-radius:8px;">
      <div style="font-size:26px;font-weight:700;color:#15803d;">{total_active}</div>
      <div style="color:#6b7280;font-size:12px;margin-top:2px;">активних у базі</div>
    </div>
    <div style="flex:1;text-align:center;padding:14px;background:#fff7ed;border-radius:8px;">
      <div style="font-size:26px;font-weight:700;color:#c2410c;">{archived}</div>
      <div style="color:#6b7280;font-size:12px;margin-top:2px;">архівовано</div>
    </div>
    <div style="flex:1;text-align:center;padding:14px;background:#f5f3ff;border-radius:8px;">
      <div style="font-size:26px;font-weight:700;color:#6d28d9;">{total_archived}</div>
      <div style="color:#6b7280;font-size:12px;margin-top:2px;">всього архів</div>
    </div>
  </div>

  <!-- Body -->
  <div style="background:white;padding:24px 28px;border-radius:0 0 10px 10px;box-shadow:0 1px 4px rgba(0,0,0,.06);">

    {_llm_alert_html(llm_alert)}

    {error_banner}

    {new_section}

    <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">🕷️ Результати скраперів</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Скрапер</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Статус</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Записів</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;font-weight:600;">Час</th>
        </tr>
      </thead>
      <tbody>{scraper_rows}</tbody>
    </table>

    <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">🗄️ Здоров'я бази</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#555;font-size:14px;">Активних записів</td><td style="padding:6px 0;font-weight:600;">{total_active}</td></tr>
      <tr><td style="padding:6px 0;color:#555;font-size:14px;">Архівованих записів</td><td style="padding:6px 0;font-weight:600;">{total_archived}</td></tr>
      <tr><td style="padding:6px 0;color:#555;font-size:14px;">Без дедлайну (де очікується)</td><td style="padding:6px 0;font-weight:600;">{no_deadline} з {deadline_bearing}</td></tr>
    </table>
    {health_warn}

  </div>

  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
    Dityam.com.ua — автоматичний звіт · {today}
  </p>

</div>
</body>
</html>"""


# ── plain-text fallback ───────────────────────────────────────────────────────

def _build_text(today, new_opps, health, results, archived, llm_alert=None):
    lines = [
        f"🎓 Dityam Scrapers — {today}",
        "=" * 50,]
    if llm_alert and llm_alert.get("is_billing"):
        lines += [
            "",
            "!!! ЗАКІНЧИЛИСЬ КРЕДИТИ ANTHROPIC API !!!",
            f"{llm_alert['failures']} записів витягнуто, але не збережено.",
            "Поповнити: https://console.anthropic.com/settings/billing",
            "",
        ]
    elif llm_alert:
        lines += ["", f"!!! Помилок нормалізації (LLM): {llm_alert['failures']}",
                  f"    {llm_alert.get('last_error','')}", ""]
    lines += [
        f"Збережено сьогодні: {len(new_opps)}",
        f"Активних у базі: {health.get('total_active', 0)}",
        f"Архівовано сьогодні: {archived}",
        "",
    ]

    if new_opps:
        lines.append("НОВІ МОЖЛИВОСТІ:")
        for op in new_opps:
            age = _age_range(op)
            deadline = op.get("deadline") or "без дедлайну"
            lines.append(f"  • {op.get('title','—')} [{op.get('source','')}] вік {age} | {deadline}")
            if op.get("source_url"):
                lines.append(f"    {op['source_url']}")
    else:
        lines.append("Нових можливостей сьогодні не додано.")

    lines += ["", "СКРАПЕРИ:"]
    for r in results:
        status = {"success": "OK", "error": "ПОМИЛКА", "empty": "ПОРОЖНЬО"}[r["status"]]
        lines.append(f"  {r['name']:25s} {status:10s} {r.get('count',0):3d} записів  {r.get('duration',0):.1f}s")
        if r.get("error"):
            lines.append(f"    → {r['error']}")

    lines += [
        "",
        "БАЗА:",
        f"  Активних: {health.get('total_active', 0)}",
        f"  Архів:    {health.get('total_archived', 0)}",
        f"  Без дедлайну (де очікується): {health.get('no_deadline', 0)} з {health.get('deadline_bearing', 0)}",
    ]
    return "\n".join(lines)


# ── helpers ───────────────────────────────────────────────────────────────────

def _age_range(op: dict) -> str:
    a, b = op.get("age_from"), op.get("age_to")
    if a is not None and b is not None:
        return f"{a}–{b} р."
    if a is not None:
        return f"{a}+ р."
    if b is not None:
        return f"до {b} р."
    return "—"


def _esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
