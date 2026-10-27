/**
 * Згода на cookie аналітики для відвідувачів з ЄС/ЄЕЗ, Великої Британії й
 * Швейцарії (Марія, 27.10.2026: «кукіс додай, бо це вже Євросоюз»).
 *
 * Як це працює:
 *  - middleware.js знає країну (Vercel, x-vercel-ip-country) і для цих країн
 *    ставить коротку службову cookie dityam_region=eu — без країни й будь-яких
 *    персональних даних. Сторінки кешуються (ISR), тож читати заголовки в
 *    layout не можна: це зробило б динамічною кожну сторінку.
 *  - До згоди: Google Consent Mode v2 «denied» ще до config GA, Hotjar і
 *    Amplitude не вантажаться, A/B-cookie ab_card не ставиться.
 *  - Вибір — у cookie dityam_consent на 6 місяців: granted або denied.
 *  - Україна й решта світу — як було, без банера й без змін в аналітиці.
 *
 * Модуль без аліасу `@/` і без мережі: його читають тести на голому node і
 * middleware на edge.
 */

// ЄС (27) + ЄЕЗ (Ісландія, Ліхтенштейн, Норвегія) + Велика Британія + Швейцарія.
export const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]);

export const REGION_COOKIE = 'dityam_region';
export const REGION_EU = 'eu';
export const REGION_MAX_AGE = 30 * 24 * 3600;

export const CONSENT_COOKIE = 'dityam_consent';
export const CONSENT_MAX_AGE = 182 * 24 * 3600; // ≈ 6 місяців
export const CONSENT_GRANTED = 'granted';
export const CONSENT_DENIED = 'denied';

export const needsConsent = (country) => CONSENT_COUNTRIES.has(String(country || '').toUpperCase());

const read = (cookieString, name) => {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(String(cookieString || ''));
  return m ? decodeURIComponent(m[1]) : null;
};

export const regionFromCookie = (cookieString) => read(cookieString, REGION_COOKIE);
export const consentFromCookie = (cookieString) => {
  const v = read(cookieString, CONSENT_COOKIE);
  return v === CONSENT_GRANTED || v === CONSENT_DENIED ? v : null;
};

/** Чи стримувати аналітику: регіон зі згодою, а згоди «так» немає. */
export function analyticsBlocked(cookieString) {
  return regionFromCookie(cookieString) === REGION_EU && consentFromCookie(cookieString) !== CONSENT_GRANTED;
}

/**
 * Чи можна зараз рахувати відвідування власними лічильниками (site_events,
 * opportunity_clicks) і писати для них позначки в сховище браузера.
 * Для ЄС — лише після «Прийняти» (Марія, 27.10.2026); для решти світу — так.
 * Читає cookie щоразу, тож згода діє одразу, без перезавантаження.
 */
export function analyticsAllowed(cookieString = typeof document === 'undefined' ? '' : document.cookie) {
  try { return !analyticsBlocked(cookieString); } catch { return true; }
}

/** Чи показати банер сам (без кнопки «Налаштування cookie»): регіон ЄС і вибору ще немає. */
export function shouldAskConsent(cookieString) {
  return regionFromCookie(cookieString) === REGION_EU && consentFromCookie(cookieString) === null;
}

/**
 * Inline-рядок для скрипта GA (app/Analytics.js): виставляє
 * window.__dityamConsentPending і Consent Mode default ДО gtag('config').
 * Правила ті самі, що в analyticsBlocked (tests/consent.test.mjs звіряє).
 */
export const CONSENT_DEFAULT_SNIPPET = `
          window.__dityamConsentPending = (function () {
            var c = document.cookie;
            var eu = /(?:^|;\\s*)${REGION_COOKIE}=${REGION_EU}(?:;|$)/.test(c);
            var ok = /(?:^|;\\s*)${CONSENT_COOKIE}=${CONSENT_GRANTED}(?:;|$)/.test(c);
            return eu && !ok;
          })();
          if (window.__dityamConsentPending) {
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied',
              wait_for_update: 500
            });
          }`;

// Cookie аналітики, які прибираємо після «Відхилити» (раніше могли бути
// поставлені згодою): GA4 (_ga, _ga_<ID>), Hotjar (_hj…), Amplitude (AMP_…).
export const ANALYTICS_COOKIE_PREFIXES = ['_ga', '_gid', '_hj', 'AMP_'];
