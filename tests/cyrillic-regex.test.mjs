// «\b» і «\w» у JavaScript визначені лише для латиниці.
//
// У JS межа слова `\b` стоїть між [A-Za-z0-9_] і будь-чим іншим. Кирилична
// літера для неї — НЕ символ слова, тож після «олімпіада» межі слова не існує
// й вираз /^Всеукраїнська олімпіада\b/i не збігається ніколи:
//
//   /^Всеукраїнська олімпіада\b/i.test('Всеукраїнська олімпіада з математики')
//   // → false
//
// Саме так сторінка /olimpiady простояла добу з порожнім списком при 26
// придатних записах у базі (28.09.2026). Помилка мовчазна: регулярка не
// падає, вона просто не збігається, а порожній список читається як «поки
// нічого немає».
//
// Те саме з `\w`: він не ловить кириличних літер, тож будь-яка нарізка слів
// через \w+ мовчки викидає українські слова.
//
// У Python цієї вади немає: там str-шаблони від початку в Unicode-режимі,
// і \b з кирилицею працює. Тому перевіряємо лише JavaScript.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['lib', 'app', 'scripts'];
const SKIP = new Set(['node_modules', '.next', '.git']);

function* files(dir) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP.has(name)) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) yield* files(rel);
    else if (/\.(js|mjs)$/.test(name)) yield rel;
  }
}

// Грубий, але достатній розбір: літерали регулярок у рядку коду.
const LITERAL = /\/(?![/*])((?:\\.|\[[^\]]*\]|[^/\\\n])+)\/[gimsuyv]*/g;
const CYRILLIC = /[Ѐ-ӿ]/;
// \b або \w упритул до кириличної літери — з будь-якого боку.
const ADJACENT = /\\[bB][Ѐ-ӿ]|[Ѐ-ӿ]\\[bB]/;

function scan() {
  const found = [];
  for (const dir of DIRS) {
    for (const rel of files(dir)) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      src.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        // Коментарі пропускаємо: у них ці вирази наводять як приклад помилки.
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        for (const m of line.matchAll(LITERAL)) {
          const body = m[1];
          if (ADJACENT.test(body)) found.push(`${rel}:${i + 1}  ${m[0].slice(0, 80)}`);
          if (/\\[wW]/.test(body) && CYRILLIC.test(body)) {
            found.push(`${rel}:${i + 1}  \\w поруч із кирилицею — ${m[0].slice(0, 70)}`);
          }
        }
      });
    }
  }
  return found;
}

test('сама вада відтворюється — щоб перевірка мала сенс', () => {
  const title = 'Всеукраїнська олімпіада з математики';
  assert.equal(/^Всеукраїнська олімпіада\b/i.test(title), false, 'із \\b не збігається');
  assert.equal(/^Всеукраїнська олімпіада\s/i.test(title), true, 'без \\b збігається');
  assert.equal(/^\w+$/.test('олімпіада'), false, '\\w не ловить кирилиці');
});

test('у коді немає \\b і \\w упритул до кирилиці', () => {
  const found = scan();
  assert.deepEqual(found, [],
    `Замініть \\b на \\s, на явний перелік літер або на startsWith:\n${found.join('\n')}`);
});
