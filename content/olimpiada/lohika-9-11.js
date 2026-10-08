// Банк завдань онлайн-олімпіади з логіки для 9–11 років (пілот, жовтень 2026).
//
// 25 ілюстрованих завдань — кожне в своєму файлі в tasks/: умова, малюнок
// (SVG з art.js) і 4 варіанти (текст або картинки). tier 1–3 — складність,
// тест іде від легких до складних (lib/olimpiada.js → buildOrder).
//
// Правильних відповідей тут НЕМАЄ — і після закриття репозиторію (08.10.2026,
// до того він був публічним): код бачать сесії й CI, а ключі — лише база. Ключі лежать у
// таблиці olimpiada_keys (lib/olimpiada-server.js → loadKeys); бали рахує
// сервер у /api/olimpiada/submit. Файл читає лише сервер; у браузер питання
// йдуть через publicQuestions.
import { task as v01 } from './tasks/v01.js';
import { task as v02 } from './tasks/v02.js';
import { task as v03 } from './tasks/v03.js';
import { task as v04 } from './tasks/v04.js';
import { task as v05 } from './tasks/v05.js';
import { task as v06 } from './tasks/v06.js';
import { task as v07 } from './tasks/v07.js';
import { task as v08 } from './tasks/v08.js';
import { task as v09 } from './tasks/v09.js';
import { task as v10 } from './tasks/v10.js';
import { task as v11 } from './tasks/v11.js';
import { task as v12 } from './tasks/v12.js';
import { task as v13 } from './tasks/v13.js';
import { task as v14 } from './tasks/v14.js';
import { task as v15 } from './tasks/v15.js';
import { task as v16 } from './tasks/v16.js';
import { task as v17 } from './tasks/v17.js';
import { task as v18 } from './tasks/v18.js';
import { task as v19 } from './tasks/v19.js';
import { task as v20 } from './tasks/v20.js';
import { task as v21 } from './tasks/v21.js';
import { task as v22 } from './tasks/v22.js';
import { task as v23 } from './tasks/v23.js';
import { task as v24 } from './tasks/v24.js';
import { task as v25 } from './tasks/v25.js';

export const BANK = [
  v01, v02, v03, v04, v05, v06, v07, v08,
  v09, v10, v11, v12, v13, v14, v15, v16, v17,
  v18, v19, v20, v21, v22, v23, v24, v25,
];
