// Середнє · «Найкоротший шлях» — від дому до школи 3 дороги, кожна через свою
// зупинку; числа на відрізках — хвилини ходьби. Парк 3+4=7, міст 2+6=8, ліс 5+1=6.
import { svg, circle, rect, poly, path, text, C } from '../art.js';

const W = 360;
const H = 220;

const HOME = [60, 114]; // правий край будиночка — звідси виходять дороги
const SCHOOL = [294, 114]; // лівий край школи — сюди вони приходять
const PARK = [177, 42];
const BRIDGE = [177, 114];
const FOREST = [177, 184];

// Будиночок: стіни, дах, двері, підпис.
const house = [
  rect(18, 98, 42, 36, C.yellow, 4),
  poly([[13, 99], [39, 70], [65, 99]], C.red),
  rect(33, 114, 12, 20, C.orange, 2, 2.5),
  text(39, 154, 'дім', 16),
].join('');

// Школа: ширша будівля з вікнами й дверима, підпис.
const win = (x, y) => rect(x, y, 10, 10, C.white, 2, 2);
const school = [
  rect(294, 84, 56, 50, C.sky, 4),
  win(302, 94), win(317, 94), win(332, 94),
  rect(315, 112, 14, 22, C.orange, 2, 2.5),
  text(322, 154, 'школа', 16),
].join('');

// Зупинка — кольоровий кружечок із підписом над або під ним.
const stop = ([x, y], fill, label, labelY) => `${circle(x, y, 13, fill)}${text(x, labelY, label, 15)}`;

// Відрізок дороги — дуга від a до b (c — контрольна точка), число у білому
// кружечку посередині дуги, щоб читалось поверх лінії.
const seg = (a, c, b, num) => {
  const mx = 0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0];
  const my = 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1];
  return {
    road: path(`M ${a[0]} ${a[1]} Q ${c[0]} ${c[1]} ${b[0]} ${b[1]}`, 'none', 3),
    badge: `${circle(mx, my, 15, C.white, 2.5)}${text(mx, my + 8, String(num), 22)}`,
  };
};

const segments = [
  seg(HOME, [120, 42], PARK, 3), seg(PARK, [234, 42], SCHOOL, 4),
  seg(HOME, [119, 114], BRIDGE, 2), seg(BRIDGE, [236, 114], SCHOOL, 6),
  seg(HOME, [120, 184], FOREST, 5), seg(FOREST, [234, 184], SCHOOL, 1),
];

const art = svg(W, H, [
  ...segments.map((s) => s.road),
  house,
  school,
  stop(PARK, C.green, 'парк', 22),
  stop(BRIDGE, C.gray, 'міст', 143),
  stop(FOREST, C.purple, 'ліс', 212),
  ...segments.map((s) => s.badge),
].join(''));

export const task = {
  id: 'v16',
  tier: 2,
  q: 'Від дому до школи ведуть 3 дороги. Числа — це хвилини ходьби між зупинками. Якою дорогою дійти найшвидше?',
  art,
  options: ['через парк', 'через міст', 'через ліс', 'усі дороги однакові'],
};
