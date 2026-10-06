// Середнє · намисто за правилом: після кожної жовтої намистини йдуть рівно 2 сині.
// Варіанти — 4 нитки з намистинами; лише одна складена за правилом.
import { svg, circle, line, text, C, INK } from '../art.js';

// Намистина за літерою: Ж — жовта, С — синя.
const BEAD = { Ж: C.yellow, С: C.blue };

// Нитка з намистинами, вирівняна по центру: step — крок між центрами, r — радіус.
function beads(seq, w, cy, r, step, sw) {
  const letters = seq.split('');
  const x0 = (w - (letters.length - 1) * step) / 2;
  const first = x0 - r - 5;
  const last = x0 + (letters.length - 1) * step + r + 5;
  const thread = line(first, cy, last, cy, 2, INK);
  const circles = letters.map((ch, i) => circle(x0 + i * step, cy, r, BEAD[ch], sw)).join('');
  return `${thread}${circles}`;
}

// Варіант відповіді: нитка на 250x56, намистини r=12, крок 26 — щоб їх було
// легко рахувати навіть у вузькій колонці.
const pic = (seq) => svg(250, 56, beads(seq, 250, 28, 12, 26, 2.5));

// Підказка в умові: жовта намистина, за нею 2 сині, підпис «Правило».
// Компактна (360x72), щоб не забирати місце в самих варіантів.
const hint = [
  text(78, 44, 'Правило:', 22),
  line(138, 36, 320, 36, 3, INK),
  circle(180, 36, 15, C.yellow, 3),
  circle(228, 36, 15, C.blue, 3),
  circle(276, 36, 15, C.blue, 3),
].join('');

export const task = {
  id: 'v15',
  tier: 2,
  q: 'Правило намиста: після кожної жовтої намистини йдуть рівно 2 сині. Яке намисто складене за правилом?',
  art: svg(360, 72, hint),
  options: [
    { art: pic('ЖССЖССЖСС') },
    { art: pic('ЖСЖССЖСС') },
    { art: pic('ЖСССЖСС') },
    { art: pic('ЖССЖСЖСС') },
  ],
};
