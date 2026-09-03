// Пошук: інваріанти, через які він уже ламався. Головний кейс — реальний:
// Марія шукала «build for future», а запис звався «Build Future», і суцільний
// підрядковий пошук його не бачив через зайве «for».
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHaystack, queryTokens, matchesQuery } from '../lib/search.js';

const hit = (q, fields) => matchesQuery(queryTokens(q), buildHaystack(fields));

test('«build for future» знаходить «Build Future» — службове «for» не блокує', () => {
  assert.ok(hit('build for future', ['Build Future — безкоштовна інженерна школа']));
});

test('слова запиту можуть жити в різних полях: назва + місто', () => {
  assert.ok(hit('шахи київ', ['Шахи', 'гурток для школярів', 'Київ']));
});

test('морфологія: «табори» знаходить «табір» і навпаки', () => {
  assert.ok(hit('табори', ['Літній табір у Карпатах']));
  assert.ok(hit('табір', ['Літні табори Rotary']));
});

test('чергування і/о: «гуртки» знаходить «гурток»', () => {
  assert.ok(hit('гуртки', ['Гурток кераміки']));
});

test('чергування ї/є: «києві» знаходить місто «Київ»', () => {
  assert.ok(hit('києві', ['Курси програмування', 'Київ']));
});

test('апострофи різних розкладок збігаються', () => {
  assert.ok(hit("комп'ютер", ['Компʼютерна графіка для підлітків']));
});

test('нерелевантне не прилипає: «стипендія» не знаходить гурток танців', () => {
  assert.ok(!hit('стипендія', ['Гурток сучасних танців', 'Львів']));
});

test('порожній запит і самі службові слова показують усе', () => {
  assert.equal(queryTokens('').length, 0);
  assert.equal(queryTokens('для і в').length, 0);
});
