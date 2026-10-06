// Середнє · латинський квадрат: сітка 3×3, у кожному рядку й стовпчику
// кожна фігура рівно 1 раз; одна клітинка — знак питання.
// Рядок 1: кружечок, трикутник, квадрат
// Рядок 2: трикутник, квадрат, кружечок
// Рядок 3: квадрат, ?, трикутник  → у стовпчику 2 бракує кружечка.
import { svg, rect, shape, unknown, SHAPE_COLOR, C } from '../art.js';

const CELL = 56;
const GX = (360 - CELL * 3) / 2; // сітка по центру
const GY = 16;
const R = 19; // радіус фігури в клітинці

// null — клітинка зі знаком питання.
const ROWS = [
  ['circle', 'triangle', 'square'],
  ['triangle', 'square', 'circle'],
  ['square', null, 'triangle'],
];

const center = (col, row) => [GX + col * CELL + CELL / 2, GY + row * CELL + CELL / 2];

const cells = ROWS.flatMap((row, r) =>
  row.map((kind, c) => {
    const [cx, cy] = center(c, r);
    const box = rect(GX + c * CELL, GY + r * CELL, CELL, CELL, C.white, 0, 3);
    const inner = kind ? shape(kind, cx, cy, R, SHAPE_COLOR[kind]) : unknown(cx, cy, 17);
    return box + inner;
  }),
).join('');

const art = svg(360, 200, cells);

// Варіанти — ті самі фігури, що й у сітці, плюс зірка як зайва.
const pic = (kind) => svg(120, 100, shape(kind, 60, 50, 28, SHAPE_COLOR[kind]));

export const task = {
  id: 'v12',
  tier: 2,
  q: 'У кожному рядку й у кожному стовпчику кожна фігура трапляється рівно 1 раз. Яка фігура ховається за знаком питання?',
  art,
  options: [{ art: pic('circle') }, { art: pic('triangle') }, { art: pic('square') }, { art: pic('star') }],
};
