'use client';
// Скільки людей зайшло на /modnyi-kod — раз на сесію, з міткою «звідки»
// (utm_source або домен сайту, з якого прийшли). Для воронки в адмінці.
import { useEffect } from 'react';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';

export default function MkTrack() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('mk_view')) return;
      window.sessionStorage.setItem('mk_view', '1');
    } catch { /* приватний режим — рахуємо як є */ }
    const q = new URLSearchParams(window.location.search);
    let src = q.get('utm_source') ? `utm:${q.get('utm_source')}` : 'direct';
    try { if (!q.get('utm_source') && document.referrer) { const h = new URL(document.referrer).hostname.replace(/^www\./, ''); src = h === window.location.hostname.replace(/^www\./, '') ? new URL(document.referrer).pathname : h; } } catch { /* ок */ }
    sendSiteEvent(SITE_EVENTS.MK_VIEW, src);
  }, []);
  return null;
}
