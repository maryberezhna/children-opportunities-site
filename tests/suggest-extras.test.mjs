// Вік і дати у формі «Запропонувати можливість» (07.10.2026): вік — хоч одна
// межа, дати — початок або кінець, або «доступна завжди».
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { readExtras, extrasProblem, extrasLines } = await import('../lib/suggestExtras.js');
const check = (b) => extrasProblem(readExtras(b));

test('повна відповідь проходить і стає двома рядками', () => {
  const x = readExtras({ ageFrom: '7', ageTo: '14', start: '2026-11-01', end: '2026-11-30' });
  assert.equal(extrasProblem(x), null);
  assert.deepEqual(extrasLines(x), ['👧 Вік учасників: 7–14', '📅 Коли: початок 01.11.2026, кінець 30.11.2026']);
});

test('досить однієї межі віку й однієї дати', () => {
  assert.equal(check({ ageFrom: 12, end: '2026-12-01' }), null);
  assert.deepEqual(extrasLines(readExtras({ ageTo: 6, start: '2026-10-10' })),
    ['👧 Вік учасників: до 6', '📅 Коли: початок 10.10.2026']);
});

test('«доступна завжди» замінює дати й прибирає їх', () => {
  const x = readExtras({ ageFrom: 0, ageTo: 18, always: true, start: '2026-01-01' });
  assert.equal(extrasProblem(x), null);
  assert.equal(x.start, null);
  assert.deepEqual(extrasLines(x), ['👧 Вік учасників: 0–18', '📅 Коли: доступна завжди']);
});

test('без віку, з віком навиворіт чи нечислом — age', () => {
  assert.equal(check({ start: '2026-11-01' }), 'age');
  assert.equal(check({ ageFrom: 14, ageTo: 7, start: '2026-11-01' }), 'age');
  assert.equal(check({ ageFrom: 'сім', start: '2026-11-01' }), 'age');
  assert.equal(check({ ageFrom: -1, start: '2026-11-01' }), 'age');
});

test('без дат і без «завжди», з датами навиворіт чи кривими — dates', () => {
  assert.equal(check({ ageFrom: 7 }), 'dates');
  assert.equal(check({ ageFrom: 7, start: '2026-12-01', end: '2026-11-01' }), 'dates');
  assert.equal(check({ ageFrom: 7, start: '01.11.2026' }), 'dates');
});
