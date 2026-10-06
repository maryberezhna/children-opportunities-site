// Малюнок до відкритого завдання «Придумай питання до малюнка» (Марія,
// 06.10.2026: «даємо картинку, дитина вигадує до неї задачу»). Сцена, у якій
// є що порахувати, порівняти й продовжити: полиця з фігурами, кошик із
// фруктами, намисто з візерунком, годинник, робот і стопка книжок.
import { svg, circle, rect, line, path, text, star, shape, apple, pear, robot, C, INK } from './art.js';

const W = 400;
const H = 260;

// Полиця з фігурами: 2 трикутники, 3 кружечки, 1 квадрат, 2 зірки.
const shelf = [
  rect(18, 70, 282, 10, '#c9924a', 3, 2.5),
  shape('triangle', 38, 50, 16, C.yellow),
  shape('triangle', 72, 50, 16, C.yellow),
  shape('circle', 106, 52, 14, C.red),
  shape('circle', 138, 52, 14, C.red),
  shape('circle', 170, 52, 14, C.red),
  shape('square', 206, 52, 14, C.blue),
  star(242, 52, 15, C.purple),
  star(276, 52, 15, C.purple),
].join('');

// Годинник: 3:00.
const clock = [
  circle(350, 50, 30, C.white),
  line(350, 50, 350, 30, 3.5),
  line(350, 50, 366, 50, 3.5),
  circle(350, 50, 3, INK, 0),
].join('');

// Кошик із 4 яблуками, поруч на столі 2 груші.
const basket = [
  apple(44, 150, 15), apple(74, 146, 15), apple(104, 150, 15), apple(134, 146, 15),
  path('M 22 160 L 156 160 L 144 214 L 34 214 Z', '#e8b86a'),
  line(30, 178, 150, 178, 2.5, '#9a6a2a'), line(26, 196, 148, 196, 2.5, '#9a6a2a'),
  pear(176, 196, 12), pear(204, 196, 12),
].join('');

// Намисто з візерунком: червона, синя, синя, червона, синя, синя, червона.
const beadColors = [C.red, C.blue, C.blue, C.red, C.blue, C.blue, C.red];
const beads = [
  path('M 172 122 Q 242 106 312 122', 'none', 2.5),
  ...beadColors.map((c, i) => circle(176 + i * 22, 118 + Math.abs(3 - i) * 1.4 - 2, 9, c, 2.5)),
].join('');

// Стопка книжок і робот.
const books = [
  rect(232, 196, 70, 14, C.green, 3, 2.5),
  rect(238, 182, 60, 14, C.orange, 3, 2.5),
  rect(234, 168, 66, 14, C.pink, 3, 2.5),
].join('');

export const OPEN_TASK_ART = svg(W, H, [
  rect(4, 4, W - 8, H - 8, C.paper, 18, 2.5),
  shelf, clock, basket, beads, books,
  robot(352, 186, 20),
  line(18, 216, W - 18, 216, 3),
  text(W / 2, 244, 'Що тут можна порахувати, порівняти чи продовжити?', 14, INK, 'middle', 700),
].join(''));
