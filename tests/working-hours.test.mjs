// «Хто пише після 18:00 — відповідаємо обовʼязково в робочі години» (Марія, 22.10.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORK_FROM, WORK_TO, WORK_HOURS_TEXT, DIGEST_MAX, isAfterHours, kyivTime, afterHoursDigest,
} from '../lib/working-hours.js';
import { CONTACT_TYPE_MAP } from '../lib/contactTypes.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const at = (iso) => new Date(iso);
// Зима: Київ на UTC+2.
const kyiv = (h, m = 0) => at(`2026-01-14T${String(h - 2).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

test('робочий час — з 9:00 до 18:00 за Києвом', () => {
  assert.equal(WORK_FROM, 9);
  assert.equal(WORK_TO, 18);
  assert.equal(isAfterHours(kyiv(18)), true, '18:00 — уже неробочий');
  assert.equal(isAfterHours(kyiv(17, 59)), false, '17:59 — ще робочий');
  assert.equal(isAfterHours(kyiv(23)), true);
  assert.equal(isAfterHours(kyiv(8, 59)), true, '8:59 — ще неробочий');
  assert.equal(isAfterHours(kyiv(9)), false, '9:00 — робочий');
  assert.equal(WORK_HOURS_TEXT, 'з 9:00 до 18:00 за київським часом');
});

test('час київський і влітку', () => {
  // 1 липня Київ на UTC+3: 15:30 UTC = 18:30 за Києвом.
  assert.equal(isAfterHours(at('2026-07-01T15:30:00Z')), true);
  assert.equal(kyivTime(at('2026-07-01T15:30:00Z')), '18:30');
});

test('нагадування — лише про тих, хто писав поза робочим часом', () => {
  const rows = [
    { type: 'bot', contact: 'tg:1', message: 'Коли буде наступна олімпіада?', created_at: kyiv(21, 14).toISOString() },
    { type: 'error', contact: 'olena@gmail.com', message: 'Битий лінк', created_at: kyiv(12).toISOString() },
  ];
  const text = afterHoursDigest(rows, CONTACT_TYPE_MAP);
  assert.match(text, /Чекають відповіді з неробочого часу: 1/);
  assert.match(text, /21:14/);
  assert.match(text, /@DityamPlusBot/);
  assert.doesNotMatch(text, /olena@gmail\.com/, 'денне звернення вже бачили вдень');
  assert.equal(afterHoursDigest([rows[1]], CONTACT_TYPE_MAP), null, 'нікого — нічого не шлемо');
  assert.equal(afterHoursDigest([], CONTACT_TYPE_MAP), null);
});

test('нагадування вміщається в одне повідомлення Telegram', () => {
  const rows = Array.from({ length: 40 }, () => ({
    type: 'other', contact: 'x@y.ua', message: 'а'.repeat(4000), created_at: kyiv(22).toISOString(),
  }));
  const text = afterHoursDigest(rows, CONTACT_TYPE_MAP);
  assert.ok(text.length < 4096, `довжина ${text.length}`);
  assert.match(text, new RegExp(`і ще ${40 - DIGEST_MAX}`));
});

test('форма і бот обіцяють відповідь у робочі години', () => {
  assert.match(read('app/contacts/ContactForm.js'), /doneAfterHours/);
  assert.match(read('app/api/contact/route.js'), /afterHours/);
  assert.match(read('app/api/telegram/plus/route.js'), /відповімо обовʼязково в робочі години/);
  const crons = JSON.parse(read('vercel.json')).crons.map((c) => c.path);
  assert.ok(crons.includes('/api/cron/after-hours'), 'ранкове нагадування в розкладі');
});
