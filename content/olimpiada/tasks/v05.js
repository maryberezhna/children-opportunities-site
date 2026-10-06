// Легке · «Годинник показує 3 години. Котру годину він покаже через 2 години?»
import { svg, circle, line, text, C, INK } from '../art.js';

// Круглий годинник: центр (cx, cy), радіус r; стрілки — у годинах (0..12).
function clock(cx, cy, r, hour, minute) {
  const rad = (h) => ((h * 30 - 90) * Math.PI) / 180;
  const at = (h, d) => [cx + d * Math.cos(rad(h)), cy + d * Math.sin(rad(h))];
  const parts = [
    circle(cx, cy, r + 8, C.sky, 0),
    circle(cx, cy, r, C.white, 4),
  ];
  // 12 поділок: на 12, 3, 6, 9 стоять цифри, на решті 8 — риски.
  for (let i = 0; i < 12; i += 1) {
    if (i % 3 === 0) continue;
    const [x1, y1] = at(i, r - 11);
    const [x2, y2] = at(i, r - 3);
    parts.push(line(x1, y1, x2, y2, 3));
  }
  const d = r - 17;
  parts.push(text(cx, cy - d + 8, '12', 22));
  parts.push(text(cx + d, cy + 8, '3', 22));
  parts.push(text(cx, cy + d + 8, '6', 22));
  parts.push(text(cx - d, cy + 8, '9', 22));
  // Стрілки: годинна — коротка й товста, хвилинна — довга й тонша.
  // Обидві закінчуються перед цифрами, щоб не накладатися на них.
  const [hx, hy] = at(hour, r * 0.4);
  const [mx, my] = at(minute, r * 0.62);
  parts.push(line(cx, cy, hx, hy, 7, INK));
  parts.push(line(cx, cy, mx, my, 4, INK));
  parts.push(circle(cx, cy, 6, C.orange, 2));
  return parts.join('');
}

export const task = {
  id: 'v05',
  tier: 1,
  q: 'Годинник показує 3 години. Котру годину він покаже через 2 години?',
  art: svg(360, 200, clock(180, 100, 80, 3, 0)),
  options: ['1:00', '4:00', '5:00', '6:00'],
};
