// Кого НЕ рахуємо в GA4 і Hotjar.
//
// 17.09.2026 у звіті за тиждень 177 переглядів із 1 359 дала одна людина:
// Chrome на комп'ютері, перехід із vercel.com, сесії по 28 хвилин на сторінках,
// над якими саме йшла робота. Вимикач ?noga=1 існував із 30.08, але діє лише
// в тому браузері, де його колись увімкнули, — і про нього легко забути.
// Там же 38 переглядів із localhost і 127.0.0.1: це знімки верстки з
// локальних дев-серверів, кожен у свіжому профілі Chrome, тобто щоразу
// «новий відвідувач».

// Ключ у localStorage: є — не рахуємо цей браузер.
export const NO_ANALYTICS_KEY = 'dityam_no_analytics';

// Лише бойовий домен. Прев'ю на *.vercel.app і локальні сервери — не аудиторія.
export const PRODUCTION_HOST = /(^|\.)dityam\.com\.ua$/;

export const isProductionHost = (host) => PRODUCTION_HOST.test(String(host || ''));

// Внутрішні маршрути. На них теги не вантажимо, а сам браузер позначаємо як
// «свій»: хто відкриває модерацію, той працює над сайтом, а не шукає гурток.
export const INTERNAL_PATHS = ['/admin'];

export const isInternalPath = (pathname) =>
  Boolean(pathname) && INTERNAL_PATHS.some((p) => pathname.startsWith(p));
