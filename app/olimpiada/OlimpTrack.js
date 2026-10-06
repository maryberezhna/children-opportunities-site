'use client';

// Статистика сторінки олімпіади (Марія, 06.10.2026: «чітко трекай статистику
// на цій сторінці»). Власні лічильники в site_events, як для /plus: GA4 не
// бачить тих, хто блокує аналітику, а в /admin/metrics потрібні точні числа.
//   olimp_view — відкрили сторінку, раз на сесію; source — звідки прийшли;
//   olimp_cta  — натиснули кнопку-заклик; source — яку саме (data-cta).
// Email зі списку очікування рахуються окремо — у olimpiada_waitlist.source.
import { useEffect } from 'react';
import { sendSiteEvent, SITE_EVENTS, olimpSource } from '@/lib/site-events';
import { trackConversion } from '@/lib/track';

const KEY = 'olimp_viewed';

export default function OlimpTrack() {
  useEffect(() => {
    let first = true;
    try {
      first = !window.sessionStorage.getItem(KEY);
      window.sessionStorage.setItem(KEY, '1');
    } catch { /* приватне вікно — краще двічі, ніж нуль */ }
    if (first) {
      const source = olimpSource({ search: window.location.search, referrer: document.referrer, host: window.location.hostname });
      sendSiteEvent(SITE_EVENTS.OLIMP_VIEW, source);
      trackConversion('olimpiada_view', { event_label: source, event_source: source });
    }
    const onClick = (e) => {
      const a = e.target.closest?.('[data-cta] a.ol-btn-main');
      if (!a) return;
      const where = a.closest('[data-cta]').getAttribute('data-cta');
      sendSiteEvent(SITE_EVENTS.OLIMP_CTA, where);
      trackConversion('olimpiada_cta_click', { event_label: where, event_source: where });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
