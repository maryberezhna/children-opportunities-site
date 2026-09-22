import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch } from '../scripts/patch-opportunity.mjs';

// Точкова правка картки (22.09.2026, тур DEC Education).

const row = { summary: 'Освітня поїздка до Великої Британії', details: '## Важно про візу\nподачи документів' };

test('поле замінюється цілком', () => {
  assert.deepEqual(applyPatch(row, { summary: 'Поїздка від DEC Education' }), { summary: 'Поїздка від DEC Education' });
});

test('фрагменти виправляються на місці', () => {
  const out = applyPatch(row, { details: { replace: [['Важно', 'Важливо'], ['подачи', 'подачі']] } });
  assert.equal(out.details, '## Важливо про візу\nподачі документів');
});

test('фрагмента немає — правка не пишеться зовсім', () => {
  assert.throws(() => applyPatch(row, { details: { replace: [['немає такого', 'x']] } }), /немає фрагмента/);
});

test('статус і джерело тут не змінюються', () => {
  assert.throws(() => applyPatch(row, { status: 'active' }), /не змінюється/);
  assert.throws(() => applyPatch(row, { source_url: 'https://x' }), /не змінюється/);
});
