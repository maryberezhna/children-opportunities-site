// Черга вікон сайту: одночасно видно лише одне (Марія, 27.10.2026: «вишикувати
// по черзі»). До того вибір мови, банер cookie, питання про нічну тему,
// підказка каналу й попап олімпіади зʼявлялись незалежно і могли стояти разом.
//
// Порядок — від найважливішого: мова (від неї залежить, якою мовою все інше),
// згода на cookie (юридична, для ЄС), нічна тема (один раз на пристрій),
// олімпіада (відкривається на фільтр — тобто на дію людини), підказка каналу.
// Наступне вікно зʼявляється через GAP_MS після того, як попереднє закрили.
// Хто сьогодні не покажеться (мову вже обрано, не ЄС тощо), той і не стає в
// чергу — нижчі не чекають на нього марно. На старті сторінки SETTLE_MS
// збираємо всі заявки, щоб першим вийшло найважливіше, а не найшвидше
// змонтоване.
//
// force — вікно відкрила сама людина (кнопка «Підписатись», фільтр, що
// відкриває олімпіаду, «Налаштування cookie»): воно не чекає, а тимчасово
// ховає автоматичне (окрім вибору мови — той і так перекриває сторінку).
// Сховане повертається в чергу й вийде після.
//
// Без React і DOM — логіку перевіряє tests/overlay-queue.test.mjs.

export const OVERLAY_ORDER = ['lang', 'consent', 'night', 'olimp', 'subscribe'];
export const GAP_MS = 1500;
export const SETTLE_MS = 700;

const rank = (name) => {
  const i = OVERLAY_ORDER.indexOf(name);
  return i === -1 ? OVERLAY_ORDER.length : i;
};

/** Хто з тих, що чекають, виходить наступним (або null). */
export function pickNext(waiting) {
  let best = null;
  for (const name of waiting) {
    if (best === null || rank(name) < rank(best)) best = name;
  }
  return best;
}

export function createOverlayQueue({ now = () => Date.now(), schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const waiting = new Set();
  const listeners = new Set();
  const readyAt = now() + SETTLE_MS;
  let active = null;
  let freeAt = 0;
  let timer = false;

  const notify = () => { for (const fn of listeners) fn(active); };

  const tryGrant = () => {
    timer = false;
    if (active || !waiting.size) return;
    const t = now();
    const at = Math.max(readyAt, freeAt);
    if (t < at) {
      if (!timer) { timer = true; schedule(tryGrant, at - t); }
      return;
    }
    active = pickNext(waiting);
    waiting.delete(active);
    notify();
  };

  return {
    get active() { return active; },
    isWaiting: (name) => waiting.has(name),

    request(name, { force = false } = {}) {
      if (active === name) return;
      if (force && active !== 'lang') {
        if (active) waiting.add(active);
        waiting.delete(name);
        active = name;
        notify();
        return;
      }
      waiting.add(name);
      tryGrant();
    },

    // Закрили або вже не потрібне. Закрите активне звільняє місце через GAP_MS.
    release(name) {
      waiting.delete(name);
      if (active !== name) return;
      active = null;
      freeAt = now() + GAP_MS;
      notify();
      tryGrant();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Одна черга на вкладку: переживає переходи всередині сайту. */
export function overlayQueue() {
  if (typeof window === 'undefined') return null;
  if (!window.__dityamOverlayQueue) window.__dityamOverlayQueue = createOverlayQueue();
  return window.__dityamOverlayQueue;
}
