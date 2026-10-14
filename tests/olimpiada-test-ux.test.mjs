// Тест олімпіади, UX 14.10.2026 (Марія): вибір відповіді сам веде до
// наступного завдання (назад повернутись можна); відправка показує лоадер —
// раніше на останньому питанні здавалось, що все підвисло; завдання про
// рукостискання замінено на простіше.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { task as v21 } from '../content/olimpiada/tasks/v21.js';
import { HINTS } from '../content/olimpiada/hints.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('вибір відповіді веде далі сам; ручний перехід скасовує автоперехід', () => {
  const src = read('app/olimpiada/test/TestRunner.js');
  assert.match(src, /advanceRef\.current = setTimeout/);
  // «← Назад», «Далі» і цятки йдуть через go(), який скасовує таймер.
  assert.match(src, /const go = \(f\) => \{ clearTimeout\(advanceRef\.current\); setIndex\(f\); \};/);
  assert.match(src, /onClick=\{\(\) => go\(i\)\}/);
});

test('відправка відповідей — окремий екран з лоадером, не німі кнопки', () => {
  const src = read('app/olimpiada/test/TestRunner.js');
  assert.match(src, /phase === 'sending' && !timeUp/);
  assert.match(src, /Обробляємо відповіді…/);
  assert.match(src, /className="ol-spin"/);
  assert.match(read('app/styles/olimpiada.css'), /\.ol-spin/);
});

test('замість рукостискань — розрізи стрічки, простіше (14.10.2026)', () => {
  assert.equal(v21.id, 'v21');
  assert.equal(v21.q.includes('рукостискань'), false);
  assert.match(v21.q, /розріз/);
  assert.equal(v21.options.length, 4);
  // Підказка розбору — про нове завдання й без готової відповіді.
  assert.match(HINTS.v21, /розріз/);
});
