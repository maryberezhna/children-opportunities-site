'use client';
import { useState } from 'react';

// «Поділитися з іншим батьком» у картці дії й кнопка-іконка в нижніх панелях
// на телефоні. Системне меню поширення (Web Share API), де його немає —
// копіюємо адресу.
//
// Живе в app/, а не в app/o/[slug]/: з 30.09.2026 нею користується і панель
// підбірок (StickyBar), бо поділитися має бути звідки завгодно, а не лише зі
// сторінки можливості.
//
// `icon` — лише значок без підпису (панель на телефоні): підпис іде в
// aria-label, а «Посилання скопійовано» читає екранний читач через aria-live.
export default function ShareButton({ title, label, copiedLabel, className, icon = false, place = 'detail_page' }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (window.gtag) window.gtag('event', 'share_click', { event_label: place });
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

  const text = copied ? copiedLabel : label;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-live="polite"
      aria-label={icon ? text : undefined}
      title={icon ? text : undefined}
    >
      {icon ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="m16 6-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="m16 6-4-4-4 4" />
            <path d="M12 2v13" />
          </svg>
          {text}
        </>
      )}
    </button>
  );
}
