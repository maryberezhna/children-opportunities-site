/**
 * Верхні кроки воронки — ті, що відбуваються на сайті, до бота.
 *
 * Навіщо свої лічильники, коли є GA4. По-перше, його числа не дістати з коду
 * сайту: щоб показати воронку в адмінці, потрібен сервісний ключ Google.
 * По-друге, GA4 не бачить тих, хто блокує аналітику. Причина та сама, з якої
 * 29.09.2026 завели opportunity_clicks.
 *
 * Пишемо лише назву кроку й час — жодних даних людини.
 */

export const SITE_EVENTS = Object.freeze({
  VISIT: 'visit',           // перша сторінка за сесію
  PLUS_VIEW: 'plus_view',   // відкрив /plus
  PLUS_CLICK: 'plus_click', // натиснув посилання в @DityamPlusBot
});

export const SITE_EVENT_NAMES = Object.freeze(Object.values(SITE_EVENTS));

const VISIT_KEY = 'dityam:visited';

/** Маяк не блокує перехід і мовчить, якщо браузер його не вміє. */
export function sendSiteEvent(name) {
  if (typeof window === 'undefined') return false;
  // Марія й модератори (?noga=1) не рахуються — той самий прапорець, що й у GA4.
  if (window.__dityamNoAnalytics) return false;
  if (!SITE_EVENT_NAMES.includes(name)) return false;
  try {
    const body = new Blob([JSON.stringify({ name })], { type: 'application/json' });
    if (navigator.sendBeacon) return navigator.sendBeacon('/api/event', body);
    fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * «Зайшов на сайт» — раз на сесію, а не на кожну сторінку: інакше верхній крок
 * воронки рахував би перегляди, а не людей, і конверсія виглядала б утричі
 * меншою, ніж є (у нас ~4 сторінки за сесію).
 */
export function markVisit() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return false;
    sessionStorage.setItem(VISIT_KEY, '1');
  } catch {
    // Приватне вікно чи заблоковане сховище: краще порахувати двічі, ніж нуль.
  }
  return sendSiteEvent(SITE_EVENTS.VISIT);
}

/** Сторінка Dityam+ — і українська, і англійська. */
export const isPlusPath = (path) => /^\/(en\/)?plus\/?$/.test(String(path || ''));
