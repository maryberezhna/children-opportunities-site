import test from 'node:test';
import assert from 'node:assert/strict';
import { cutTitle } from '../lib/text.js';

// Скриншот Марії 19.09.2026: у пітчі Dityam+ назва обірвалась на відкритій
// лапці — «Онлайн-консультація «Діалог українських дітей з Радою Європи».
const REAL = 'Онлайн-консультація «Діалог українських дітей з Радою Європи»';

test('коротка назва лишається як є', () => {
  assert.equal(cutTitle('Літня школа робототехніки', 60), 'Літня школа робототехніки');
  assert.equal(cutTitle(REAL, 80), REAL);
});

test('обрізана цитата закривається лапкою', () => {
  const out = cutTitle(REAL, 60);
  assert.ok(out.length <= 62, out);
  assert.ok(out.endsWith('…»'), out);
  assert.equal((out.match(/«/g) || []).length, (out.match(/»/g) || []).length);
});

test('ріжемо по межі слова, без висячої коми чи тире', () => {
  const out = cutTitle('Конкурс молодих виконавців, фіналісти їдуть до Львова', 30);
  assert.equal(out, 'Конкурс молодих виконавців…');
});

test('довге слово ріжемо як є, аби не лишити недогризок', () => {
  const out = cutTitle(`Курс ${'А'.repeat(40)}`, 20);
  assert.equal(out.length, 21);
  assert.ok(out.endsWith('…'));
});

test('порожнє й відсутнє — порожній рядок', () => {
  assert.equal(cutTitle(null), '');
  assert.equal(cutTitle('   '), '');
});
