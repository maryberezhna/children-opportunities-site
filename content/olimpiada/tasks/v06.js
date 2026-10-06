// Легке · «Прапорець перед дзеркалом» — відображення у вертикальному дзеркалі.
// Дзеркало міняє лише ліво-право: прапорець лишається вгорі, але дивиться в інший бік.
import { svg, circle, rect, poly, line, text, unknown, C } from '../art.js';

// Прапорець на держалні: dir — куди дивиться трикутник (left | right),
// pos — де він на держалні (top | bottom). Підставка знизу показує, де низ.
function flagpole(cx, yTop, yBottom, dir, pos, fw, fh) {
  const sign = dir === 'left' ? -1 : 1;
  const y0 = pos === 'top' ? yTop : yBottom - fh - 8;
  const y1 = y0 + fh;
  return [
    rect(cx - 16, yBottom - 4, 32, 8, C.gray, 3, 2.5),
    line(cx, yBottom - 4, cx, yTop, 4),
    circle(cx, yTop, 4.5, C.yellow, 2),
    poly([[cx, y0], [cx + sign * fw, (y0 + y1) / 2], [cx, y1]], C.red),
  ].join('');
}

const art = svg(360, 200, [
  flagpole(118, 40, 176, 'right', 'top', 72, 52),
  line(240, 34, 240, 184, 4, C.blue, '8 6'),
  text(240, 24, 'дзеркало', 16, C.blue),
  unknown(306, 108, 22),
].join(''));

const pic = (dir, pos) => svg(120, 100, flagpole(60, 14, 92, dir, pos, 40, 32));

export const task = {
  id: 'v06',
  tier: 1,
  q: 'Прапорець поставили перед дзеркалом. Яке його відображення ми побачимо в дзеркалі?',
  art,
  options: [
    { art: pic('left', 'top') },
    { art: pic('right', 'top') },
    { art: pic('right', 'bottom') },
    { art: pic('left', 'bottom') },
  ],
};
