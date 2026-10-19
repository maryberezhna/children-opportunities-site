// «Не підходить» з причиною (Марія, 28.09.2026): причина обовʼязкова, а
// перелік один — його читає й пошук (scraper/rejections.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { REJECT_REASONS, rejectProblem, rejectNoteBody, rejectReason, rejectStatus } = await import('../lib/reject-reasons.js');

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

// 19.10.2026, Марія: «брак цитати має вести в чернетки, а не в архів». До
// того будь-яка відмова робила archived — а це 307 на головну й зникнення
// із sitemap. Так 12–13.10 зникли FLEX Global (дедлайн за тиждень, 430
// показів) і перелік олімпіад МОН — через «немає цитати на вік».
test('куди веде відмова: без джерела — чернетка, минуло — closed, решта — архів', () => {
  assert.equal(rejectStatus('no_source'), 'draft');
  assert.equal(rejectStatus('expired'), 'closed');
  for (const code of ['not_for_children', 'for_adults', 'club', 'foreign_local', 'commercial', 'duplicate', 'other']) {
    assert.equal(rejectStatus(code), 'archived', code);
  }
  assert.equal(rejectStatus('nonsense'), 'archived');
  for (const r of REJECT_REASONS) assert.ok(['draft', 'closed', 'archived'].includes(r.status), r.code);
});
