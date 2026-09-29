// Одна точка для подій-конверсій.
//
// GA4 отримує подію завжди — на ньому тримається вся аналітика сайту.
// Google Ads отримує її тільки якщо в env є ідентифікатор кампанії І мітка
// конкретної дії: без мітки виклик `conversion` мовчки нікуди не зараховується,
// тож краще не робити його взагалі. Поки міток немає, конверсії все одно
// доїжджають у Ads через імпорт ключових подій з GA4 — це запасний шлях,
// повільніший (до доби затримки), але робочий.

import { currentAbCard } from './ab-card.js';

export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// A/B-тест картки (29.09.2026): кожна подія несе варіант ab_card, щоб у GA4
// рахувати частку користувачів з opportunity_click, telegram_join_click і
// apply_click окремо для A і B. Той самий варіант іде user property в
// app/Analytics.js. У GA4 ab_card треба зареєструвати як custom dimension
// (event-scoped і user-scoped), інакше у звітах його не видно.
const withAbCard = (params) => ({ ...params, ab_card: currentAbCard() || 'A' });

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

  window.gtag('event', name, withAbCard({ event_category: 'conversion', ...params }));

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
// `source`: 'detail_page' — офіційний сайт, 'detail_page_apply' — запис чи
// подача, 'detail_page_bar' — панель на телефоні.
// `id` — запис: з ним перехід іде ще й у наш лічильник (opportunity_clicks),
// щоб рахувати переходи по кожному гуртку, а не лише назвою в GA4.
export function trackOpportunityClick(title, source, id = null) {
  if (typeof window === 'undefined') return;

  // Марія й модератори (?noga=1) не рахуються ні в GA4, ні в лічильнику.
  if (id && !window.__dityamNoAnalytics && navigator.sendBeacon) {
    try {
      navigator.sendBeacon('/api/click', new Blob(
        [JSON.stringify({ id, place: source })],
        { type: 'application/json' },
      ));
    } catch { /* лічильник — не причина ламати перехід */ }
  }

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
 * Натискання основної кнопки «Подати заявку ↗» на сторінці можливості —
 * окрема подія apply_click (редизайн, 29.09.2026), додаткова метрика
 * A/B-тесту картки. Іде ПОРУЧ з opportunity_click, а не замість: старі
 * звіти й імпорт у Google Ads тримаються на opportunity_click.
 * `source`: 'detail_page_apply' — картка дії, 'detail_page_bar' — панель
 * на телефоні.
 */
export function trackApplyClick(title, source) {
  trackConversion('apply_click', {
    event_category: 'engagement',
    event_label: title,
    event_source: source,
  });
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
  window.gtag('event', 'search', withAbCard({
    search_term: q.slice(0, 100),
    results: Number.isFinite(results) ? results : undefined,
  }));
}

/**
 * Фільтри каталогу — для воронки «відвідувачі → перший застосований фільтр»
 * (Марія, 29.09.2026). До того фільтри не вимірювались узагалі: у GA4 був лише
 * текстовий пошук (`search`), хоча фільтр — головний спосіб звузити список.
 *
 * `filterSignature` — чисте зведення стану в рядок «ключ=значення;…» без
 * порожніх груп; місто сторінки міста (presetCity) фільтром людини не є.
 * Однаковий рядок — той самий стан, тож подію шлемо лише на зміну.
 */
export function filterSignature({ type = [], age = [], deadline = 'all', need = [], cost = 'all', place = [], presetCity = null } = {}) {
  const parts = [];
  if (type.length) parts.push(`type=${type.join(',')}`);
  if (age.length) parts.push(`age=${age.join(',')}`);
  if (deadline !== 'all') parts.push(`deadline=${deadline}`);
  if (need.length) parts.push(`need=${need.join(',')}`);
  if (cost !== 'all') parts.push(`cost=${cost}`);
  const own = presetCity && place.length === 1 && place[0] === presetCity ? [] : place;
  if (own.length) parts.push(`place=${own.join(',')}`);
  return parts.join(';');
}

export function trackFilterApply(signature, results) {
  if (typeof window === 'undefined' || !window.gtag || !signature) return;
  window.gtag('event', 'filter_apply', withAbCard({
    // Самі ключі — для розрізу «яким фільтром користуються»; повний стан —
    // у filter_state (GA4 обрізає параметр до 100 символів).
    filter_keys: signature.split(';').map((x) => x.split('=')[0]).join(','),
    filter_state: signature.slice(0, 100),
    results: Number.isFinite(results) ? results : undefined,
  }));
}

/**
 * Клік по картці можливості (перехід на /o/<slug>) — для воронки «кліки на
 * картки → переходи на сайт організатора». Картка — спільний компонент, що
 * рендериться й на сервері, тож клік ловимо одним слухачем на документ
 * (app/Analytics.js), а не onClick у самій картці.
 */
export function cardSlugFromHref(href) {
  const m = String(href || '').match(/\/o\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function trackCardClick(slug, fromPath) {
  if (typeof window === 'undefined' || !window.gtag || !slug) return;
  window.gtag('event', 'card_click', withAbCard({ item_id: slug, from_path: String(fromPath || '').slice(0, 100) }));
}
