// Ліміт заявок з однієї пошти (Марія, 12.10.2026: «заборони проходити
// олімпіаду більше 2х разів»; педагогів із блоку «Для педагогів» — не чіпати).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OLIMP } from '../lib/olimpiada.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('з однієї пошти — не більше 2 заявок, педагогам — лише добовий ліміт', () => {
  assert.equal(OLIMP.maxEntriesPerEmail, 2);
  assert.ok(OLIMP.maxEntriesPerTeacherDay > OLIMP.maxEntriesPerEmailDay);
});

test('start: педагог звільнений від ліміту 2, решта отримує max_entries', () => {
  const src = read('app/api/olimpiada/start/route.js');
  assert.match(src, /teacherByEmail\?\.\(OLIMP\.slug, email\)/);
  assert.match(src, /countByEmail\(email\) >= OLIMP\.maxEntriesPerEmail\) return json\(\{ error: 'max_entries' \}, 429\)/);
  // Ту саму незавершену заявку повертаємо до перевірки ліміту — повторне
  // натискання «Взяти участь» не має впиратись у ліміт.
  assert.ok(src.indexOf('if (again)') < src.indexOf('max_entries'));
  // Адмін (тести Марії) — без лімітів.
  assert.match(src, /if \(!admin\) \{/);
});

test('форма пояснює ліміт і веде педагога до його блоку', () => {
  const src = read('app/olimpiada/EntryForm.js');
  assert.match(src, /max_entries: 'З однієї пошти олімпіаду можна пройти не більше 2 разів/);
  assert.match(src, /«Для педагогів»/);
});

test('сховище вміє рахувати заявки на пошту', () => {
  const src = read('lib/olimpiada-server.js');
  assert.equal((src.match(/countByEmail\(email\)/g) || []).length, 2);
});
