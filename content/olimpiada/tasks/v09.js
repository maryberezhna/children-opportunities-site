// Середнє · шифр: «Кожна фігура означає цифру. Яке число зашифровано?»
// Підказка (верхній рядок): зірка = 1, кружечок = 2, трикутник = 3.
// Повідомлення (нижній рядок у рамці): трикутник, кружечок, зірка — це 321.
import { svg, rect, text, shape, C } from '../art.js';

// Верхній рядок — підказка: 3 пари «фігура = цифра» рівномірно по ширині.
const HINT_Y = 46;
const HINT_R = 17;
const hint = [
  ['star', 1, C.purple],
  ['circle', 2, C.red],
  ['triangle', 3, C.yellow],
]
  .map(([kind, digit, fill], i) => {
    const cx = 44 + 120 * i;
    return `${shape(kind, cx, HINT_Y, HINT_R, fill)}${text(cx + 28, HINT_Y + 9, `= ${digit}`, 24, undefined, 'start')}`;
  })
  .join('');

// Нижній рядок — зашифроване число в рамці кольору паперу.
const FRAME = { x: 50, y: 92, w: 260, h: 96 };
const MSG_Y = FRAME.y + FRAME.h / 2;
const MSG_R = 22;
const message = [
  ['triangle', C.yellow],
  ['circle', C.red],
  ['star', C.purple],
]
  .map(([kind, fill], i) => shape(kind, 110 + 70 * i, MSG_Y, MSG_R, fill))
  .join('');

const art = svg(360, 200, `${hint}${rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h, C.paper, 14)}${message}`);

export const task = {
  id: 'v09',
  tier: 2,
  q: 'Кожна фігура означає цифру — дивись підказку вгорі. Яке число зашифровано в нижньому рядку?',
  art,
  options: ['123', '231', '312', '321'],
};
