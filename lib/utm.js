// Позначки джерела (UTM) на НАШИХ посиланнях: пости в Telegram-каналі, бот
// Dityam+ і листи організаторам.
//
// Без них GA4 записує перехід із месенджера чи пошти як «прямий»: Telegram і
// Gmail не передають, звідки прийшла людина. 04.10.2026 «прямих» було 22%
// відвідувань, і з 15 сторінок, куди їх приходило найбільше, 10 ми саме тоді
// постили в каналі — але довести це цифрою було нічим.
//
// Позначка додається лише до адрес dityam.com.ua (не до сторінок організаторів)
// і не до /admin та /api. Видимий текст посилання не міняється — тільки href.
// Дзеркало для Python — scraper/utm.py.

export const UTM_CHANNEL = { source: 'telegram', medium: 'social', campaign: 'channel' };
export const UTM_PLUS_BOT = { source: 'telegram', medium: 'social', campaign: 'dityam_plus' };
export const UTM_ORGANIZER_EMAIL = { source: 'email', medium: 'email', campaign: 'organizer_letter' };

const SITE_RE = /^https?:\/\/(?:www\.)?dityam\.com\.ua(?=[/?#]|$)/i;
const SKIP_PATH_RE = /^https?:\/\/[^/]+\/(?:admin|api)(?:[/?#]|$)/i;
const HAS_UTM_RE = /[?&](?:amp;)?utm_source=/i;

function utmQuery({ source, medium, campaign, content }, sep) {
  const pairs = [['utm_source', source], ['utm_medium', medium], ['utm_campaign', campaign]];
  if (content) pairs.push(['utm_content', content]);
  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join(sep);
}

/**
 * Одна адреса з позначкою. sep — роздільник параметрів: '&' для кнопок і JSON,
 * '&amp;' для href усередині HTML (Telegram і пошта розкодовують його самі).
 */
export function withUtm(url, tag, sep = '&') {
  if (!tag || typeof url !== 'string' || !SITE_RE.test(url)) return url;
  if (SKIP_PATH_RE.test(url) || HAS_UTM_RE.test(url)) return url;
  const hashAt = url.indexOf('#');
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  return `${base}${base.includes('?') ? sep : '?'}${utmQuery(tag, sep)}${hash}`;
}

/** Усі href на наш сайт у готовому HTML-повідомленні чи листі. */
export function tagSiteLinks(html, tag) {
  if (!tag || typeof html !== 'string') return html;
  return html.replace(/href=(["'])(.*?)\1/g,
    (_, q, url) => `href=${q}${withUtm(url, tag, '&amp;')}${q}`);
}

/** Кнопки inline_keyboard з url на наш сайт. */
export function tagKeyboard(markup, tag) {
  if (!tag || !Array.isArray(markup?.inline_keyboard)) return markup;
  return {
    ...markup,
    inline_keyboard: markup.inline_keyboard.map((row) => row.map((b) => (
      b && typeof b.url === 'string' ? { ...b, url: withUtm(b.url, tag) } : b
    ))),
  };
}
