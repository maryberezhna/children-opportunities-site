// Канонізація URL — ЄДИНИЙ ключ ідентичності можливості між усіма пайплайнами.
// Дзеркало: scraper/canonical.py — правки мають іти в обидва файли синхронно.
//
// Правила: https, хост у нижньому регістрі без www., без фрагмента, без
// трекінгових параметрів, решта параметрів відсортована, без хвостового слеша.
// Тільки параметри, що ТОЧНО аналітичні — ?ref= чи ?page= можуть міняти вміст.

const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'yclid', 'msclkid', 'twclid',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'igshid', 'igsh', 'si',
  'srsltid', 'ref_src', 'spm',
]);

export function canonicalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let input = rawUrl.trim();
  if (!input) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = `https://${input}`;

  let u;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  let host = u.hostname.toLowerCase().replace(/^www\./, '');
  // Валідний хост: лише [a-z0-9.-] і принаймні одна крапка (дзеркалить canonical.py).
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;

  const params = [...u.searchParams.entries()].filter(
    ([k]) => !TRACKING_EXACT.has(k.toLowerCase()) && !k.toLowerCase().startsWith('utm_'),
  );
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length
    ? `?${params.map(([k, v]) => (v === '' ? k : `${k}=${encodeURIComponent(v)}`)).join('&')}`
    : '';

  // Єдине кодування шляху (кирилиця → %XX однаково в JS і Python).
  let path = u.pathname.replace(/\/+$/, '');
  try {
    path = encodeURI(decodeURI(path));
  } catch {
    /* битий percent-encoding — лишаємо як є */
  }
  // Нестандартний порт зберігаємо: інший порт — інший сайт.
  const port = u.port && u.port !== '443' && u.port !== '80' ? `:${u.port}` : '';

  return `https://${host}${port}${path}${query}`;
}
