// Режим головної: «Батькам» (за замовчуванням) чи «Підліткам».
//
// Перемикач живе в шапці (клієнтський Header), а реагують на нього хіро й
// каталог — три різні компоненти без спільного предка, тож стан їде через
// localStorage + CustomEvent, а не через React-контекст: контекст вимагав би
// зробити клієнтським весь layout, а він серверний заради метаданих.
//
// URL ?for=teens — щоб режим можна було шерити лінком і щоб перехід з
// підліткового Instagram одразу відкривав підліткову версію.

export const MODE_KEY = 'dityam-mode';
export const MODE_EVENT = 'dityam-mode-change';

export function readMode() {
  if (typeof window === 'undefined') return 'parents';
  try {
    const url = new URLSearchParams(window.location.search).get('for');
    if (url === 'teens') return 'teens';
    if (url === 'parents') return 'parents';
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'teens' || stored === 'parents') return stored;
  } catch { /* приватний режим */ }
  return 'parents';
}

export function writeMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* noop */ }
  try {
    const u = new URL(window.location.href);
    if (mode === 'teens') u.searchParams.set('for', 'teens');
    else u.searchParams.delete('for');
    window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
  if (window.gtag) {
    window.gtag('event', 'mode_switch', { event_label: mode });
  }
}

export function onModeChange(handler) {
  const fn = (e) => handler(e.detail);
  window.addEventListener(MODE_EVENT, fn);
  return () => window.removeEventListener(MODE_EVENT, fn);
}
