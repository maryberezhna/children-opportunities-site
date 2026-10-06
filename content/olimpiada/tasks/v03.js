// Легке · лічба: «Скільки всього кубиків у піраміді?» — 3 + 2 + 1 = 6.
import { svg, rect, line, C } from '../art.js';

// Піраміда з квадратиків (вид спереду): нижній ряд 3, над ним 2, нагорі 1.
// Квадрати 40x40 стоять щільно; центр піраміди — на середині малюнка.
const S = 40;
const cx = 180;
const bottom = 160;
const rows = [3, 2, 1];
const cubes = rows
  .map((count, row) => {
    const y = bottom - S * (row + 1);
    const x0 = cx - (S * count) / 2;
    return Array.from({ length: count }, (_, i) => rect(x0 + S * i, y, S, S, C.blue, 3)).join('');
  })
  .join('');

const art = svg(360, 200, `${line(70, bottom, 290, bottom, 4, C.gray)}${cubes}`);

export const task = {
  id: 'v03',
  tier: 1,
  q: 'Кубики склали в піраміду. Скільки всього кубиків у цій піраміді?',
  art,
  options: ['5', '6', '7', '9'],
};
