// Складне · складений аркуш: «Біля згину вирізали половинку серця. Що побачимо, коли розгорнемо?»
// Варіанти — картинки розгорнутих аркушів; правильний — ціле серце по центру.
import { svg, rect, circle, line, path, text, heart, halfHeart, C } from '../art.js';

// Умова: складений навпіл аркуш 150x170 з лівим краєм-згином (червоний пунктир)
// і вирізаною біля згину половинкою серця (просвічує білим).
const SHEET = { x: 120, y: 15, w: 150, h: 170 };
const FOLD_X = SHEET.x;
const CY = SHEET.y + SHEET.h / 2;
const R = SHEET.x + SHEET.w;

// Аркуш без лівого обведення: заливка + 3 обведені сторони (кути праворуч скруглені на 4).
const foldedSheet = [
  rect(SHEET.x, SHEET.y, SHEET.w, SHEET.h, C.paper, 4, 0),
  path(`M ${FOLD_X} ${SHEET.y} H ${R - 4} Q ${R} ${SHEET.y} ${R} ${SHEET.y + 4} V ${SHEET.y + SHEET.h - 4} Q ${R} ${SHEET.y + SHEET.h} ${R - 4} ${SHEET.y + SHEET.h} H ${FOLD_X}`, 'none', 3),
  line(FOLD_X, SHEET.y, FOLD_X, SHEET.y + SHEET.h, 4, C.red, '10 7'),
  text(FOLD_X - 12, CY + 6, 'згин', 16, C.red, 'end'),
  halfHeart(FOLD_X, CY, 34, C.white),
].join('');

const art = svg(360, 200, foldedSheet);

// Варіанти: розгорнутий аркуш 100x64 по центру картинки 120x100.
const opened = (inner) => svg(120, 100, `${rect(10, 18, 100, 64, C.paper, 4)}${inner}`);

export const task = {
  id: 'v18',
  tier: 3,
  q: 'Аркуш паперу склали навпіл і біля згину вирізали фігуру. Згин позначено пунктиром. Що побачимо, коли розгорнемо аркуш?',
  art,
  options: [
    { art: opened(heart(60, 50, 14, C.white)) },
    { art: opened(halfHeart(60, 50, 14, C.white)) },
    { art: opened(`${heart(36, 50, 14, C.white)}${heart(84, 50, 14, C.white)}`) },
    { art: opened(circle(60, 50, 14, C.white)) },
  ],
};
