// Малюнки до завдань олімпіади — прості SVG-рядки, які складає сервер.
// Навіщо картинки: текстові завдання з 4 варіантами були «всі одноманітні»
// (Марія, 05.10.2026). За зразок узято «Кенгуру» й Bebras: там майже кожне
// завдання — з малюнком, а варіанти відповіді часто теж картинки.
//
// Усе намальовано фігурами, без шрифтових символів на кшталт ★ чи ↑: вони
// по-різному виглядають на різних телефонах.

export const INK = '#16307a';
export const C = {
  red: '#ff5a5f', blue: '#2f7df6', yellow: '#ffc93c', green: '#23b26d', purple: '#8b5cf6',
  orange: '#f5a023', pink: '#ff7ac0', gray: '#c9d4ea', sky: '#dbe8ff', white: '#ffffff', paper: '#fff7e0',
};

const n = (v) => Math.round(v * 10) / 10;

export const svg = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">${inner}</svg>`;

export const circle = (cx, cy, r, fill, sw = 3) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;

export const rect = (x, y, w, h, fill, rx = 6, sw = 3) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;

export const poly = (pts, fill, sw = 3) =>
  `<polygon points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;

export const line = (x1, y1, x2, y2, sw = 3, color = INK, dash = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

export const path = (d, fill = 'none', sw = 3, color = INK) =>
  `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const text = (x, y, s, size = 22, fill = INK, anchor = 'middle', weight = 700) =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="Manrope, Arial, sans-serif">${s}</text>`;

export function ngon(cx, cy, r, sides, fill, rot = -90) {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = ((rot + (360 / sides) * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return poly(pts, fill);
}

export function star(cx, cy, r, fill) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.45 : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
  return poly(pts, fill);
}

// Фігура за назвою — щоб ті самі фігури були і в умові, і у варіантах.
export function shape(kind, cx, cy, r, fill) {
  if (kind === 'circle') return circle(cx, cy, r, fill);
  if (kind === 'square') return rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, fill, 5);
  if (kind === 'triangle') return ngon(cx, cy + r * 0.15, r * 1.15, 3, fill);
  if (kind === 'pentagon') return ngon(cx, cy, r, 5, fill);
  if (kind === 'star') return star(cx, cy, r * 1.15, fill);
  return '';
}

export const SHAPE_COLOR = { circle: C.red, square: C.blue, triangle: C.yellow, pentagon: C.green, star: C.purple };

// Знак питання в рамці — «тут чогось бракує».
export const unknown = (cx, cy, r = 20) =>
  `${rect(cx - r, cy - r, r * 2, r * 2, C.white, 8, 3).replace('stroke-width="3"', 'stroke-width="3" stroke-dasharray="6 5"')}${text(cx, cy + r * 0.42, '?', r * 1.3, C.orange)}`;

// Стрілка-команда в клітинці: dir — up | right | down | left.
export function arrow(cx, cy, dir, size = 16, fill = C.orange) {
  const base = [[-size * 0.35, size], [-size * 0.35, 0], [-size, 0], [0, -size], [size, 0], [size * 0.35, 0], [size * 0.35, size]];
  const turn = { up: 0, right: 90, down: 180, left: 270 }[dir] || 0;
  const a = (turn * Math.PI) / 180;
  return poly(base.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]), fill, 2.5);
}

// Терези в рівновазі: left і right — функції (cx, cy) → вміст шальки.
export function balance(w, left, right) {
  const mid = w / 2;
  const beamY = 46;
  const panY = 118;
  const lx = mid - 110;
  const rx = mid + 110;
  const pan = (x) => `${line(x, beamY, x - 46, panY, 2.5)}${line(x, beamY, x + 46, panY, 2.5)}${path(`M ${x - 56} ${panY} Q ${x} ${panY + 26} ${x + 56} ${panY}`, C.gray)}`;
  return [
    poly([[mid - 34, 186], [mid + 34, 186], [mid, 150]], C.gray),
    line(mid, 150, mid, beamY, 5),
    line(lx, beamY, rx, beamY, 5),
    circle(mid, beamY, 7, C.orange),
    pan(lx), pan(rx),
    left(lx, panY - 4), right(rx, panY - 4),
  ].join('');
}

export const apple = (cx, cy, r = 17) =>
  `${circle(cx, cy, r, C.red)}${line(cx, cy - r, cx + 3, cy - r - 8, 3)}${path(`M ${cx + 3} ${cy - r - 6} q 9 -8 14 -1 q -8 6 -14 1z`, C.green, 2)}`;

export const pear = (cx, cy, r = 15) =>
  `${path(`M ${cx} ${cy - r * 1.7} c ${r * 0.7} 0 ${r * 0.6} ${r * 0.9} ${r} ${r * 1.5} c ${r * 0.6} ${r * 1.1} ${-r * 0.2} ${r * 1.5} ${-r} ${r * 1.5} c ${-r * 0.8} 0 ${-r * 1.6} ${-r * 0.4} ${-r} ${-r * 1.5} c ${r * 0.4} ${-r * 0.6} ${r * 0.3} ${-r * 1.5} ${r} ${-r * 1.5}z`, '#b7dd4b')}${line(cx, cy - r * 1.7, cx + 2, cy - r * 2.2, 3)}`;

// Серце й половинка серця (права) — для завдання про складений аркуш.
export const heart = (cx, cy, s, fill) =>
  path(`M ${n(cx)} ${n(cy + s * 0.9)} C ${n(cx - s * 1.5)} ${n(cy - s * 0.1)} ${n(cx - s * 0.6)} ${n(cy - s * 1.15)} ${n(cx)} ${n(cy - s * 0.35)} C ${n(cx + s * 0.6)} ${n(cy - s * 1.15)} ${n(cx + s * 1.5)} ${n(cy - s * 0.1)} ${n(cx)} ${n(cy + s * 0.9)} Z`, fill);

export const halfHeart = (cx, cy, s, fill) =>
  path(`M ${n(cx)} ${n(cy + s * 0.9)} L ${n(cx)} ${n(cy - s * 0.35)} C ${n(cx + s * 0.6)} ${n(cy - s * 1.15)} ${n(cx + s * 1.5)} ${n(cy - s * 0.1)} ${n(cx)} ${n(cy + s * 0.9)} Z`, fill);

export const smiley = (cx, cy, r, fill) =>
  `${circle(cx, cy, r, fill)}<circle cx="${n(cx - r * 0.35)}" cy="${n(cy - r * 0.2)}" r="${n(r * 0.11)}" fill="${INK}"/><circle cx="${n(cx + r * 0.35)}" cy="${n(cy - r * 0.2)}" r="${n(r * 0.11)}" fill="${INK}"/>${path(`M ${n(cx - r * 0.4)} ${n(cy + r * 0.25)} q ${n(r * 0.4)} ${n(r * 0.42)} ${n(r * 0.8)} 0`, 'none', 3)}`;

// Робот — головний герой завдань «виконай команди».
export const robot = (cx, cy, s = 18) =>
  `${rect(cx - s, cy - s * 0.8, s * 2, s * 1.7, C.gray, 6)}${line(cx, cy - s * 0.8, cx, cy - s * 1.3, 3)}${circle(cx, cy - s * 1.4, s * 0.2, C.red, 2)}<circle cx="${n(cx - s * 0.45)}" cy="${n(cy - s * 0.1)}" r="${n(s * 0.22)}" fill="${INK}"/><circle cx="${n(cx + s * 0.45)}" cy="${n(cy - s * 0.1)}" r="${n(s * 0.22)}" fill="${INK}"/>${line(cx - s * 0.4, cy + s * 0.5, cx + s * 0.4, cy + s * 0.5, 3)}`;
