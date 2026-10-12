// «Модний код» — фігурка й речі для онлайн-студії образу (12.10.2026).
// Перенесено з прототипу, який Марія схвалила («ой ну клас»). Усе малюється
// рядками SVG: та сама фігурка йде і в студію, і на обкладинку.
// Чиста логіка без React — її перевіряє tests/modnyi-kod.test.mjs.

export const FABRICS = [['tartan','шотландка'],['hound','гусяча лапка'],['polka','горох'],['breton','смужка'],['knit','вʼязка'],['quilt','ромби'],['denim','денім'],['leo','леопард'],['flor','квіти'],['gingham','віші'],['cord','вельвет'],['sequin','паєтки'],['metal','металік']];
export const PAL= [['#6b2d5c','СЛИВА · тренд'],['#7a1f2b','БОРДО · тренд'],['#5b3a29','ШОКОЛАД · тренд'],['#2e3a87','ІНДИГО · тренд'],['#c8501a','ГАРБУЗ'],['#7a3fbf','ЧОРНИЦЯ'],['#1fa5a0','МОРСЬКА ХВИЛЯ'],['#f5c518','КУЛЬБАБА'],['#e2412b','ТОМАТ'],['#161616','ВУГІЛЛЯ'],['#ffffff','МОЛОКО'],['#2b4a8f','ДЕНІМ']];

const S = 'stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
export const fill = (v) => (String(v).startsWith('#') ? v : `url(#${v})`);
export const PIECES = {
  base: { label: 'Основа', opts: { dress1: 'Сукня коротка', dress2: 'Сукня довга', set: 'Верх + низ' } },
  top: { label: 'Верх', opts: { tee: 'Футболка', longsleeve: 'Лонгслів', oversize: 'Светр оверсайз', hoodie: 'Худі', shirt: 'Сорочка', jersey: 'Футбольна джерсі', track: 'Олімпійка' } },
  bottom: { label: 'Низ', opts: { skirt: 'Спідниця', pleat: 'Плісе', pants: 'Штани', balloon: 'Джинси-бульбашки' } },
  outer: { label: 'Верхній одяг', opts: { none: 'Без', coat: 'Пальто', bomber: 'Бомбер', vest: 'Жилет' } },
  shoes: { label: 'Взуття', opts: { sneak: 'Кеди', boots: 'Черевики', mary: 'Туфлі', loafer: 'Лофери', block: 'Підбор-блок', heels: 'Шпилька' } },
  acc: { label: 'Аксесуар', opts: { none: 'Без', beret: 'Берет', beanie: 'Біні', headphones: 'Навушники', bag: 'Сумка', glasses: 'Окуляри', scarf: 'Шарф' } },
};

// Стан образу, з якого зараз малюємо (рядки будуються синхронно).
let ST = null;
// Рукав іде вздовж руки: товста лінія з тканиною поверх чорного контуру.
const sleeve = (d, f, w) => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="${w + 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${f}" stroke-width="${w}" stroke-linecap="round"/>`;
// Стопи фігурки: кінці ніг (lib: ноги з 90,180→78,420 і 110,180→132,418).
const feet = (svg) => `<g transform="translate(78 418) scale(-1 1)">${svg}</g><g transform="translate(132 416)">${svg}</g>`;
const pumpBase = (f) => `<path d="M-4 -2 C 2 1, 9 7, 17 10 L19 13 C 12 12, 4 9, -3 5 Z" fill="${ST ? ST.f.legs : "#161616"}" ${S}/><path d="M-7 -5 C -9 0, -9 4, -7 6.5 C -1 8, 7 12, 15 15 C 19 16.5, 24 16, 25 13.5 C 25.5 11.5, 23 10, 19 9.5 C 15 9, 11 8.5, 8 7 C 4 5, 1 2, -1 -1 C -3 -3, -5 -5, -7 -5 Z" fill="${f}" ${S}/>`;
const hand = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="6.5" fill="#f3d3b8" ${S}/>`;
export const shape = {
  longsleeve: (f) => `<path d="M76 64 q24 -9 48 0 l5 120 h-58z" fill="${f}" ${S}/>`
    + sleeve('M75 72 q-14 50 -11 90', f, 13) + sleeve('M125 72 q18 40 5 62', f, 13)
    + hand(63, 170) + hand(121, 151)
    + `<path d="M88 62 q12 7 24 0" fill="none" ${S}/>`,
  oversize: (f) => `<path d="M54 66 q46 -20 92 0 l6 126 h-104z" fill="${f}" ${S}/>`
    + `<path d="M50 182 h100 l-1 14 h-98z" fill="${f}" ${S}/><path d="M56 183 v12 M64 183 v12 M72 183 v12 M80 183 v12 M88 183 v12 M96 183 v12 M104 183 v12 M112 183 v12 M120 183 v12 M128 183 v12 M136 183 v12 M144 183 v12" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>`
    + sleeve('M58 76 q-14 52 -8 94', f, 24) + sleeve('M142 76 q14 52 8 94', f, 24)
    + `<path d="M44 164 h14 M142 164 h14" stroke="#1a1a1a" stroke-width="2"/>`
    + hand(52, 182) + hand(149, 182)
    + `<path d="M84 60 q16 11 32 0" fill="none" ${S}/><path d="M87 64 q13 7 26 0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>`,
  shirt: (f) => `<path d="M76 64 q24 -9 48 0 l5 120 h-58z" fill="${f}" ${S}/>`
    + sleeve('M75 72 q-14 50 -11 90', f, 13) + sleeve('M125 72 q18 40 5 62', f, 13) + hand(63, 170) + hand(121, 151)
    + `<path d="M100 62 L88 56 L86 70 Z M100 62 L112 56 L114 70 Z" fill="${f}" ${S}/><path d="M100 64 V182" ${S}/><circle cx="103" cy="90" r="1.6" fill="#1a1a1a"/><circle cx="103" cy="115" r="1.6" fill="#1a1a1a"/><circle cx="103" cy="140" r="1.6" fill="#1a1a1a"/>`,
  jersey: (f) => `<path d="M72 66 q28 -10 56 0 l9 118 h-74z" fill="${f}" ${S}/><path d="M72 66 l-14 40 l14 5 M128 66 l14 40 l-14 5" fill="${f}" ${S}/>`
    + `<path d="M90 60 L100 76 L110 60" fill="none" stroke="#fff" stroke-width="4"/><path d="M90 60 L100 76 L110 60" fill="none" ${S}/><path d="M60 100 l14 5 M140 100 l-14 5" stroke="#fff" stroke-width="3"/>`
    + `<text x="100" y="128" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="900" font-size="26" fill="#fff" stroke="#1a1a1a" stroke-width="1.6">10</text>`,
  track: (f) => `<path d="M76 64 q24 -9 48 0 l5 120 h-58z" fill="${f}" ${S}/>`
    + sleeve('M75 72 q-14 50 -11 90', f, 13) + sleeve('M125 72 q18 40 5 62', f, 13)
    + `<path d="M75 72 q-14 50 -11 90 M125 72 q18 40 5 62" fill="none" stroke="#fff" stroke-width="2.5"/>`
    + hand(63, 170) + hand(121, 151) + `<path d="M88 58 h24 v8 h-24z" fill="${f}" ${S}/><path d="M100 58 V182" stroke="#fff" stroke-width="2"/><path d="M100 58 V182" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2 2"/>`,
  balloon: (f) => `<path d="M73 172 H127 C 158 230 158 352 140 404 H116 L100 222 L94 404 H66 C 46 352 44 230 73 172 Z" fill="${f}" ${S}/><path d="M73 180 H127" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M86 230 q-10 80 -4 160 M114 230 q10 80 4 160" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`,
  bomber: (f) => `<path d="M60 64 q40 -16 80 0 l6 106 h-92z" fill="${f}" ${S}/><path d="M54 166 h92 l-1 14 h-90z" fill="${f}" ${S}/><path d="M60 167 v12 M70 167 v12 M80 167 v12 M90 167 v12 M100 167 v12 M110 167 v12 M120 167 v12 M130 167 v12 M140 167 v12" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>`
    + sleeve('M60 74 q-14 52 -8 92', f, 24) + sleeve('M140 74 q14 52 8 92', f, 24) + hand(52, 178) + hand(148, 178)
    + `<path d="M100 60 V180" ${S}/><path d="M88 58 q12 6 24 0" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="3"/>`,
  dress1: (f) => `<path d="M84 64 q16 -6 32 0 l2 18 l-3 46 l32 98 q-48 12 -96 0 l32 -98 l-3 -46z" fill="${f}" ${S}/><path d="M85 128 h30" stroke="rgba(0,0,0,.4)" stroke-width="2.5"/>`,
  dress2: (f) => `<path d="M84 70 q16 8 32 0 l6 80 l20 150 h-84 l20 -150z" fill="${f}" ${S}/>`,
  tee: (f) => `<path d="M72 66 q28 -10 56 0 l9 118 h-74z" fill="${f}" ${S}/><path d="M72 66 l-12 40 l12 4 M128 66 l12 40 l-12 4" fill="${f}" ${S}/>`,
  sweater: (f) => `<path d="M62 64 q38 -16 76 0 l10 120 h-96z" fill="${f}" ${S}/><path d="M60 64 q-12 60 0 110 l12 -2 l6 -96 M140 64 q12 60 0 110 l-12 -2 l-6 -96" fill="${f}" ${S}/>`,
  hoodie: (f) => `<path d="M68 66 q32 -12 64 0 l10 118 h-84z" fill="${f}" ${S}/><path d="M68 66 l-22 92 l14 4 l18 -74 M132 66 l22 92 l-14 4 l-18 -74" fill="${f}" ${S}/><path d="M82 138 h36 l6 26 h-48z" fill="none" ${S}/><path d="M84 62 q16 -14 32 0" fill="none" ${S}/>`,
  skirt: (f) => `<path d="M73 176 h54 l22 96 h-98z" fill="${f}" ${S}/><path d="M73 182 h54" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`,
  pleat: (f) => `<path d="M72 176 h56 l34 78 h-124z" fill="${f}" ${S}/><path d="M83 178 l-14 76 M94 178 l-6 76 M106 178 l6 76 M117 178 l14 76" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`,
  pants: (f) => `<path d="M73 172 H127 L148 404 H116 L100 218 L94 404 H62 Z" fill="${f}" ${S}/>`,
  coat: (f) => `<path d="M62 64 q38 -14 76 0 l34 240 h-144z" fill="${f}" ${S}/><path d="M100 68 v236" ${S}/><path d="M92 62 L100 92 L108 62" fill="none" ${S}/><circle cx="106" cy="120" r="2.2" fill="#1a1a1a"/><circle cx="106" cy="160" r="2.2" fill="#1a1a1a"/>`
    + sleeve('M60 74 q-14 52 -8 92', f, 26) + sleeve('M140 74 q14 52 8 92', f, 26) + hand(52, 178) + hand(148, 178),
  vest: (f) => `<path d="M74 66 q12 -6 18 0 l-4 110 h-22z M126 66 q-12 -6 -18 0 l4 110 h22z" fill="${f}" ${S}/>`,
  sneak: (f) => feet(`<path d="M-9 -15 Q-12 -3 -11 2 L23 2 Q25 -5 16 -7 L7 -10 Q3 -15 -9 -15 Z" fill="#fff" ${S}/>
    <path d="M-12 2 L24 2 Q25 8 20 8 L-9 8 Q-13 8 -12 2 Z" fill="${f.startsWith('#') ? f : '#e2412b'}" ${S}/>
    <path d="M0 -11 l6 3 M3 -13 l6 3 M14 -6 q4 2 6 6" stroke="#1a1a1a" stroke-width="1.6" fill="none"/>`),
  boots: (f) => feet(`<path d="M-9 -44 L8 -44 L9 -10 L-9 -10 Z" fill="${f}" ${S}/>
    <path d="M-9 -12 L9 -12 Q12 -6 22 -3 Q27 0 25 3 L-11 3 Q-12 -4 -9 -12 Z" fill="${f}" ${S}/>
    <path d="M-12 3 L26 3 L25 8 L-11 8 Z" fill="#1a1a1a"/><path d="M1 -40 L3 -14" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`),
  mary: (f) => feet(`<path d="M-9 -9 Q-11 -1 -10 2 L21 2 Q24 -3 16 -6 L4 -9 Z" fill="${f}" ${S}/>
    <path d="M-11 2 L22 2 L21 6 L-10 6 Z" fill="#1a1a1a"/><path d="M-4 -10 L7 -7" stroke="#1a1a1a" stroke-width="2.4"/><circle cx="7" cy="-7" r="1.8" fill="#f5c518"/>`),
  // Туфлі-човники збоку: стопу в колготах видно у вирізі; підбор — шпилька або блок.
  heels: (f) => feet(pumpBase(f) + `<path d="M-7.5 6 L-3.5 6.5 L-4.8 17 L-6.4 17 Z" fill="${f}" ${S}/><path d="M-7.2 17.2 h3.4" stroke="#1a1a1a" stroke-width="2"/><path d="M9 9.2 C 13 10.6, 18 11.5, 22.5 12.5" stroke="rgba(255,255,255,.55)" stroke-width="1.2" fill="none"/>`),
  loafer: (f) => feet(`<path d="M-9 -9 Q-11 -1 -10 2 L21 2 Q24 -3 16 -6 L4 -9 Z" fill="${f}" ${S}/><path d="M-11 2 L22 2 L21 6 L-10 6 Z" fill="#1a1a1a"/><path d="M-11 0 L-6 0 L-6 7 L-11 7 Z" fill="#1a1a1a"/><path d="M2 -8.5 Q8 -6 13 -4" stroke="#1a1a1a" stroke-width="2.4" fill="none"/><rect x="5" y="-8" width="4" height="2.6" rx="1" fill="#f5c518"/>`),
  block: (f) => feet(pumpBase(f) + `<path d="M-8 6 L-2 7 L-2.5 16.5 L-7.5 16.5 Z" fill="${f}" ${S}/><path d="M-8.2 16.8 h6.4" stroke="#1a1a1a" stroke-width="2"/><path d="M-3 1 C 0 3, 3 4, 6 4.5" stroke="#1a1a1a" stroke-width="1.6" fill="none"/><circle cx="6" cy="4.5" r="1.2" fill="#f5c518"/>`),
  beanie: (f) => `<path d="M85 31 q0 -24 15 -24 q15 0 15 24z" fill="${f}" ${S}/><path d="M83 26 h34 q2 0 2 3 v5 q0 3 -2 3 h-34 q-2 0 -2 -3 v-5 q0 -3 2 -3z" fill="${f}" ${S}/><path d="M87 27 v9 M92 27 v9 M97 27 v9 M102 27 v9 M107 27 v9 M112 27 v9" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>`,
  headphones: (f) => `<path d="M83 36 q-2 -32 17 -32 q19 0 17 32" fill="none" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/><path d="M83 36 q-2 -32 17 -32 q19 0 17 32" fill="none" stroke="${f}" stroke-width="3" stroke-linecap="round"/><rect x="77" y="30" width="10" height="16" rx="4" fill="${f}" ${S}/><rect x="113" y="30" width="10" height="16" rx="4" fill="${f}" ${S}/>`,
  beret: (f) => `<ellipse cx="102" cy="14" rx="21" ry="7" fill="${f}" ${S} transform="rotate(-10 102 14)"/><circle cx="104" cy="6" r="3" fill="${f}" ${S}/>`,
  bag: (f) => `<path d="M93 50 Q85 52 84 60 L134 166" fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"/><path d="M93 50 Q85 52 84 60 L134 166" fill="none" stroke="${f}" stroke-width="2.5" stroke-linecap="round"/><path d="M120 164 h30 q3 0 3 3 v22 q0 3 -3 3 h-30 q-3 0 -3 -3 v-22 q0 -3 3 -3z" fill="${f}" ${S}/><path d="M117 172 q18 8 36 0" fill="none" ${S}/><circle cx="135" cy="177" r="2.5" fill="#f5c518" stroke="#1a1a1a" stroke-width="1.2"/>`,
  glasses: () => `<path d="M86 34 h28" stroke="#1a1a1a" stroke-width="3"/><rect x="85" y="30" width="12" height="9" rx="3" fill="#1a1a1a"/><rect x="103" y="30" width="12" height="9" rx="3" fill="#1a1a1a"/>`,
  scarf: (f) => `<path d="M84 54 q16 12 32 0 l4 13 q-20 13 -40 0z" fill="${f}" ${S}/><path d="M106 66 l14 54 l-12 3 l-10 -54z" fill="${f}" ${S}/>`,
};

function body() {
  const legs = ST.f.legs, skin = '#f3d3b8', hair = '#5b3a29';
  const limb = (d) => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${skin}" stroke-width="6" stroke-linecap="round"/>`;
  return `<path d="M90 180 q-2 120 -12 240 M110 180 q4 120 22 238" fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linecap="round"/>
  <path d="M90 180 q-2 120 -12 240 M110 180 q4 120 22 238" fill="none" stroke="${legs}" stroke-width="8" stroke-linecap="round"/>
  <path d="M95 48 h10 v18 h-10z" fill="${skin}" ${S}/><path d="M86 54 h28 l10 14 h-48z" fill="${skin}"/><path d="M78 66 q22 -8 44 0 l-2 46 h-40z" fill="${skin}" ${S}/>${limb('M74 74 q-14 50 -10 104')}${limb('M126 74 q18 40 4 70 q-6 12 -14 10')}
  <path d="M84 34 q0 -24 16 -24 q16 0 16 24 l6 50 q-8 6 -12 0 l-2 -44 q-8 4 -16 0 l-2 44 q-4 6 -12 0z" fill="${hair}" ${S}/>
  <ellipse cx="100" cy="36" rx="12.5" ry="16" fill="${skin}" ${S}/><path d="M88 30 q12 -14 24 0 q-12 -6 -24 0z" fill="${hair}" ${S}/>
  <path d="M95 36 h2 M103 36 h2 M97 44 q3 2 6 0" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
}

/** Образ рядком SVG. live — кожна річ із data-part, щоб її можна було тапнути. */
export function lookSvg(st, { live = false, selected = null } = {}) {
  ST = st;
  const part = (k, svg) => (live ? `<g class="mk-part${selected === k ? ' sel' : ''}" data-part="${k}">${svg}</g>` : svg);
  // Взуття — одразу після тіла: штани й довгі речі лягають поверх нього.
  let g = body() + part('shoes', shape[st.shoes](fill(st.f.shoes)));
  if (st.base === 'set') g += part('bottom', shape[st.bottom](fill(st.f.bottom))) + part('top', shape[st.top](fill(st.f.top)));
  else g += part('base', shape[st.base](fill(st.f.base)));
  if (st.outer !== 'none') g += part('outer', shape[st.outer](fill(st.f.outer)));
  if (st.acc !== 'none') g += part(st.acc === 'glasses' ? 'none' : 'acc', shape[st.acc](fill(st.f.acc)));
  ST = null;
  return `<g filter="url(#mk-wob)">${g}</g>`;
}

/** Що можна фарбувати зараз (залежить від обраних речей). */
export function targets(st) {
  const t = st.base === 'set' ? [['top', 'Верх'], ['bottom', 'Низ']] : [['base', 'Сукня']];
  if (st.outer !== 'none') t.push(['outer', 'Верхній одяг']);
  t.push(['shoes', 'Взуття']);
  if (st.acc !== 'none' && st.acc !== 'glasses') t.push(['acc', 'Аксесуар']);
  t.push(['legs', 'Колготи']);
  return t;
}

/** Візерунки з тесту, що є в образі (а не просто кольори). */
export function usedPatterns(st) {
  const keys = st.base === 'set' ? ['top', 'bottom'] : ['base'];
  if (st.outer !== 'none') keys.push('outer');
  keys.push('shoes');
  if (st.acc !== 'none') keys.push('acc');
  const names = Object.fromEntries(FABRICS);
  return [...new Set(keys.map((k) => st.f[k]).filter((v) => names[v]))].map((v) => names[v]);
}

export const DEFAULT_LOOK = {
  base: 'set', top: 'oversize', bottom: 'pleat', outer: 'none', shoes: 'boots', acc: 'beret',
  f: { base: 'polka', top: 'quilt', bottom: 'tartan', outer: 'hound', shoes: '#161616', acc: '#e2412b', legs: '#161616', cover: 'tartan' },
};

/** Перевірка збереженого в браузері образу: лише відомі речі й тканини. */
export function cleanLook(raw) {
  const ok = (k, v) => Object.prototype.hasOwnProperty.call(PIECES[k].opts, v);
  const colors = new Set([...PAL.map(([c]) => c), ...FABRICS.map(([k]) => k)]);
  const out = JSON.parse(JSON.stringify(DEFAULT_LOOK));
  if (!raw || typeof raw !== 'object') return out;
  for (const k of ['base', 'top', 'bottom', 'outer', 'shoes', 'acc']) if (ok(k, raw[k])) out[k] = raw[k];
  for (const k of Object.keys(out.f)) if (colors.has(raw.f?.[k])) out.f[k] = raw.f[k];
  return out;
}

// Візерунки тканин + «олівцевий» фільтр — один раз на сторінку.
export const DEFS = `
    <filter id="mk-wob"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .18"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
    <!-- шотландська клітинка -->
    <pattern id="tartan" width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="#b3202a"/>
      <rect y="9" width="28" height="10" fill="#1d4d3a" opacity=".75"/><rect x="9" width="10" height="28" fill="#1d4d3a" opacity=".75"/>
      <rect y="3" width="28" height="2" fill="#f5c518"/><rect x="3" width="2" height="28" fill="#f5c518"/>
      <rect y="23" width="28" height="1" fill="#fff" opacity=".7"/><rect x="23" width="1" height="28" fill="#fff" opacity=".7"/>
    </pattern>
    <!-- гусяча лапка -->
    <pattern id="hound" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#f4efe6"/>
      <path d="M0 0h6v6H0z M6 6l3-3h3L6 9z M0 6l3 3v3L0 9z M6 0l3 3 3-3z" fill="#1a1a1a"/>
    </pattern>
    <!-- горох -->
    <pattern id="polka" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#e2412b"/><circle cx="4" cy="4" r="3" fill="#fff"/><circle cx="12" cy="12" r="3" fill="#fff"/>
    </pattern>
    <!-- тільняшка -->
    <pattern id="breton" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#fff"/><rect y="0" width="12" height="5" fill="#1b2a5e"/>
    </pattern>
    <!-- вʼязка -->
    <pattern id="knit" width="12" height="10" patternUnits="userSpaceOnUse">
      <rect width="12" height="10" fill="#7a3fbf"/>
      <path d="M0 0 l3 8 l3 -8 M6 0 l3 8 l3 -8" fill="none" stroke="#a678e0" stroke-width="2.2"/>
    </pattern>
    <!-- ромби (стьобана тканина) -->
    <pattern id="quilt" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#f5c518"/><path d="M0 10 L10 0 L20 10 L10 20Z" fill="none" stroke="#c99a00" stroke-width="1.6"/>
      <circle cx="10" cy="10" r="5" fill="#ffe680" opacity=".6"/>
    </pattern>
    <!-- денім -->
    <pattern id="denim" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
      <rect width="6" height="6" fill="#3b5ba5"/><rect width="2" height="6" fill="#5677c4"/>
    </pattern>
    <!-- леопард -->
    <pattern id="leo" width="44" height="44" patternUnits="userSpaceOnUse">
      <rect width="44" height="44" fill="#e8b04a"/>
      <g fill="none" stroke="#3a2412" stroke-width="3.2" stroke-linecap="round">
        <path d="M6 8 q4 -5 9 0 M8 14 q-3 -2 -2 -5"/><path d="M28 6 q5 -3 8 2 q0 5 -6 4"/><path d="M14 30 q6 -4 10 1 M12 34 q2 4 7 3"/><path d="M34 28 q4 -2 6 3 q-1 4 -5 4"/>
      </g>
      <g fill="#7a4a1c"><circle cx="11" cy="10" r="2.3"/><circle cx="32" cy="9" r="2.3"/><circle cx="18" cy="33" r="2.3"/><circle cx="37" cy="31" r="2.3"/></g>
    </pattern>
    <!-- паєтки -->
    <radialGradient id="sq" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#ff8fc8"/><stop offset="1" stop-color="#b02a7a"/></radialGradient>
    <pattern id="sequin" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#d6336c"/><circle cx="4" cy="4" r="3.6" fill="url(#sq)"/>
    </pattern>
    <!-- квіти -->
    <pattern id="flor" width="26" height="26" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" fill="#ffd3e0"/>
      <g transform="translate(7 7)"><circle r="2.2" fill="#f5c518"/><g fill="#e85d24"><circle cx="0" cy="-4.5" r="2.6"/><circle cx="4.3" cy="-1.4" r="2.6"/><circle cx="2.7" cy="3.7" r="2.6"/><circle cx="-2.7" cy="3.7" r="2.6"/><circle cx="-4.3" cy="-1.4" r="2.6"/></g></g>
      <g transform="translate(20 19) scale(.7)"><circle r="2.2" fill="#fff"/><g fill="#3aa17e"><circle cx="0" cy="-4.5" r="2.6"/><circle cx="4.3" cy="-1.4" r="2.6"/><circle cx="2.7" cy="3.7" r="2.6"/><circle cx="-2.7" cy="3.7" r="2.6"/><circle cx="-4.3" cy="-1.4" r="2.6"/></g></g>
    </pattern>
    <!-- віші -->
    <pattern id="gingham" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="#1fa5a0" opacity=".55"/><rect width="12" height="6" fill="#1fa5a0" opacity=".55"/>
    </pattern>
    <!-- металік: срібло з голографічним відливом (тренд осені 2026) -->
    <linearGradient id="metalg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f8"/><stop offset=".3" stop-color="#b9c3d3"/><stop offset=".5" stop-color="#efe3ff"/><stop offset=".7" stop-color="#c3efe9"/><stop offset="1" stop-color="#d9dce4"/></linearGradient>
    <pattern id="metal" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="url(#metalg)"/><path d="M0 24 L24 0" stroke="#fff" stroke-opacity=".7" stroke-width="2"/><circle cx="6" cy="6" r="1.4" fill="#fff"/><circle cx="18" cy="16" r="1" fill="#fff"/></pattern>
    <!-- плісе -->
    <pattern id="pleat" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#0e5449"/><rect width="4" height="10" fill="#14735f"/>
    </pattern>
    <!-- вельвет -->
    <pattern id="cord" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#c46a2b"/><rect width="3" height="6" fill="#a8551d"/>
    </pattern>
  `;
