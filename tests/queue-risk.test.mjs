// Черга людини за ризиком, не за сумнівом машини (Марія, 22.09.2026).
// Порядок і межа в добу — з lib/publish-criteria.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { queueReason, waitingReason, splitQueue, DAILY_CAP } from '../lib/queue-risk.js';

const ready = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: 'Табір «Веселка»', summary: 'Табір для дітей 7–12 років у Карпатах.',
  age_from: 7, age_to: 12, deadline: '2026-10-01', cost_type: 'free',
  opportunity_type: 'camp', format: 'offline', cities: ['Львів'], child_needs: [],
  evidence: { age: 'a', date: 'b', cost: 'c', type: 'd', place: 'e' },
  ...over,
});

test('готовий запис із цитатами нікого не чекає', () => {
  assert.equal(queueReason(ready()), null);
  assert.equal(waitingReason(ready()), null);
});

test('вразлива тема — завжди до людини й першою', () => {
  assert.equal(queueReason(ready({ opportunity_type: 'psychology' })).key, 'sensitive');
  assert.equal(queueReason(ready({ child_needs: ['veteran_family'] })).key, 'sensitive');
  // Навіть коли бракує цитат: вразливу тему машина не «дочекається» сама.
  assert.equal(queueReason(ready({ opportunity_type: 'medical_aid', evidence: {} })).key, 'sensitive');
});

test('джерело, яке робот не читає, — до людини один раз, а не в «чекає»', () => {
  // mon.gov.ua віддає 403 і поза GitHub: записи складені зі статичної таблиці,
  // цитати зі сторінки не буде ніколи. Такий запис не може довести себе сам —
  // його підтверджує людина, і він не має вічно лежати в «чекає машину».
  const mon = ready({ source: 'МОН України', evidence: {}, opportunity_type: 'olympiad' });
  assert.equal(queueReason(mon).key, 'unreadable');
  // Вразлива тема все одно важливіша.
  assert.equal(queueReason({ ...mon, opportunity_type: 'psychology' }).key, 'sensitive');
  // Звичайне джерело без цитат лишається в «чекає машину».
  assert.equal(queueReason(ready({ source: 'Eurodesk', evidence: {} })), null);
});

test('суперечність у записі: «18+» у тексті при дитячому віці', () => {
  const r = queueReason(ready({ summary: 'Програма для дорослих, 18+' }));
  assert.equal(r.key, 'conflict');
});

test('межа «для дітей» — за позначкою конвеєра', () => {
  const r = queueReason(ready({ admin_comment: 'auto: схоже, учасник — дорослий, перевір' }));
  assert.equal(r.key, 'threshold');
});

test('рідкісне міжнародне — останнє в порядку ризику', () => {
  assert.equal(queueReason(ready({ is_international: true })).key, 'rare');
});

test('бракує поля або цитати — чекає машину, не людину', () => {
  assert.match(waitingReason(ready({ cost_type: null })), /^бракує: /);
  assert.match(waitingReason(ready({ evidence: { age: 'a' } })), /^без цитати: /);
});

test('split: ризик уперед за вагою, решта чекає', () => {
  const { forHuman, waiting } = splitQueue([
    ready({ is_international: true }),
    ready({ evidence: {} }),
    ready({ opportunity_type: 'psychology' }),
    ready({ cost_type: null }),
  ]);
  assert.deepEqual(forHuman.map((x) => x.risk.key), ['sensitive', 'rare']);
  assert.equal(waiting.length, 2);
});

test('межа в добу — розумна й зі спеки', () => {
  assert.ok(DAILY_CAP >= 15 && DAILY_CAP <= 20, String(DAILY_CAP));
});
