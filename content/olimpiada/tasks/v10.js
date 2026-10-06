// Середнє · числова піраміда: число на цеглинці — сума двох цеглинок під нею.
// Нижній ряд 3, 5, 2; середній 8, 7; верхня цеглинка — знак питання.
import { svg, rect, text, C } from '../art.js';

const BW = 70; // ширина цеглинки
const BH = 44; // висота цеглинки
const GAP = 8; // проміжок між цеглинками
const MID = 180; // середина малюнка по горизонталі

// Ряд цеглинок, вирівняний по центру: row 0 — верх, 2 — низ.
const rowY = (row) => 18 + row * (BH + GAP);
const brickX = (row, i, count) => MID - (count * BW + (count - 1) * GAP) / 2 + i * (BW + GAP);

const brick = (row, i, count, value) => {
  const x = brickX(row, i, count);
  const y = rowY(row);
  return `${rect(x, y, BW, BH, C.paper, 8, 3)}${text(x + BW / 2, y + BH / 2 + 9, value, 24)}`;
};

// Верхня цеглинка з пунктирною рамкою і знаком питання — «тут чогось бракує».
const topBrick = () => {
  const x = brickX(0, 0, 1);
  const y = rowY(0);
  const frame = rect(x, y, BW, BH, C.white, 8, 3).replace('stroke-width="3"', 'stroke-width="3" stroke-dasharray="6 5"');
  return `${frame}${text(x + BW / 2, y + BH / 2 + 10, '?', 30, C.orange)}`;
};

const rows = [
  topBrick(),
  brick(1, 0, 2, '8'),
  brick(1, 1, 2, '7'),
  brick(2, 0, 3, '3'),
  brick(2, 1, 3, '5'),
  brick(2, 2, 3, '2'),
].join('');

export const task = {
  id: 'v10',
  tier: 2,
  q: 'Число на кожній цеглинці — це сума чисел на 2 цеглинках під нею. Яке число на верхній цеглинці?',
  art: svg(360, 180, rows),
  options: ['13', '14', '15', '17'],
};
