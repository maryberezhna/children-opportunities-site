import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHECKIN_ANSWERS, CHECKIN_QUESTION, parseCheckin, checkinKeyboard, pendingCheckinNote, checkinNote, wantsNote,
} from '../lib/plusCheckins.js';

// «Чи вдалося на щось подати заявку?» (Марія, 23.10.2026).
const ID = '12345678-1234-1234-1234-123456789012';

test('розбір кнопок pchk:', () => {
  assert.deepEqual(parseCheckin(`pchk:applied:${ID}`), { action: 'answer', id: ID, answer: 'applied' });
  assert.deepEqual(parseCheckin(`pchk:skip:${ID}`), { action: 'skip', id: ID, answer: null });
  assert.equal(parseCheckin(`pchk:maybe:${ID}`), null);
  assert.equal(parseCheckin(`pout:yes:${ID}`), null);
});

test('кнопки вміщаються в 64 байти', () => {
  for (const row of checkinKeyboard(ID).inline_keyboard) {
    for (const b of row) assert.ok(Buffer.byteLength(b.callback_data) <= 64, b.callback_data);
  }
});

test('додати слова можна після будь-якої відповіді', () => {
  for (const [code] of CHECKIN_ANSWERS) assert.equal(wantsNote(code), true, code);
  assert.equal(wantsNote('maybe'), false);
  const now = new Date('2026-10-23T12:00:00Z');
  const fresh = { id: 'a', answer: 'applied', note: null, answered_at: '2026-10-23T11:00:00Z' };
  assert.equal(pendingCheckinNote([fresh], now), fresh);
  assert.equal(pendingCheckinNote([{ ...fresh, note: '' }], now), null);
  assert.equal(pendingCheckinNote([{ ...fresh, answered_at: '2026-10-23T07:00:00Z' }], now), null);
  assert.equal(pendingCheckinNote([{ ...fresh, answer: 'preparing' }], now)?.id, 'a');
});

test('питання й підписи кнопок однакові в боті й у Python', () => {
  const py = readFileSync(new URL('../scraper/ask_checkin.py', import.meta.url), 'utf8');
  for (const [code, label] of CHECKIN_ANSWERS) assert.ok(py.includes(`("${code}", "${label}")`), label);
  for (const line of CHECKIN_QUESTION.split('\n').filter(Boolean)) assert.ok(py.includes(line), line);
});

test('рядок для адмінки', () => {
  assert.equal(checkinNote({ answer: 'applied', note: 'FLEX', answered_at: '2026-10-23T10:00:00Z' }),
    '📝 Так, подали — «FLEX» (23.10.2026)');
  assert.equal(checkinNote({ answer: null }), null);
});
