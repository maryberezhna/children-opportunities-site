import { test } from 'node:test';
import assert from 'node:assert/strict';

const { olimpStats } = await import('../lib/olimpiada-stats.js');
const { tokenFromOlimpRef } = await import('../lib/olimpiada-server.js');

test('статистика олімпіади: тестові записи адміна не рахуються, виручка = внески + доставка', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const s = olimpStats({
    now,
    waitlist: [
      { created_at: '2026-10-10T08:00:00Z', source: 'telegram' },
      { created_at: '2026-10-08T08:00:00Z', source: null },
      { created_at: '2026-09-20T08:00:00Z', source: 'telegram' },
    ],
    entries: [
      { paid_at: 'x', started_at: 'x', finished_at: 'x', score: 23, level: 'gold', open_answer_at: 'x', print_paid_at: 'x', wfp_last_status: 'Approved', amount: 150 },
      { paid_at: 'x', started_at: 'x', finished_at: 'x', score: 9, level: 'participant', wfp_last_status: 'Approved', amount: 150 },
      { paid_at: null, wfp_last_status: 'Declined', amount: 150 },
      { paid_at: 'x', finished_at: 'x', score: 25, level: 'gold', wfp_last_status: 'Test', amount: 150 },
    ],
  });
  assert.equal(s.waitlist, 3);
  assert.equal(s.waitlist7, 2);
  assert.equal(s.waitlist1, 1);
  assert.deepEqual(s.sources[0], ['telegram', 2]);
  assert.equal(s.paid, 2);
  assert.equal(s.unpaid, 1);
  assert.equal(s.finished, 2);
  assert.equal(s.open, 1);
  assert.equal(s.prints, 1);
  assert.equal(s.revenue, 150 * 2 + 120);
  assert.equal(s.avgScore, 16);
  assert.equal(s.tests, 1);
});

test('номер замовлення олімпіади → токен учасника (і участь, і доставка)', () => {
  const t = '5ee773db13a0d5a9f43d0ec6cbb47b24';
  assert.equal(tokenFromOlimpRef(`olimp-${t}-1791300000000`), t);
  assert.equal(tokenFromOlimpRef(`olimp-d-${t}-1791300000000`), t);
  assert.equal(tokenFromOlimpRef('plus-abc-1'), null);
  assert.equal(tokenFromOlimpRef(`olimp-${t}`), null);
});
