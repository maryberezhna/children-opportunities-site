// Одна точка для подій-конверсій.
//
// GA4 отримує подію завжди — на ньому тримається вся аналітика сайту.
// Google Ads отримує її тільки якщо в env є ідентифікатор кампанії І мітка
// конкретної дії: без мітки виклик `conversion` мовчки нікуди не зараховується,
// тож краще не робити його взагалі. Поки міток немає, конверсії все одно
// доїжджають у Ads через імпорт ключових подій з GA4 — це запасний шлях,
// повільніший (до доби затримки), але робочий.

export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// Момент цінності: людина щойно пішла на сайт організатора. Назва події живе
// тут, поруч із тим, хто її кидає, а підказка про Telegram імпортує звідси ж.
export const OPPORTUNITY_CLICK_EVENT = 'dityam:opportunity-click';

// Мітка конверсійної дії з інтерфейсу Google Ads (частина після «AW-xxx/»).
const ADS_LABELS = {
  telegram_join_click: process.env.NEXT_PUBLIC_GADS_LABEL_TELEGRAM || '',
  plus_waitlist_submit: process.env.NEXT_PUBLIC_GADS_LABEL_PLUS || '',
  opportunity_click: process.env.NEXT_PUBLIC_GADS_LABEL_OPPORTUNITY || '',
};

export function trackConversion(name, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', name, { event_category: 'conversion', ...params });

  const label = ADS_LABELS[name];
  if (ADS_ID && label) {
    window.gtag('event', 'conversion', { send_to: `${ADS_ID}/${label}` });
  }
}

// «Підписатись» з будь-якого місця сайту — одна подія subscribe_click, щоб
// рахувати «підписались із сайту» одним рядком у GA4 (27.09.2026):
//   target    — куди: 'channel' (Telegram-канал);
//   placement — звідки: 'hub_inline' (картка у списку підбірки),
//               'catalog_inline' (картка у списку головної й міст),
//               'popup' (спливна підказка, app/SubscribePopup.js),
//               'opportunity_block' (блок каналу на сторінці можливості);
//   hub       — slug підбірки з lib/topics.js (український і на /en).
// target, placement і hub треба один раз зареєструвати в GA4 як виміри подій
// (Admin → Custom definitions), інакше у звітах їх не видно. Поки їх немає,
// те саме лежить в event_label ('hub_inline:konkursy') — цей вимір уже є.
export function subscribeClickParams({ target, placement, hub = null }) {
  return {
    target,
    placement,
    ...(hub ? { hub } : {}),
    event_label: hub ? `${placement}:${hub}` : placement,
  };
}

export function trackSubscribeClick(opts) {
  trackConversion('subscribe_click', subscribeClickParams(opts));
}

// Перехід до організатора. Живе тут, а не копією в списку й на сторінці
// можливості: копії вже встигли розійтись — одна слала event_source, друга ні,
// і мітка Ads для opportunity_click не спрацьовувала взагалі, бо обидві
// обходили trackConversion.
//
// `source`: 'list' — картка у списку, 'detail_page' — кнопка на сторінці.
export function trackOpportunityClick(title, source) {
  if (typeof window === 'undefined') return;

  trackConversion('opportunity_click', {
    event_category: 'engagement',
    event_label: title,
    event_source: source,
  });

  // Момент цінності: людина знайшла потрібне й іде до організатора.
  // Підказка про Telegram чекає на цю подію.
  window.dispatchEvent(new CustomEvent(OPPORTUNITY_CLICK_EVENT, {
    detail: { title, source },
  }));
}

/**
 * Пошук у каталозі.
 *
 * Навіщо окрема подія. Запит їде в адресу через history.replaceState
 * (app/OpportunitiesList.js), а вбудований у GA4 «site search» рахує
 * view_search_results лише на page_view із параметром — тобто наш пошук не
 * вимірювався ВЗАГАЛІ. За 30 днів у звіті було 4 події, і всі чотири — від
 * людей, що прийшли за готовим посиланням ?q=. 28.09.2026 на цій цифрі мало
 * не ухвалили рішення прибрати поле пошуку з першого екрана.
 *
 * Шлемо стандартну назву `search` із параметром `search_term`: її GA4 розуміє
 * без налаштування. `results` — скільки знайшлось: запит без результатів
 * важливіший за успішний, бо показує, чого в базі бракує.
 */
export function trackSearch(term, results) {
  if (typeof window === 'undefined' || !window.gtag) return;
  const q = String(term || '').trim();
  if (q.length < 2) return;
  window.gtag('event', 'search', {
    search_term: q.slice(0, 100),
    results: Number.isFinite(results) ? results : undefined,
  });
}
