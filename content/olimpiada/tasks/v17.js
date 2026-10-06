// Середнє · перегони: хто переміг? — 3 підказки про порядок на фініші.
// Малюнок — пʼєдестал із 3 сходинок (2-1-3, як на справжньому) зі знаками
// питання над кожною: місця ще не розподілені, дитина має їх вивести.
import { svg, rect, poly, line, path, text, unknown, C } from '../art.js';

const W = 360;
const H = 200;
const GROUND = 190;
const STEP_W = 96;

// Сходинки зліва направо: 2 - 1 - 3; висоти 60 / 90 / 40.
const STEPS = [
  { place: '2', x: 36, h: 60 },
  { place: '1', x: 132, h: 90 },
  { place: '3', x: 228, h: 40 },
];

const step = ({ place, x, h }) => {
  const top = GROUND - h;
  const cx = x + STEP_W / 2;
  return [
    rect(x, top, STEP_W, h, C.gray, 6),
    text(cx, top + 30, place, 26),
    unknown(cx, top - 20, 14),
  ].join('');
};

// Кубок над 1-ю сходинкою: чаша-трапеція, 2 ручки, ніжка й підставка.
function cup(cx, top) {
  const bowl = [[cx - 24, top], [cx + 24, top], [cx + 13, top + 26], [cx - 13, top + 26]];
  return [
    path(`M ${cx - 22} ${top + 5} q -16 4 -8 16 q 4 5 10 3`, 'none', 3),
    path(`M ${cx + 22} ${top + 5} q 16 4 8 16 q -4 5 -10 3`, 'none', 3),
    poly(bowl, C.yellow),
    rect(cx - 4, top + 26, 8, 10, C.yellow, 2),
    rect(cx - 15, top + 36, 30, 8, C.yellow, 3),
  ].join('');
}

// Сходинку 1 малюємо останньою, щоб її контур лежав поверх сусідніх.
const art = [
  line(20, GROUND, 340, GROUND, 3),
  step(STEPS[0]),
  step(STEPS[2]),
  step(STEPS[1]),
  cup(180, 10),
].join('');

export const task = {
  id: 'v17',
  tier: 2,
  q: 'Петрик, Миколка й Сашко бігли наввипередки. Петрик прибіг не останнім. Сашко прибіг не першим. Миколка прибіг раніше за Петрика. Хто переміг?',
  art: svg(W, H, art),
  options: ['Петрик', 'Сашко', 'Миколка', 'неможливо визначити'],
};
