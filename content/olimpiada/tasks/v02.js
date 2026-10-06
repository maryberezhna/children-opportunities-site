// Легке · візерунок «намистини на нитці» — варіанти-картинки.
// Ряд: червона, синя, синя, червона, синя, синя, червона, далі знак питання.
import { svg, circle, line, unknown, C } from '../art.js';

const BEAD_R = 17;
const STEP = 40;
const Y = 60;
const beads = [C.red, C.blue, C.blue, C.red, C.blue, C.blue, C.red];

const thread = line(10, Y, 350, Y, 3);
const row = beads.map((fill, i) => circle(40 + STEP * i, Y, BEAD_R, fill)).join('');
const next = unknown(40 + STEP * beads.length, Y, 20);

const pic = (fill) => svg(120, 100, circle(60, 50, 28, fill));

export const task = {
  id: 'v02',
  tier: 1,
  q: 'Намистини йдуть за правилом. Яка намистина має бути наступною?',
  art: svg(360, 120, `${thread}${row}${next}`),
  options: [{ art: pic(C.red) }, { art: pic(C.blue) }, { art: pic(C.yellow) }, { art: pic(C.green) }],
};
