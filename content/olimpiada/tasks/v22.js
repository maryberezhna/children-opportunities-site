// Складне · матриця 3×3: у кожному рядку — одна й та сама фігура,
// у кожному стовпчику — однакова кількість фігур; одна клітинка — знак питання.
// Рядок 1: 1, 2, 3 кружечки
// Рядок 2: 1, 2, 3 квадрати
// Рядок 3: 1, 2 трикутники, ?  → рядок 3 — трикутники, стовпчик 3 — по 3 фігури.
import { svg, rect, shape, unknown, SHAPE_COLOR, C } from '../art.js';

const CELL = 64;
const GX = (360 - CELL * 3) / 2; // сітка по центру
const GY = (200 - CELL * 3) / 2;
const R = 7; // радіус фігури в клітинці: 3 в ряд мають уміститися в 64 px із просвітами
const GAP = 20; // відстань між центрами сусідніх фігур у клітинці

// Маленька фігура з тоншим контуром (2.5 замість 3), щоб 3 в ряд не зливалися —
// той самий прийом, що й у unknown() в art.js.
const small = (kind, cx, cy, r) =>
  shape(kind, cx, cy, r, SHAPE_COLOR[kind]).replace('stroke-width="3"', 'stroke-width="2.5"');

// n однакових фігур у ряд із центром у (cx, cy).
const row = (kind, n, cx, cy, r, gap) =>
  Array.from({ length: n }, (_, i) => small(kind, cx + (i - (n - 1) / 2) * gap, cy, r)).join('');

const ROWS = ['circle', 'square', 'triangle'];
const COUNTS = [1, 2, 3];

const cells = ROWS.flatMap((kind, r) =>
  COUNTS.map((count, c) => {
    const x = GX + c * CELL;
    const y = GY + r * CELL;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const box = rect(x, y, CELL, CELL, C.white, 0, 3);
    const inner = r === 2 && c === 2 ? unknown(cx, cy, 18) : row(kind, count, cx, cy, R, GAP);
    return box + inner;
  }),
).join('');

const art = svg(360, 200, cells);

// Варіанти — такі самі ряди фігур, як у клітинках, лише більші.
const pic = (kind, n) => svg(120, 100, row(kind, n, 60, 50, 12, 32));

export const task = {
  id: 'v22',
  tier: 3,
  q: 'У кожному рядку одна й та сама фігура, а в кожному стовпчику однакова кількість фігур. Яка картинка має стояти замість знака питання?',
  art,
  options: [{ art: pic('triangle', 3) }, { art: pic('triangle', 2) }, { art: pic('square', 3) }, { art: pic('circle', 3) }],
};
