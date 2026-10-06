// Середнє · равлик на стовпі: 5 м, за день +3 м, за ніч −2 м.
// Малюнок: стовп із позначками 0–5 м і стрілкою «верх», равлик біля землі;
// праворуч — сонце з «+3 м за день» і місяць із «−2 м за ніч».
import { svg, circle, rect, line, path, text, arrow, C, INK } from '../art.js';

const POLE_X = 72; // середина стовпа
const POLE_W = 12;
const GROUND_Y = 200; // позначка 0 м — рівень землі
const STEP = 32; // 1 метр у пікселях
const markY = (m) => GROUND_Y - m * STEP;

const poleTop = markY(5) - 8;
const pole = rect(POLE_X - POLE_W / 2, poleTop, POLE_W, GROUND_Y + 8 - poleTop, C.gray, 4, 3);

// Земля — зелена смужка під стовпом і равликом; починається після підписів «0 м».
const ground = rect(60, GROUND_Y, 108, 14, C.green, 5, 2.5);

// Позначки 0–5 м: риска через стовп і підпис ліворуч.
const marks = [0, 1, 2, 3, 4, 5]
  .map((m) => `${line(POLE_X - POLE_W / 2 - 8, markY(m), POLE_X + POLE_W / 2, markY(m), 3)}${text(POLE_X - POLE_W / 2 - 14, markY(m) + 6, `${m} м`, 16, INK, 'end')}`)
  .join('');

// Стрілка «верх» біля вершини стовпа.
const top = `${arrow(POLE_X + 24, markY(5) + 2, 'up', 9, C.green)}${text(POLE_X + 38, markY(5) + 8, 'верх', 16, INK, 'start')}`;

// Равлик: тіло на землі, голова ліворуч (до стовпа), мушля-спіраль зверху.
function snail(bx, by) {
  const sx = bx + 8;
  const sy = by - 19;
  const body = `M ${bx + 20} ${by} L ${bx - 22} ${by} Q ${bx - 30} ${by} ${bx - 30} ${by - 8} Q ${bx - 30} ${by - 16} ${bx - 22} ${by - 16} L ${bx - 10} ${by - 16} Q ${bx + 4} ${by - 16} ${bx + 20} ${by - 6} Z`;
  const spiral = `M ${sx} ${sy - 8} a 8 8 0 1 1 -8 8 a 5 5 0 1 1 5 -5 a 2 2 0 1 1 -2 2`;
  return [
    path(body, '#b7dd4b', 2.5),
    line(bx - 26, by - 16, bx - 31, by - 27, 2.5),
    line(bx - 20, by - 16, bx - 19, by - 28, 2.5),
    circle(bx - 32, by - 29, 2.5, INK, 0),
    circle(bx - 19, by - 30, 2.5, INK, 0),
    `<circle cx="${bx - 25}" cy="${by - 10}" r="1.8" fill="${INK}"/>`,
    circle(sx, sy, 13, C.orange, 3),
    path(spiral, 'none', 2.5),
  ].join('');
}

// Сонце: жовте коло з 8 промінцями.
function sun(cx, cy) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    return line(cx + 21 * Math.cos(a), cy + 21 * Math.sin(a), cx + 29 * Math.cos(a), cy + 29 * Math.sin(a), 3, C.orange);
  }).join('');
  return `${rays}${circle(cx, cy, 15, C.yellow, 3)}`;
}

// Місяць: півмісяць рогами праворуч.
const moon = (cx, cy) =>
  path(`M ${cx} ${cy - 16} A 16 16 0 0 0 ${cx} ${cy + 16} A 24 24 0 0 1 ${cx} ${cy - 16} Z`, C.sky, 3);

const legend = [
  sun(206, 66),
  text(242, 73, '+3 м за день', 18, INK, 'start'),
  moon(206, 150),
  text(242, 157, '−2 м за ніч', 18, INK, 'start'),
].join('');

export const task = {
  id: 'v14',
  tier: 2,
  q: 'Равлик повзе вгору по стовпу заввишки 5 метрів. За день він піднімається на 3 метри, а за ніч сповзає на 2 метри. На який день равлик уперше дістанеться вершини?',
  art: svg(360, 220, `${pole}${ground}${marks}${top}${snail(122, GROUND_Y)}${legend}`),
  options: ['на 2-й', 'на 3-й', 'на 4-й', 'на 5-й'],
};
