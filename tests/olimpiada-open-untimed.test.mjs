// Відкрите завдання олімпіади — без таймера (Марія, 07.10.2026: «без таймера»).
// Хвилини — лише на завдання з варіантами; відкрите — останній крок тесту, перед
// дипломом, і його можна дописати на сторінці результату, якщо пропустили.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OLIMP, acceptUntil, deadlineOf } from '../lib/olimpiada.js';
import { buildInvite } from '../lib/olimpiada-mail.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('відповіді з варіантами приймаються до кінця часу плюс запас на мережу — без табло', () => {
  assert.equal(OLIMP.overtimeSeconds, undefined, 'табло «ще 2 хвилини» повернулось');
  const start = '2026-10-07T10:00:00Z';
  assert.equal(acceptUntil(start).getTime() - deadlineOf(start).getTime(), OLIMP.graceSeconds * 1000);
});

test('відкрите завдання — окремий запит, один раз і лише після завдань з варіантами', () => {
  const route = read('app/api/olimpiada/open/route.js');
  assert.match(route, /if \(!entry\.finished_at\) return json\(\{ error: 'not_finished' \}, 409\);/);
  assert.match(route, /if \(entry\.open_answer\) return json\(\{ ok: true, already: true \}\);/);
  assert.doesNotMatch(route, /acceptUntil|deadline/, 'на відкритому завданні не має бути часового обмеження');
});

test('у тесті немає таймера на відкритому завданні', () => {
  const src = read('app/olimpiada/test/TestRunner.js');
  assert.doesNotMatch(src, /overtime/, 'лишились сліди табло');
  assert.doesNotMatch(src, /ol-dot-open/, 'відкрите завдання знову серед кроків із таймером');
  const from = src.indexOf("if (phase === 'open')");
  const open = src.slice(from, src.indexOf('if (timeUp)', from));
  assert.ok(open.length > 0, 'немає окремого кроку відкритого завдання');
  assert.doesNotMatch(open, /role="timer"|ol-timer/, 'на кроці відкритого завдання таймер');
  assert.match(open, /без таймера/);
  assert.match(src, /відкрите: без варіантів і без таймера/);
});

test('пропущене відкрите завдання на сторінці результату не дописують (08.10.2026)', () => {
  const page = read('app/olimpiada/test/page.js');
  assert.doesNotMatch(page, /OpenTaskLate|можна дописати тут/);
  assert.match(page, /\{entry\.open_answer \? \(/);
  assert.doesNotMatch(page, /overtime=/);
});

test('сторінка, правила й лист кажуть «без таймера», а не «в тих самих хвилинах»', () => {
  const page = read('app/olimpiada/page.js');
  assert.doesNotMatch(page, /тих самих \$\{OLIMP\.minutes\}|разом із відкритим|хвилин на все|overtimeSeconds/);
  assert.match(page, /Таймера на ньому немає/);
  assert.match(page, /1 відкрите завдання без таймера/);
  const { text } = buildInvite({ token: 'a'.repeat(32), child_name: 'М', paid_at: '2026-10-07T10:00:00Z' });
  assert.match(text, /без варіантів і без таймера/);
  assert.doesNotMatch(text, /хвилин на все|ще 2 хвилини/);
});

test('блок у підбірках і опис для AI-асистентів — теж «без таймера»', () => {
  assert.match(read('app/OlimpPromo.js'), /і 1 відкрите без таймера/);
  assert.match(read('app/llms.txt/route.js'), /і 1 відкрите без таймера/);
  for (const f of ['app/OlimpPromo.js', 'app/llms.txt/route.js', 'app/olimpiada/page.js']) {
    assert.doesNotMatch(read(f), /1 відкрите за \$?\{OLIMP\.minutes\}|і 1 відкрите · \$\{OLIMP\.minutes\}/, f);
  }
});
