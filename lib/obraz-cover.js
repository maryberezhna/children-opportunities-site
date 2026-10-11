// Обкладинка модного журналу dityam.com.ua для челенджу «Твій образ на
// обкладинці» (11.10.2026, Марія обрала варіант «Обкладинка»). Тло обкладинки —
// «тканина» (клітинка, гусяча лапка, горох…), вона ж рамка навколо малюнка.
// Кожна тканина — самодостатній SVG: однаково працює і як CSS-тло на сайті, і
// як картинка в превʼю для месенджерів (next/og не вміє SVG-візерунки в CSS).
//
// Назва на обкладинці — лише «dityam.com.ua» рукописом, як логотип сайту
// (CLAUDE.md: назва завжди з доменом, без скорочень і капслоку).

const P = (w, h, body) => ({ w, h, body });

export const FABRICS = {
  tartan: {
    name: 'шотландська клітинка', band: '#fff8e7', accent: '#b3202a',
    tile: P(28, 28, '<rect width="28" height="28" fill="#b3202a"/><rect y="9" width="28" height="10" fill="#1d4d3a" opacity=".75"/><rect x="9" width="10" height="28" fill="#1d4d3a" opacity=".75"/><rect y="3" width="28" height="2" fill="#f5c518"/><rect x="3" width="2" height="28" fill="#f5c518"/><rect y="23" width="28" height="1" fill="#fff" opacity=".7"/><rect x="23" width="1" height="28" fill="#fff" opacity=".7"/>'),
  },
  hound: {
    name: 'гусяча лапка', band: '#ffffff', accent: '#1a1a1a',
    tile: P(12, 12, '<rect width="12" height="12" fill="#f4efe6"/><path d="M0 0h6v6H0z M6 6l3-3h3L6 9z M0 6l3 3v3L0 9z M6 0l3 3 3-3z" fill="#1a1a1a"/>'),
  },
  polka: {
    name: 'горох', band: '#fff4f0', accent: '#d6336c',
    tile: P(16, 16, '<rect width="16" height="16" fill="#e2412b"/><circle cx="4" cy="4" r="3" fill="#fff"/><circle cx="12" cy="12" r="3" fill="#fff"/>'),
  },
  breton: {
    name: 'тільняшка', band: '#ffffff', accent: '#1b2a5e',
    tile: P(12, 12, '<rect width="12" height="12" fill="#fff"/><rect width="12" height="5" fill="#1b2a5e"/>'),
  },
  knit: {
    name: 'вʼязка', band: '#f6f0ff', accent: '#7a3fbf',
    tile: P(12, 10, '<rect width="12" height="10" fill="#7a3fbf"/><path d="M0 0 l3 8 l3 -8 M6 0 l3 8 l3 -8" fill="none" stroke="#a678e0" stroke-width="2.2"/>'),
  },
  quilt: {
    name: 'стьобана тканина', band: '#fffbe8', accent: '#c8501a',
    tile: P(20, 20, '<rect width="20" height="20" fill="#f5c518"/><path d="M0 10 L10 0 L20 10 L10 20Z" fill="none" stroke="#c99a00" stroke-width="1.6"/><circle cx="10" cy="10" r="5" fill="#ffe680" opacity=".6"/>'),
  },
  leo: {
    name: 'леопард', band: '#fff8ec', accent: '#7a4a1c',
    tile: P(44, 44, '<rect width="44" height="44" fill="#e8b04a"/><g fill="none" stroke="#3a2412" stroke-width="3.2" stroke-linecap="round"><path d="M6 8 q4 -5 9 0 M8 14 q-3 -2 -2 -5"/><path d="M28 6 q5 -3 8 2 q0 5 -6 4"/><path d="M14 30 q6 -4 10 1 M12 34 q2 4 7 3"/><path d="M34 28 q4 -2 6 3 q-1 4 -5 4"/></g><g fill="#7a4a1c"><circle cx="11" cy="10" r="2.3"/><circle cx="32" cy="9" r="2.3"/><circle cx="18" cy="33" r="2.3"/><circle cx="37" cy="31" r="2.3"/></g>'),
  },
  flor: {
    name: 'квіти', band: '#ffffff', accent: '#e85d24',
    tile: P(26, 26, '<rect width="26" height="26" fill="#ffd3e0"/><g transform="translate(7 7)"><circle r="2.2" fill="#f5c518"/><g fill="#e85d24"><circle cy="-4.5" r="2.6"/><circle cx="4.3" cy="-1.4" r="2.6"/><circle cx="2.7" cy="3.7" r="2.6"/><circle cx="-2.7" cy="3.7" r="2.6"/><circle cx="-4.3" cy="-1.4" r="2.6"/></g></g><g transform="translate(20 19) scale(.7)"><circle r="2.2" fill="#fff"/><g fill="#3aa17e"><circle cy="-4.5" r="2.6"/><circle cx="4.3" cy="-1.4" r="2.6"/><circle cx="2.7" cy="3.7" r="2.6"/><circle cx="-2.7" cy="3.7" r="2.6"/><circle cx="-4.3" cy="-1.4" r="2.6"/></g></g>'),
  },
  gingham: {
    name: 'віші', band: '#ffffff', accent: '#0e7c78',
    tile: P(12, 12, '<rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="#1fa5a0" opacity=".55"/><rect width="12" height="6" fill="#1fa5a0" opacity=".55"/>'),
  },
  denim: {
    name: 'денім', band: '#f2f6ff', accent: '#2b4a8f',
    tile: P(8, 8, '<rect width="8" height="8" fill="#3b5ba5"/><path d="M-2 2 l4 -4 M0 8 l8 -8 M6 10 l4 -4" stroke="#5677c4" stroke-width="2"/>'),
  },
  cord: {
    name: 'вельвет', band: '#fff6ee', accent: '#a8551d',
    tile: P(6, 6, '<rect width="6" height="6" fill="#c46a2b"/><rect width="3" height="6" fill="#a8551d"/>'),
  },
  sequin: {
    name: 'паєтки', band: '#fff0f7', accent: '#d6336c',
    tile: P(8, 8, '<defs><radialGradient id="q" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#ff8fc8"/><stop offset="1" stop-color="#b02a7a"/></radialGradient></defs><rect width="8" height="8" fill="#d6336c"/><circle cx="4" cy="4" r="3.6" fill="url(#q)"/>'),
  },
};

export const FABRIC_KEYS = Object.keys(FABRICS);

/** Тканина за коротким id малюнка — та сама щоразу, без запису в базу. */
export function fabricFor(publicId, stored = null) {
  if (stored && FABRICS[stored]) return stored;
  const n = parseInt(String(publicId || '0').slice(0, 6), 16) || 0;
  return FABRIC_KEYS[n % FABRIC_KEYS.length];
}

/** Самодостатній SVG із тканиною на весь розмір. */
export function fabricSvg(key, width = 600, height = 800) {
  const f = FABRICS[key] || FABRICS.tartan;
  const { w, h, body } = f.tile;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="p" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`;
}

export const fabricDataUri = (key, width, height) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fabricSvg(key, width, height))}`;

/** «Дизайнерка» / «Дизайнер» — як обрали батьки; не обрали — без слова. */
export const designerLabel = (w) => (w?.designer_word === 'дизайнерка' ? 'Дизайнерка' : w?.designer_word === 'дизайнер' ? 'Дизайнер' : '');
