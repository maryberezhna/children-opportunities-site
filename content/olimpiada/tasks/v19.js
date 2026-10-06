// Складне · числова машина: «× 2», потім «+ 1», на виході 15. Що зайшло?
// Розвʼязок у зворотний бік: (15 - 1) / 2 = 7.
import { svg, rect, circle, text, unknown, arrow, C } from '../art.js';

const CY = 70; // усе вирівняно по одній горизонталі

// Віконце машини з написом усередині («× 2» або «+ 1»).
// Назва slot, а не window: файл може потрапити в клієнтський бандл, де window — глобал.
const slot = (cx, label) =>
  `${rect(cx - 32, CY - 22, 64, 44, C.white, 8, 3)}${text(cx, CY + 10, label, 30)}`;

const machine = [
  rect(90, CY - 52, 180, 104, C.gray, 18, 3),
  // 3 вогники зверху — щоб машина виглядала машиною.
  circle(108, CY - 37, 5, C.red, 2),
  circle(124, CY - 37, 5, C.yellow, 2),
  circle(140, CY - 37, 5, C.green, 2),
  slot(134, '× 2'),
  arrow(180, CY, 'right', 10),
  slot(226, '+ 1'),
].join('');

const art = svg(360, 140, [
  unknown(34, CY, 20),
  arrow(70, CY, 'right', 13),
  machine,
  arrow(286, CY, 'right', 13),
  rect(306, CY - 22, 48, 44, C.paper, 8, 3),
  text(330, CY + 10, '15', 28),
].join(''));

export const task = {
  id: 'v19',
  tier: 3,
  q: 'Машина спочатку множить число на 2, а потім додає 1. Вийшло 15. Яке число зайшло в машину?',
  art,
  options: ['6', '7', '8', '14'],
};
