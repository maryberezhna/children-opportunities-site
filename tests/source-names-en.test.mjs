// Назви організаторів на /en — англійською (23.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { SOURCE_NAMES_EN, sourceNameIn } = await import('../lib/source-names-en.js');
const { publicSource, RETELLING_CHANNELS } = await import('../lib/source-link.js');
const { clientRows } = await import('../lib/client-rows.js');

const CYR = /[А-Яа-яІіЇїЄєҐґ]/;

test('переклад — без кирилиці й не порожній', () => {
  for (const [uk, en] of Object.entries(SOURCE_NAMES_EN)) {
    assert.ok(en && en.trim(), uk);
    assert.ok(!CYR.test(en), `${uk} → ${en}`);
    assert.equal(uk, uk.trim(), `пробіли в ключі: «${uk}»`);
  }
});

test('канали-переказувачі в словник не потрапляють — їх назва не показується', () => {
  for (const name of RETELLING_CHANNELS) assert.equal(SOURCE_NAMES_EN[name], undefined, name);
});

test('англійська сторінка бере переклад, українська — оригінал', () => {
  const item = { source: 'Пенсійний фонд України', source_url: 'https://www.pfu.gov.ua/' };
  assert.equal(publicSource(item, 'en').sourceName, 'Pension Fund of Ukraine');
  assert.equal(publicSource(item).sourceName, 'Пенсійний фонд України');
  assert.equal(publicSource(item, 'uk').sourceName, 'Пенсійний фонд України');
});

test('немає в словнику — показуємо оригінал, не вигадуємо', () => {
  assert.equal(sourceNameIn('Невідома організація', 'en'), 'Невідома організація');
  assert.equal(sourceNameIn(null, 'en'), null);
});

test('переказувач лишається схованим і на /en', () => {
  assert.equal(publicSource({ source: 'Можливості', source_url: 'https://example.org' }, 'en').sourceName, null);
});

test('картки списку /en отримують англійську назву', () => {
  const [row] = clientRows([{ id: 1, source: 'МОН України', source_url: 'https://mon.gov.ua' }], 'en');
  assert.equal(row.source, 'Ministry of Education and Science of Ukraine');
  const [uk] = clientRows([{ id: 1, source: 'МОН України', source_url: 'https://mon.gov.ua' }]);
  assert.equal(uk.source, 'МОН України');
});
