// Легке · «Яка фігура без кутів?» — варіанти-картинки.
import { svg, shape, SHAPE_COLOR } from '../art.js';

const pic = (kind) => svg(120, 100, shape(kind, 60, 50, 30, SHAPE_COLOR[kind]));

export const task = {
  id: 'v01',
  tier: 1,
  q: 'Три фігури мають кути, а одна — ні. Яка фігура без кутів?',
  options: [{ art: pic('triangle') }, { art: pic('square') }, { art: pic('pentagon') }, { art: pic('circle') }],
};
