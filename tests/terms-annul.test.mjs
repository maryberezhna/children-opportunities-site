// Право анулювати доступ і дипломи (Марія, 16.10.2026: «додай в політику нашу
// на сайті що ми має право анулювати доступи аккаунти і дипломи при порушенні
// правил етики»). Механізм уже працює (olimpiada_entries.blocked_at, #925–#927)
// — документ має його описувати, а не навпаки.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('Умови: є право призупинити або анулювати доступ, акаунт і диплом', () => {
  const t = read('app/terms/page.js');
  assert.match(t, /призупинити або анулювати доступ до послуги/);
  assert.match(t, /обліковий запис/);
  assert.match(t, /диплом або сертифікат/);
  assert.match(t, /оскаржити/, 'має бути шлях оскарження');
});

test('Умови англійською дзеркалять українські', () => {
  const en = read('app/en/terms/page.js');
  assert.match(en, /suspend or revoke access/);
  assert.match(en, /diploma or certificate/);
  assert.match(en, /appealed/);
});

test('правила олімпіади: окремий пункт про чесну участь', () => {
  const o = read('app/olimpiada/page.js');
  assert.match(o, /Чесна участь/);
  assert.match(o, /анулювати диплом і доступ до олімпіади/);
  // Посилання на Умови, щоб правило не жило окремо від оферти.
  assert.match(o, /Чесна участь[\s\S]{0,700}href="\/terms"/);
});

test('анулювання за порушення — без повернення коштів', () => {
  const t = read('app/terms/page.js');
  assert.match(t, /анульовано за порушення[\s\S]{0,200}не повертаються/);
  // Виняток для помилкових і задвоєних списань лишається: це вимога
  // платіжного сервісу і те саме написано на /refund.
  assert.match(t, /помилкові або задвоєні списання: їх повертаємо/);
  assert.match(read('app/en/terms/page.js'), /revoked for breaking these Terms[\s\S]{0,200}not refunded/);
});

test('знімки завдань заборонені — в Умовах і правилах олімпіади', () => {
  assert.match(read('app/terms/page.js'), /запис екрана/);
  assert.match(read('app/en/terms/page.js'), /screenshots or screen recordings/);
  assert.match(read('app/olimpiada/page.js'), /Завдання не поширюємо/);
});

test('спілкування лише українською — в Умовах обома мовами', () => {
  assert.match(read('app/terms/page.js'), /лише\s+українською[\s\S]{0,200}відмовити у спілкуванні/);
  assert.match(read('app/en/terms/page.js'), /in Ukrainian only[\s\S]{0,200}decline[\s\S]{0,60}Russian/);
});

test('дату редакції Умов оновлено разом зі змістом', () => {
  assert.match(read('app/terms/page.js'), /const UPDATED = '20 жовтня 2026'/);
  assert.match(read('app/en/terms/page.js'), /const UPDATED = '20 October 2026'/);
});
