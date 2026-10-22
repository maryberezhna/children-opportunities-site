import { aiSourceFrom, aiLabel } from './ai-visibility.js';

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
  // Онлайн-олімпіада (Марія, 06.10.2026: «чітко трекай статистику на цій
  // сторінці»). source — звідки (див. olimpSource), без даних людини.
  OLIMP_VIEW: 'olimp_view',             // відкрив /olimpiada — раз на сесію
  OLIMP_CTA: 'olimp_cta',               // натиснув кнопку-заклик на сторінці
  OLIMP_TOP_CLICK: 'olimp_top_click',   // натиснув картку в «Топ 3 цього тижня»
  OLIMP_POPUP_SHOW: 'olimp_popup_show', // попап на фільтрі показано
  OLIMP_POPUP_MORE: 'olimp_popup_more', // у попапі натиснув «Детальніше»
  OLIMP_POPUP_CLOSE: 'olimp_popup_close', // закрив попап, нічого не лишивши
  // Друкований диплом (11.10.2026: «чому ніхто не замовляє друк диплому»):
  // source — 'email' (прийшли з листа на #dostavka) або 'page'.
  OLIMP_PRINT_OPEN: 'olimp_print_open',     // натиснув «Так, замовити» — відкрив форму доставки
  OLIMP_PRINT_SUBMIT: 'olimp_print_submit', // відправив форму — далі оплата (або адреса, якщо вже оплачено)
  // Педагоги (11.10.2026): новий педагог залишив імʼя та email у блоці
  // «Для педагогів»; повторний email не рахується. source — utm або 'page'.
  OLIMP_TEACHER_SIGNUP: 'olimp_teacher_signup',
  // Помилка в домені email (11.10.2026: кожен 9-й лист батькам повертався):
  // натиснув «Виправити» під полем. source — яка форма: entry, teacher, waitlist.
  OLIMP_EMAIL_TYPO_FIXED: 'olimp_email_typo_fixed',
  // Реєстрація через Telegram (13.10.2026, «повісь аналітику тут»): натиснув
  // «Зареєструватися в Telegram». Далі кроки пише бот (lib/olimpiada-bot.js):
  // olimp_bot_start, olimp_bot_reg, olimp_bot_done, olimp_plus_start.
  OLIMP_TG_CLICK: 'olimp_tg_click',
  // «Модний код» (12.10.2026, Марія: «трекай, скільки зайшло на сторінку і
  // скільки купило»). mk_pay_start, mk_paid, mk_test_done, mk_cover_done
  // пише сервер (lib/modnyi-kod-server.js), з браузера — лише ці 2.
  MK_VIEW: 'mk_view',   // відкрив /modnyi-kod — раз на сесію; source — звідки
  MK_CTA: 'mk_cta',     // натиснув «Взяти участь» / відкрив форму
  // «Наші можливості» (13.10.2026, Марія: «і аналітику там»).
  OWN_VIEW: 'own_view',   // відкрив /nashi-mozhlyvosti — раз на сесію; source — звідки
  OWN_CLICK: 'own_click', // натиснув картку; source — яку: olimpiada, modnyi-kod, plus
  // Прийшов із відповіді ШІ-асистента (22.10.2026, lib/ai-visibility.js) — раз
  // за сесію; source — «асистент:сторінка входу». Парний ai_fetch пише сервер
  // (middleware) і в цей список навмисно не входить: з браузера його не шлють.
  AI_VISIT: 'ai_visit',
});

export const SITE_EVENT_NAMES = Object.freeze(Object.values(SITE_EVENTS));

const VISIT_KEY = 'dityam:visited';
const AI_KEY = 'dityam:ai';

/** Маяк не блокує перехід і мовчить, якщо браузер його не вміє. */
export function sendSiteEvent(name, source = null) {
  if (typeof window === 'undefined') return false;
  // Марія й модератори (?noga=1) не рахуються — той самий прапорець, що й у GA4.
  if (window.__dityamNoAnalytics) return false;
  if (!SITE_EVENT_NAMES.includes(name)) return false;
  try {
    const payload = source ? { name, source: String(source).slice(0, 100) } : { name };
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
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

/**
 * Людина прийшла з ШІ-асистента — раз за сесію, разом зі сторінкою входу:
 * саме вона каже, яку нашу сторінку асистент порадив.
 */
export function markAiVisit(pathname) {
  if (typeof window === 'undefined') return false;
  const ai = aiSourceFrom({ search: window.location.search, referrer: document.referrer });
  if (!ai) return false;
  try {
    if (sessionStorage.getItem(AI_KEY)) return false;
    sessionStorage.setItem(AI_KEY, '1');
  } catch { /* приватне вікно: краще двічі, ніж нуль */ }
  return sendSiteEvent(SITE_EVENTS.AI_VISIT, aiLabel(ai, pathname || window.location.pathname));
}

/** Сторінка Dityam+ — і українська, і англійська. */
export const isPlusPath = (path) => /^\/(en\/)?plus\/?$/.test(String(path || ''));

/**
 * Звідки людина прийшла на сторінку — коротка мітка для site_events.source.
 * utm_source важливіший за реферер (посилання з каналу чи листа його мають);
 * свій сайт — шлях сторінки, з якої перейшли (/, /olimpiady); чужий — домен
 * без www; нічого — 'direct'. Даних людини тут немає.
 */
export function olimpSource({ search = '', referrer = '', host = '', prevPath = null } = {}) {
  const utm = new URLSearchParams(search).get('utm_source');
  if (utm) return `utm:${utm}`.slice(0, 60);
  // Перехід усередині сайту (Next Link): реферер браузера тут застарілий,
  // а prevPath — сторінка, з якої натиснули (app/Analytics.js __dityamPath).
  if (prevPath) return String(prevPath).slice(0, 60);
  if (!referrer) return 'direct';
  try {
    const u = new URL(referrer);
    const h = u.hostname.replace(/^www\./, '');
    if (host && h === String(host).replace(/^www\./, '')) return (u.pathname || '/').slice(0, 60);
    return h.slice(0, 60);
  } catch {
    return 'direct';
  }
}
