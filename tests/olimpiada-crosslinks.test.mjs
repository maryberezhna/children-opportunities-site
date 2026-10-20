import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Перелінковка олімпіад між собою (Марія, 20.10.2026: «типу як рекомендоване»):
// кожна з двох наших олімпіад веде на іншу блоком «Рекомендуємо також».
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('/olimpiada рекомендує «Модний код»', () => {
  const s = read('app/olimpiada/page.js');
  assert.match(s, /Рекомендуємо також/);
  assert.match(s, /href=\{`\/\$\{MK\.slug\}`\}/);
});

test('/modnyi-kod рекомендує олімпіаду з логіки', () => {
  const s = read('app/modnyi-kod/page.js');
  assert.match(s, /Рекомендуємо також/);
  assert.match(s, /href="\/olimpiada"/);
});
