// Причина «чому ця картка тут» і порядок за найближчим дедлайном
// (Марія, 23.09.2026: «показувати, ЧОМУ саме цей запис сюди потрапив»,
// «сортувати за найближчим дедлайном», «показувати, чого саме не вистачає»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionReason, gapReason, deadlineNote, sortByDeadline } from '../lib/decision-reason.js';

const ready = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: 'Табір «Веселка»', summary: 'Табір для дітей 7–12 років у Карпатах.',
  age_from: 7, age_to: 12, deadline: '2026-10-05', cost_type: 'free',
  opportunity_type: 'camp', format: 'offline', cities: ['Львів'], child_needs: [],
  source: 'Тест', source_url: 'https://example.org/tabir', link_status: 'ok',
  evidence: { age: 'a', date: 'b', cost: 'c', type: 'd', place: 'e' },
  ...over,
});

test('готовий запис: причина є завжди, і вона — «лишилось рішення»', () => {
  const r = decisionReason(ready());
  assert.equal(r.key, 'ready');
  assert.equal(r.tone, 'ready');
  assert.match(r.text, /лишилось рішення/);
});

test('чого не вистачає — переліком, тими самими підписами, що в конвеєрі', () => {
  // Без ризику й без дубля причина = обовʼязковий мінімум (lib/required.js).
  const r = decisionReason(ready({ age_from: null, age_to: null, cost_type: null }));
  assert.equal(r.key, 'missing');
  assert.equal(r.text, 'Не вистачає: вік, вартість');
});

test('поле є, а цитати немає — окрема причина, не «не вистачає»', () => {
  const r = decisionReason(ready({ evidence: { age: 'a', date: 'b', cost: 'c', place: 'e' } }));
  assert.equal(r.key, 'noproof');
  assert.equal(r.text, 'Модель не знайшла в тексті: тип');
});

test('дубль випереджає все: одним кліком знімається питання', () => {
  const r = decisionReason(ready({ dup_of: 'tabir-veselka', opportunity_type: 'psychology' }));
  assert.equal(r.key, 'dup');
  assert.match(r.text, /дубль/);
});

test('мертве посилання видно в причині, а не тільки в конвеєрі', () => {
  assert.equal(decisionReason(ready({ link_status: 'dead' })).key, 'link');
  assert.equal(decisionReason(ready({ link_status: 'suspect' })).key, 'link');
  assert.equal(decisionReason(ready({ source_url: null })).text, 'Немає посилання на джерело');
});

test('чутлива тема — людською, без машинних ключів', () => {
  const r = decisionReason(ready({ opportunity_type: 'psychology', evidence: {} }));
  assert.equal(r.key, 'sensitive');
  assert.match(r.text, /Чутлива тема/);
  assert.doesNotMatch(r.text, /psychology/);

  const needs = decisionReason(ready({ child_needs: ['veteran_family'] }));
  assert.equal(needs.key, 'sensitive');
  assert.match(needs.text, /діти захисників/i);
  assert.doesNotMatch(needs.text, /veteran_family/);
});

test('межа «для дітей» — словами Марії: модель не впевнена', () => {
  const r = decisionReason(ready({ admin_comment: 'auto: схоже, учасник — дорослий' }));
  assert.equal(r.key, 'threshold');
  assert.match(r.text, /не впевнена/);
});

test('рідкісне міжнародне й нечитабельне джерело мають свої причини', () => {
  assert.equal(decisionReason(ready({ is_international: true })).key, 'rare');
  const mon = decisionReason(ready({ source: 'МОН України', evidence: {} }));
  assert.equal(mon.key, 'unreadable');
  assert.match(mon.text, /МОН України/);
});

test('коли причина інша, чого бракує — окремим тихішим рядком', () => {
  // Інакше виходила пастка: причина одна, кнопка «Додати на сайт» сіра,
  // а чому саме — не сказано ніде.
  const r = decisionReason(ready({
    admin_comment: 'auto: низька впевненість', age_from: null, age_to: null,
  }));
  assert.equal(r.key, 'threshold');
  assert.equal(r.gap, 'Не вистачає: вік');
  // Якщо головна причина і є «бракує» — другого рядка немає.
  assert.equal(decisionReason(ready({ age_from: null, age_to: null })).gap, undefined);
  assert.equal(decisionReason(ready()).gap, undefined);
});

test('у «Неповних на сайті» питання лише про поля, а не про ризик', () => {
  // Міжнародний запис без віку: decisionReason сказав би «рідкісне
  // міжнародне», а в списку неповних відповідь потрібна інша.
  const row = ready({ is_international: true, age_from: null, age_to: null });
  assert.equal(decisionReason(row).key, 'rare');
  assert.equal(gapReason(row).text, 'Не вистачає: вік');
  assert.equal(gapReason(ready()), null);
});

test('кожна причина має тон для рамки', () => {
  for (const row of [ready(), ready({ dup_of: 'x' }), ready({ link_status: 'dead' }),
    ready({ opportunity_type: 'psychology' }), ready({ cost_type: null })]) {
    assert.ok(['stop', 'check', 'ready'].includes(decisionReason(row).tone));
  }
});

test('дедлайн словами: дата і скільки лишилось', () => {
  const n = deadlineNote({ deadline: '2026-10-05' }, '2026-09-23');
  assert.equal(n.text, 'до 5 жовтня 2026 · лишилось 12 днів');
  assert.equal(n.days, 12);
  assert.equal(n.past, false);

  assert.match(deadlineNote({ deadline: '2026-09-23' }, '2026-09-23').text, /сьогодні останній день/);
  assert.match(deadlineNote({ deadline: '2026-09-24' }, '2026-09-23').text, /завтра останній день/);

  const gone = deadlineNote({ deadline: '2026-09-20' }, '2026-09-23');
  assert.equal(gone.past, true);
  assert.match(gone.text, /минув 3 дні тому/);

  assert.equal(deadlineNote({}, '2026-09-23'), null);
});

test('сортування: дедлайни вперед, найближчі згори, без дедлайну — після', () => {
  const rows = [
    { id: 'без-дедлайну-1' },
    { id: 'жовтень', deadline: '2026-10-05' },
    { id: 'без-дедлайну-2' },
    { id: 'вересень', deadline: '2026-09-30' },
  ];
  assert.deepEqual(
    sortByDeadline(rows).map((x) => x.id),
    ['вересень', 'жовтень', 'без-дедлайну-1', 'без-дедлайну-2'],
  );
  // Вхідний масив не чіпаємо.
  assert.equal(rows[0].id, 'без-дедлайну-1');
});

test('сортування вміє діставати дедлайн зі складеного елемента черги', () => {
  const list = [
    { row: { id: 'a' }, risk: null },
    { row: { id: 'b', deadline: '2026-10-01' }, risk: null },
  ];
  assert.deepEqual(
    sortByDeadline(list, (x) => x.row.deadline).map((x) => x.row.id),
    ['b', 'a'],
  );
});
