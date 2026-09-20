// Канонізація URL — ЄДИНИЙ ключ ідентичності можливості між усіма пайплайнами.
// Дзеркало: scraper/canonical.py — правки мають іти в обидва файли синхронно.
//
// Правила: https, хост у нижньому регістрі без www., без фрагмента, без
// трекінгових параметрів, решта параметрів відсортована, без хвостового слеша,
// без мовного префікса в шляху.
// Тільки параметри, що ТОЧНО аналітичні — ?ref= чи ?page= можуть міняти вміст.

const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'yclid', 'msclkid', 'twclid',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'igshid', 'igsh', 'si',
  'srsltid', 'ref_src', 'spm',
]);

// Мовний префікс шляху — не частина ідентичності. Та сама програма на
// americancouncils.org.ua лежала двічі: /en/programs/... і /programs/...,
// і для бази це були дві різні можливості. Те саме з uboost.study/ua/career.
//
// Список свідомо НЕ повний ISO 639-1: двобуквені коди, які частіше означають
// не мову, а розділ сайту, сюди не входять. 'it' — це Information Technology
// частіше, ніж італійська; 'hc' у mitocw.zendesk.com/hc/en-us/ — help center;
// так само небезпечні is, id, in, at, as, so, to, no, am, or, my.
// Помилково НЕ зрізати краще, ніж помилково склеїти дві різні сторінки.
const LANG_PREFIXES = new Set([
  'en', 'uk', 'ua', 'ru', 'de', 'pl', 'fr', 'es', 'pt', 'nl', 'sv', 'da',
  'fi', 'cs', 'sk', 'ro', 'hu', 'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'el',
  'tr', 'he', 'ar', 'fa', 'hi', 'zh', 'ja', 'ko', 'ka', 'hy', 'az', 'kk',
  'uz', 'sr', 'mk', 'sq', 'be',
]);
// Приймаємо і 'en', і 'en-us' / 'en_US' — обидві форми трапляються.
const LANG_SEG = /^([a-z]{2})(?:[-_][a-z]{2})?$/i;

// Прибирає перший сегмент шляху, якщо це мовний код. Зрізаємо ЛИШЕ коли після
// префікса лишається ще щось: '/en' — це головна англійською, а не та сама
// сторінка, що '/'. Один префікс за виклик.
export function stripLangPrefix(path) {
  if (!path.startsWith('/')) return path;
  const segments = path.split('/');        // ['', 'en', 'programs', ...]
  if (segments.length < 3 || !segments[2]) return path;
  const m = LANG_SEG.exec(segments[1]);
  if (m && LANG_PREFIXES.has(m[1].toLowerCase())) return `/${segments.slice(2).join('/')}`;
  return path;
}

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
  path = stripLangPrefix(path);
  // Нестандартний порт зберігаємо: інший порт — інший сайт.
  const port = u.port && u.port !== '443' && u.port !== '80' ? `:${u.port}` : '';

  return `https://${host}${port}${path}${query}`;
}
