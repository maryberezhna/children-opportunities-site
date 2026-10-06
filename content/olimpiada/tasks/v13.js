// Середнє · «Гральний кубик» — сума крапок на протилежних гранях дорівнює 7.
import { svg, rect, circle, C, INK } from '../art.js';

// Велика грань кубика по центру з 3 крапками по діагоналі.
const W = 360;
const H = 200;
const S = 150;
const x0 = (W - S) / 2;
const y0 = (H - S) / 2;
const dot = (fx, fy) => circle(x0 + S * fx, y0 + S * fy, 13, INK, 0);

const face = [
  rect(x0 + 6, y0 + 8, S, S, C.gray, 24, 0), // легка тінь, щоб грань не висіла в повітрі
  rect(x0, y0, S, S, C.white, 24),
  dot(0.25, 0.25),
  dot(0.5, 0.5),
  dot(0.75, 0.75),
].join('');

export const task = {
  id: 'v13',
  tier: 2,
  q: 'На гральному кубику сума крапок на протилежних гранях завжди дорівнює 7. Скільки крапок на грані, що навпроти цієї?',
  art: svg(W, H, face),
  options: ['2', '3', '4', '5'],
};
