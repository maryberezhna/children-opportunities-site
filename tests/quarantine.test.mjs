import test from 'node:test';
import assert from 'node:assert/strict';
import { quarantineSnippet, verdictPatch } from '../lib/quarantine.js';

// Карантин в адмінці: людина вирішує за секунду — вік, хто може подаватись, суть.

test('витяг бере вік і «хто може» з опису Eurodesk', () => {
  const s = quarantineSnippet('World Heritage Volunteers Age: 18 to 30 Who can apply: young people from all countries. Details…');
  assert.equal(s.age, '18 to 30');
  assert.match(s.who, /young people/);
});

test('вік українською теж знаходиться', () => {
  assert.equal(quarantineSnippet('Табір для дітей 7–12 років у Карпатах').age, '7–12 років');
});

test('віку немає — так і кажемо, а не вигадуємо', () => {
  assert.equal(quarantineSnippet('Greenpeace volunteer programme. Join us.').age, null);
});

test('«Завести можливість» повертає в чергу з рішенням людини', () => {
  const p = verdictPatch('accept', new Date('2026-09-21T12:00:00Z'));
  assert.equal(p.status, 'pending');
  assert.equal(p.attempts, 0);
  assert.equal(p.review_verdict, 'accept');
  assert.equal(p.reviewed_at, '2026-09-21T12:00:00.000Z');
});

test('«Відхилити» — назавжди, з вердиктом для тюнінгу порога', () => {
  const p = verdictPatch('reject');
  assert.equal(p.status, 'rejected');
  assert.equal(p.review_verdict, 'reject');
});

test('невідома дія нічого не міняє', () => {
  assert.equal(verdictPatch('delete'), null);
});
