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
