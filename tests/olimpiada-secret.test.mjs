// Відкрите завдання олімпіади — секрет до тесту (Марія, 06.10.2026: «це має
// бути секретом»). 06.10 його ненадовго показали на /olimpiada з малюнком —
// цей тест не дає повторити: ні на сторінці, ні в листі-запрошенні, ні в
// публічних критеріях журі.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPEN_TASK } from '../lib/olimpiada.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('сторінка олімпіади не показує ні малюнка, ні назви, ні тексту відкритого завдання', () => {
  const page = read('app/olimpiada/page.js');
  assert.doesNotMatch(page, /OPEN_TASK_ART|OPEN_TASK\.title|OPEN_TASK\.text/);
  assert.ok(!page.includes(OPEN_TASK.title));
});

test('лист-запрошення й екран перед «Почати» не називають завдання', () => {
  const words = OPEN_TASK.title.toLowerCase().split(' ').slice(-2).join(' '); // «до малюнка»
  assert.ok(!read('scraper/olimpiada_invites.py').toLowerCase().includes(words));
  const runner = read('app/olimpiada/test/TestRunner.js');
  const intro = runner.slice(runner.indexOf('ol-intro'), runner.indexOf('ol-intro') + 2000);
  assert.ok(!intro.toLowerCase().includes(words));
});

test('публічні критерії журі не підказують, яке завдання', () => {
  for (const c of OPEN_TASK.criteria) assert.doesNotMatch(`${c.name} ${c.text}`, /малюн|питання/i);
});
