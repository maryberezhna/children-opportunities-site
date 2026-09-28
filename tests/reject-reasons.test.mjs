// «Не підходить» з причиною (Марія, 28.09.2026): причина обовʼязкова, а
// перелік один — його читає й пошук (scraper/rejections.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { REJECT_REASONS, rejectProblem, rejectNoteBody, rejectReason } = await import('../lib/reject-reasons.js');

test('коди унікальні, у кожної причини є підпис і позначка teach', () => {
  const codes = REJECT_REASONS.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const r of REJECT_REASONS) {
    assert.ok(/^[a-z_]+$/.test(r.code), r.code);
    assert.ok(r.label && r.label.length > 3, r.code);
    assert.equal(typeof r.teach, 'boolean', r.code);
  }
});

test('без причини чи з вигаданою — не відхиляємо', () => {
  assert.equal(rejectProblem(undefined), 'bad_reason');
  assert.equal(rejectProblem('school'), 'bad_reason');
  assert.equal(rejectProblem('club'), null);
});

test('«Інше» — лише з поясненням', () => {
  assert.equal(rejectProblem('other', '  '), 'reason_text_required');
  assert.equal(rejectProblem('other', 'для студентів вишів'), null);
});

test('гуртки не шукаємо — ця відмова вчить пошук, дубль — ні', () => {
  assert.equal(rejectReason('club').teach, true);
  assert.equal(rejectReason('duplicate').teach, false);
});

test('текст для журналу — людською мовою', () => {
  assert.equal(rejectNoteBody('club'), 'Не підходить: Гурток чи секція — такі не шукаємо');
  assert.equal(rejectNoteBody('other', 'для студентів'), 'Не підходить: Інше — напишу чому. для студентів');
});
