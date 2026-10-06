// Легке · «Робот виконує команди» — сітка 3×3, робот у нижній лівій клітинці,
// 4 команди-стрілки праворуч; варіанти — літери клітинок.
import { svg, rect, text, arrow, robot, C } from '../art.js';

const CELL = 52;
const GX = 16; // лівий край сітки
const GY = 22; // верхній край сітки

// Клітинка сітки: col 0..2 зліва направо, row 0..2 згори донизу.
const cell = (col, row) => rect(GX + col * CELL, GY + row * CELL, CELL, CELL, C.white, 0, 3);
const letter = (col, row, s) => text(GX + col * CELL + CELL / 2, GY + row * CELL + CELL / 2 + 9, s, 24);

const grid = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => cell(col, row))).join('');

const letters = [letter(0, 0, 'Г'), letter(1, 0, 'А'), letter(2, 0, 'Б'), letter(2, 1, 'В')].join('');

// Робот у нижній лівій клітинці (col 0, row 2).
const bot = robot(GX + CELL / 2, GY + 2 * CELL + CELL / 2 + 4, 16);

// Команди — 4 квадратики зі стрілками в рядок, зліва направо.
const SQ = 32;
const GAP = 8;
const CMD_X = 192;
const CMD_Y = 92;
const commands = ['up', 'up', 'right', 'right']
  .map((dir, i) => {
    const x = CMD_X + i * (SQ + GAP);
    return `${rect(x, CMD_Y, SQ, SQ, C.sky, 6, 2.5)}${arrow(x + SQ / 2, CMD_Y + SQ / 2, dir, 11)}`;
  })
  .join('');
const caption = text(CMD_X + (4 * SQ + 3 * GAP) / 2, CMD_Y - 14, 'команди', 17);

export const task = {
  id: 'v07',
  tier: 1,
  q: 'Робот стоїть у нижній лівій клітинці й виконує команди по черзі: вгору, вгору, праворуч, праворуч. У якій клітинці він зупиниться?',
  art: svg(360, 200, `${grid}${letters}${bot}${caption}${commands}`),
  options: ['А', 'Б', 'В', 'Г'],
};
