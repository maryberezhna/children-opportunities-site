'use client';
import { useState } from 'react';

// «Щось не так? Повідомити» під фактами сторінки можливості (редизайн,
// 29.09.2026). Одне натискання — запис у opportunity_feedback зі значенням
// 'report' і джерелом 'site' (той самий механізм, що 👍/👎 із Telegram;
// рішення Марії 29.09.2026), плюс подія opportunity_feedback у GA4 з
// source: 'site', як у вебхука бота.
//
// Що саме не так, кнопка не питає: це один клік без форми. Після нього
// поруч зʼявляється посилання на контактну форму для тих, хто хоче пояснити.
export default function ReportButton({
  id, slug, label, doneLabel, moreLabel, moreHref, className = 'o-report',
}) {
  const [sent, setSent] = useState(false);

  const onClick = () => {
    setSent(true);
    try {
      const body = new Blob([JSON.stringify({ id, page: slug })], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/feedback', body))) {
        fetch('/api/feedback', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch { /* повідомлення — не причина ламати сторінку */ }
    if (window.gtag) {
      window.gtag('event', 'opportunity_feedback', {
        value: 'report', action: 'add', source: 'site', opportunity_id: id, opportunity_slug: slug,
      });
    }
  };

  if (sent) {
    return (
      <span className={`${className} is-sent`} role="status">
        {doneLabel} <a href={moreHref}>{moreLabel}</a>
      </span>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>{label}</button>
  );
}
