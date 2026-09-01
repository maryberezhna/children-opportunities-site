import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLabel } from '../lib/labels.js';

// Поле format у базі — enum (CHECK-констрейнт від 01.09.2026). Картка має
// розуміти всі три значення обома мовами, а на сміття відповідати null.
test('formatLabel розуміє enum', () => {
  assert.equal(formatLabel('online'), 'Онлайн');
  assert.equal(formatLabel('offline'), 'Наживо');
  assert.equal(formatLabel('hybrid'), 'Онлайн і наживо');
  assert.equal(formatLabel('online', 'en'), 'Online');
  assert.equal(formatLabel('offline', 'en'), 'In person');
});

test('formatLabel мовчить на сміття і порожнє', () => {
  assert.equal(formatLabel(null), null);
  assert.equal(formatLabel(''), null);
  assert.equal(formatLabel('json'), null);
  // «заочна» містить «очн», але означає протилежне наживо — свідомий null.
  assert.equal(formatLabel('заочна форма'), null);
});
