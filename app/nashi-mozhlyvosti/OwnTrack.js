'use client';

// Статистика «Наших можливостей» (Марія, 13.10.2026: «і аналітику там»).
// Як на /olimpiada: власні лічильники в site_events (GA4 не бачить тих, хто
// блокує аналітику) + та сама подія в GA4/Amplitude.
//   own_view  — відкрили сторінку, раз на сесію; source — звідки прийшли;
//   own_click — натиснули картку (картинку, назву чи кнопку); source — яку.
// Числа — в /admin/korystuvachi, блок «⭐ Наші можливості».
import { useEffect } from 'react';
import { sendSiteEvent, SITE_EVENTS, olimpSource } from '@/lib/site-events';
import { trackConversion } from '@/lib/track';

const KEY = 'own_viewed';

export default function OwnTrack() {
  useEffect(() => {
    let first = true;
    try {
      first = !window.sessionStorage.getItem(KEY);
      window.sessionStorage.setItem(KEY, '1');
    } catch { /* приватне вікно — краще двічі, ніж нуль */ }
    if (first) {
      const here = window.location.pathname;
      const prev = window.__dityamPath === here ? window.__dityamPrevPath : window.__dityamPath;
      const source = olimpSource({
        search: window.location.search, referrer: document.referrer, host: window.location.hostname,
        prevPath: prev && prev !== here ? prev : null,
      });
      sendSiteEvent(SITE_EVENTS.OWN_VIEW, source);
      trackConversion('own_page_view', { event_label: source, event_source: source });
    }
    const onClick = (e) => {
      const a = e.target.closest?.('[data-own] a');
      if (!a) return;
      const which = a.closest('[data-own]').getAttribute('data-own');
      sendSiteEvent(SITE_EVENTS.OWN_CLICK, which);
      trackConversion('own_card_click', { event_label: which, event_source: which });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
