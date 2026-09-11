import test from 'node:test';
import assert from 'node:assert/strict';
import { missingRequired, AGE, DATE, COST, TYPE, PLACE } from '../lib/required.js';

// Дата, тип, вік, вартість і місце-або-формат обовʼязкові перед публікацією
// (вимога Марії 11.09.2026). Ці тести стережуть саме межу «показуємо / не
// показуємо», а не формулювання.

const full = (over = {}) => ({
  age_from: 6, age_to: 12, deadline: '2026-10-01', cost_type: 'free',
  opportunity_type: 'camp', format: 'offline', cities: ['Львів'],
  countries: ['ua'], is_international: false, ...over,
});

test('повний запис нічого не потребує', () => {
  assert.deepEqual(missingRequired(full()), []);
});

test('кожне з пʼяти полів окремо блокує публікацію', () => {
  assert.deepEqual(missingRequired(full({ age_to: null })), [AGE]);
  assert.deepEqual(missingRequired(full({ cost_type: null })), [COST]);
  assert.deepEqual(missingRequired(full({ opportunity_type: null })), [TYPE]);
  assert.deepEqual(
    missingRequired(full({ deadline: null, event_end_date: null, recurrence: null })),
    [DATE],
  );
  assert.deepEqual(
    missingRequired(full({ format: null, cities: [], countries: [], is_international: false })),
    [PLACE],
  );
});

test('сміттєве значення не рахується за заповнене поле', () => {
  // LLM віддавала cost_type "unknown" і тип поза словником — раніше такий
  // запис мовчки ставав null уже після перевірок.
  assert.deepEqual(missingRequired(full({ cost_type: 'unknown' })), [COST]);
  assert.deepEqual(missingRequired(full({ opportunity_type: 'щось' })), [TYPE]);
});

test('порожній масив міст не вважається місцем', () => {
  // `cities` у базі має default '{}', а порожній масив у JS істинний —
  // саме на цьому перевірка «де» мовчки проходила б завжди.
  const row = full({ format: null, cities: [], countries: null, is_international: false });
  assert.deepEqual(missingRequired(row), [PLACE]);
});

test('дату закриває будь-що з трьох', () => {
  const bare = { deadline: null, event_end_date: null, recurrence: null };
  assert.deepEqual(missingRequired(full({ ...bare, event_end_date: '2026-12-01' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, recurrence: 'annual' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, recurrence: 'ongoing' })), []);
});

test('місце закриває будь-що з чотирьох', () => {
  const nowhere = { format: null, cities: [], countries: [], is_international: false };
  assert.deepEqual(missingRequired(full({ ...nowhere, format: 'online' })), []);
  assert.deepEqual(missingRequired(full({ ...nowhere, cities: ['Київ'] })), []);
  assert.deepEqual(missingRequired(full({ ...nowhere, countries: ['pl'] })), []);
  assert.deepEqual(missingRequired(full({ ...nowhere, is_international: true })), []);
});

test('порожній запис перелічує всі пʼять полів', () => {
  assert.deepEqual(missingRequired({}), [AGE, DATE, COST, TYPE, PLACE]);
});
