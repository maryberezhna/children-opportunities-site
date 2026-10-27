'use client';
// Скільки людей зайшло на /modnyi-kod — раз на сесію, з міткою «звідки»
// (utm_source або домен сайту, з якого прийшли). Для воронки в адмінці.
import { useEffect } from 'react';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';
import { analyticsAllowed } from '@/lib/consent';

export default function MkTrack() {
  useEffect(() => {
    // ЄС без згоди: не рахуємо й не пишемо позначку в сховище.
    if (!analyticsAllowed()) return;
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
