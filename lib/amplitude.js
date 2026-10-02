// Amplitude: налаштування з оточення. Окремий файл, бо те саме потрібно і
// тегові (app/Analytics.js), і політиці конфіденційності: вона згадує
// Amplitude лише тоді, коли він справді ввімкнений.
//
// Ключ проєкту Amplitude публічний за задумом (він однаково видно в коді
// сторінки), тому префікс NEXT_PUBLIC_ тут доречний.

const clean = (v) => String(v || '').trim();

// Ключ — 32 шістнадцяткові символи. Усе інше (порожньо, «TODO», пробіли)
// вважаємо «не ввімкнено», щоб випадкове значення не потрапило в адресу скрипта.
export const amplitudeKey = (env = process.env) => {
  const k = clean(env.NEXT_PUBLIC_AMPLITUDE_API_KEY);
  return /^[a-f0-9]{32}$/i.test(k) ? k : '';
};

export const amplitudeIsEu = (env = process.env) =>
  clean(env.NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE).toUpperCase() === 'EU';

export const AMPLITUDE_KEY = amplitudeKey({
  NEXT_PUBLIC_AMPLITUDE_API_KEY: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY,
});
export const AMPLITUDE_EU = amplitudeIsEu({
  NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE: process.env.NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE,
});
export const AMPLITUDE_ON = Boolean(AMPLITUDE_KEY);
