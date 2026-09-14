'use client';
import { useState } from 'react';

// «Поділитися ↗» у мобільній шапці сторінки можливості (референс 6d).
// На телефоні — системне меню поширення, де його немає — копіюємо адресу.
export default function ShareButton({ title, label, copiedLabel, className }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (window.gtag) window.gtag('event', 'share_click', { event_label: 'detail_page' });
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* людина закрила меню або буфер недоступний */
    }
  };

  return (
    <button type="button" className={className} onClick={onClick} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
