/**
 * Кого тегнути в Instagram — лише ті акаунти, що стоять посиланням на сторінці
 * джерела. Не з голови моделі: вигаданий або чужий @ у пості від імені
 * платформи гірший за пост без тегу.
 *
 * 28.09.2026 Марія спитала, чому в чернетках немає, кого тегати. Модель
 * цього не знала й не могла знати: у базі акаунтів організаторів немає, а
 * правило «не вигадуй фактів» забороняє їх придумувати.
 *
 * Джерело буває добіркою (Eurodesk, новинний сайт), і тоді на сторінці —
 * Instagram добірки, а не організатора. Тому поруч із акаунтом завжди
 * пишемо домен, де його знайдено: людина бачить, чий це акаунт.
 */

// Службові шляхи instagram.com, які не є акаунтами.
const NOT_ACCOUNTS = new Set([
  'p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'about',
  'legal', 'developer', 'web', 'direct', 'share', 'sharer',
]);

/** Акаунти з посилань instagram.com/<акаунт> у HTML. Без дублів і службових шляхів. */
export function handlesFromHtml(html) {
  const out = new Map();
  const re = /instagram\.com\/([A-Za-z0-9_.]{2,30})(?=[/"'?#\s<]|$)/gi;
  for (const m of String(html ?? '').matchAll(re)) {
    const handle = m[1].replace(/\.+$/, '');
    if (!handle || NOT_ACCOUNTS.has(handle.toLowerCase())) continue;
    const key = handle.toLowerCase();
    if (!out.has(key)) out.set(key, handle);
  }
  return [...out.values()].slice(0, 3);
}

/**
 * Акаунти зі сторінки джерела. Сайт не відповів, заблокував IP GitHub (буває
 * часто, див. 403 для Actions) або посилань немає — порожній список, не помилка.
 */
export async function instagramHandles(url, { timeoutMs = 10000 } = {}) {
  if (!/^https?:\/\//i.test(String(url || ''))) return { handles: [], host: null };
  let host = null;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return { handles: [], host: null }; }
  if (host === 'instagram.com') {
    return { handles: handlesFromHtml(url), host };
  }
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { handles: [], host };
    return { handles: handlesFromHtml(await r.text()), host };
  } catch {
    return { handles: [], host };
  }
}

/** Рядок для адмінчату під карткою. */
export function tagLine({ handles, host }) {
  if (handles.length) {
    return `Кого тегнути: ${handles.map((h) => `@${h}`).join(', ')} (знайдено на ${host}; перевір, чи це організатор, а не добірка)`;
  }
  return host
    ? `Кого тегнути: на ${host} Instagram не знайшовся (або сайт не пустив) — тег вручну`
    : 'Кого тегнути: у запису немає сторінки джерела — тег вручну';
}
