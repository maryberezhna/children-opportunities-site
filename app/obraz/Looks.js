// Модні ескізи-ПРИКЛАДИ для сторінки челенджу (11.10.2026). Це не роботи дітей:
// на сайті вони завжди з позначкою «Приклад» і без вигаданих імен
// (memory: нічого не вигадувати). Фігура — модельєрських пропорцій, одяг —
// з «тканин» lib/obraz-cover.js (візерунки f-<ключ> з <FabricDefs />).
import { FABRICS } from '@/lib/obraz-cover';

/** Візерунки тканин і «олівцевий» фільтр — один раз на сторінку. */
export function FabricDefs() {
  const defs = Object.entries(FABRICS).map(([k, f]) =>
    `<pattern id="f-${k}" width="${f.tile.w}" height="${f.tile.h}" patternUnits="userSpaceOnUse">${f.tile.body.replace('id="q"', `id="q-${k}"`).replace('url(#q)', `url(#q-${k})`)}</pattern>`).join('');
  const html = `<defs>${defs}<filter id="f-wob"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>`;
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

const S = 'stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const limb = (d, c) => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;

function base({ skin = '#f3d3b8', hair = '#3a2412', hairShape = 'bob', legs = '#f3d3b8', shoes = '#1a1a1a' }) {
  const hairs = {
    bob: `<path d="M84 36 q0 -26 16 -26 q16 0 16 26 l3 14 h-8 l-1 -12 q-10 4 -20 0 l-1 12 h-8z" fill="${hair}" ${S}/>`,
    bun: `<circle cx="100" cy="10" r="9" fill="${hair}" ${S}/><path d="M86 34 q2 -22 14 -22 q12 0 14 22 q-14 -8 -28 0z" fill="${hair}" ${S}/>`,
    short: `<path d="M86 30 q2 -20 14 -20 q14 0 15 20 q-6 -8 -15 -8 q-8 0 -14 8z" fill="${hair}" ${S}/>`,
    long: `<path d="M84 34 q0 -24 16 -24 q16 0 16 24 l6 50 q-8 6 -12 0 l-2 -44 q-8 4 -16 0 l-2 44 q-4 6 -12 0z" fill="${hair}" ${S}/>`,
  };
  return `
  <path d="M90 180 q-2 120 -12 240 M110 180 q4 120 22 238" fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linecap="round"/>
  <path d="M90 180 q-2 120 -12 240 M110 180 q4 120 22 238" fill="none" stroke="${legs}" stroke-width="8" stroke-linecap="round"/>
  <path d="M64 418 q0 -8 12 -8 h8 l2 12 h-24z M122 416 q2 -8 12 -6 l10 2 l2 12 h-24z" fill="${shoes}" ${S}/>
  <path d="M96 50 v14 M104 50 v14" ${S}/>
  ${limb('M74 74 q-14 50 -10 104', skin)}
  ${limb('M126 74 q18 40 4 70 q-6 12 -14 10', skin)}
  ${hairs[hairShape]}
  <ellipse cx="100" cy="36" rx="12.5" ry="16" fill="${skin}" ${S}/>
  <path d="M88 30 q12 -14 24 0 q-12 -6 -24 0z" fill="${hair}" ${S}/>
  <path d="M95 36 h2 M103 36 h2 M97 44 q3 2 6 0" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
}

const LOOKS = {
  tartan: () => base({ hair: '#5b3a29', hairShape: 'long', legs: '#1a1a1a' }) + `
    <path d="M72 66 q28 -10 56 0 l18 236 h-92z" fill="url(#f-tartan)" ${S}/>
    <path d="M100 66 v236 M86 66 l14 40 l14 -40" fill="none" ${S}/>
    <circle cx="94" cy="140" r="3" fill="#f5c518" ${S}/><circle cx="94" cy="180" r="3" fill="#f5c518" ${S}/><circle cx="94" cy="220" r="3" fill="#f5c518" ${S}/>
    <path d="M60 196 q-6 34 8 50 h22 q6 -18 -4 -50z" fill="#f5c518" ${S}/>
    <ellipse cx="102" cy="16" rx="20" ry="7" fill="#e2412b" ${S} transform="rotate(-10 102 16)"/><circle cx="104" cy="8" r="3" fill="#e2412b" ${S}/>`,
  polka: () => base({ hair: '#f5c518', hairShape: 'bun', legs: '#ffd3e0', shoes: '#e2412b' }) + `
    <path d="M84 66 q16 -6 32 0 l2 70 l46 150 q-74 18 -148 0 l46 -150z" fill="url(#f-polka)" ${S}/>
    <path d="M82 138 h36" stroke="#1a1a1a" stroke-width="8"/>
    <path d="M100 138 l-14 -10 v20z M100 138 l14 -10 v20z" fill="#1a1a1a"/>`,
  puffer: () => base({ hair: '#1a1a1a', hairShape: 'short', legs: '#7a3fbf', shoes: '#fff' }) + `
    <path d="M62 64 q38 -16 76 0 l10 112 h-96z" fill="url(#f-quilt)" ${S}/>
    <path d="M60 64 q-12 60 0 110 l12 -2 l6 -96 M140 64 q12 60 0 110 l-12 -2 l-6 -96" fill="url(#f-quilt)" ${S}/>
    <path d="M80 60 q20 12 40 0 l2 14 q-22 10 -44 0z" fill="#e2412b" ${S}/>
    <path d="M58 176 h84 l20 76 h-124z" fill="#0e5449" ${S}/>
    <path d="M70 176 l-8 76 M86 176 l-4 76 M100 176 v76 M114 176 l4 76 M130 176 l8 76" stroke="#14735f" stroke-width="3"/>
    <path d="M78 330 l-4 50 h16 l2 -48 M118 330 l10 50 h16 l-8 -48" fill="url(#f-knit)" ${S}/>`,
  denim: () => base({ hair: '#a3324a', hairShape: 'bob', legs: '#1a1a1a', shoes: '#2f7d63' }) + `
    <path d="M70 66 q30 -12 60 0 l8 110 h-76z" fill="url(#f-denim)" ${S}/>
    <rect x="80" y="100" width="22" height="20" fill="url(#f-flor)" ${S} transform="rotate(-8 91 110)"/>
    <rect x="106" y="138" width="22" height="18" fill="url(#f-gingham)" ${S} transform="rotate(10 117 147)"/>
    <path d="M62 176 h76 l10 96 h-96z" fill="url(#f-leo)" ${S}/>
    <path d="M70 380 h22 l2 40 h-26z M118 378 h22 l6 42 h-26z" fill="#2f7d63" ${S}/>
    <path d="M136 150 h30 l4 36 h-38z" fill="#f5c518" ${S}/><path d="M142 150 q9 -16 18 0" fill="none" ${S}/>`,
  sequin: () => base({ hair: '#3a2412', hairShape: 'long', legs: '#f3d3b8', shoes: '#fff' }) + `
    <path d="M84 70 q16 8 32 0 l6 80 l20 150 h-84 l20 -150z" fill="url(#f-sequin)" ${S}/>
    <path d="M74 300 q26 10 52 0" fill="none" stroke="#f5c518" stroke-width="4"/>`,
  breton: () => base({ hair: '#e8b04a', hairShape: 'short', legs: '#c46a2b' }) + `
    <path d="M72 66 q28 -10 56 0 l8 104 h-72z" fill="url(#f-breton)" ${S}/>
    <path d="M66 170 h68 l6 132 h-26 l-14 -100 l-14 100 h-26z" fill="url(#f-cord)" ${S}/>
    <path d="M86 32 h28" stroke="#1a1a1a" stroke-width="3"/><rect x="85" y="28" width="12" height="9" rx="3" fill="#1a1a1a"/><rect x="103" y="28" width="12" height="9" rx="3" fill="#1a1a1a"/>`,
};

export const EXAMPLE_LOOKS = [
  { key: 'tartan', title: 'Клітинка повертається', fabric: 'hound' },
  { key: 'sequin', title: 'Блиск на кожен день', fabric: 'quilt' },
  { key: 'puffer', title: 'Тепло й яскраво', fabric: 'breton' },
  { key: 'denim', title: 'Латки з характером', fabric: 'polka' },
];

export function Look({ look, className }) {
  const html = `<g filter="url(#f-wob)">${LOOKS[look]()}</g>`;
  return <svg viewBox="0 0 200 440" className={className} role="img" aria-label="Приклад модного ескізу" dangerouslySetInnerHTML={{ __html: html }} />;
}
