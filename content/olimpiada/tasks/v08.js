// Легке · лічба фігур: «Скільки всього трикутників на малюнку?»
// Великий жовтий трикутник і 1 лінія від верхньої вершини до середини основи.
// Разом 3: 2 малих + 1 великий. Нічого більше на малюнку немає.
import { svg, poly, line, C, INK } from '../art.js';

// Вершини великого трикутника: верхівка, лівий і правий кути основи.
const TOP = [180, 22];
const LEFT = [40, 182];
const RIGHT = [320, 182];
const BASE_MID = [(LEFT[0] + RIGHT[0]) / 2, LEFT[1]];

const big = poly([TOP, LEFT, RIGHT], C.yellow, 4);
const split = line(TOP[0], TOP[1], BASE_MID[0], BASE_MID[1], 4, INK);

export const task = {
  id: 'v08',
  tier: 1,
  q: 'Скільки всього трикутників на малюнку?',
  art: svg(360, 200, `${big}${split}`),
  options: ['2', '3', '4', '5'],
};
