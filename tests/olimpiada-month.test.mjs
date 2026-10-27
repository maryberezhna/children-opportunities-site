// «Подарунки для заявок до 31 жовтня» — останній день місяця з ключа (27.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthLastDay, monthName } from '../lib/olimpiada.js';

test('останній день місяця конкурсу', () => {
  assert.equal(monthLastDay('2026-10'), 31);
  assert.equal(monthLastDay('2026-11'), 30);
  assert.equal(monthLastDay('2027-02'), 28);
  assert.equal(`${monthLastDay('2026-10')} ${monthName('2026-10', 'gen')}`, '31 жовтня');
});
