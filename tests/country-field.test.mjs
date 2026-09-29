import test from 'node:test';
import assert from 'node:assert/strict';
import { countryFieldValue, countryOptions, countryPatch, ABROAD, MULTI } from '../lib/country-field.js';
import { goesAbroad, placeLabel } from '../lib/geo.js';

test('значення селекта з запису', () => {
  assert.equal(countryFieldValue({ countries: ['UA'] }), 'ua');
  assert.equal(countryFieldValue({ countries: ['gb'] }), 'gb');
  assert.equal(countryFieldValue({ countries: ['de', 'pl'] }), MULTI);
  assert.equal(countryFieldValue({ countries: [], is_international: true }), ABROAD);
  assert.equal(countryFieldValue({}), '');
});

test('«за кордоном» — окрема опція, одразу після України', () => {
  const opts = countryOptions({});
  assert.deepEqual(opts.slice(0, 3).map(([v]) => v), ['', 'ua', ABROAD]);
  assert.ok(opts.some(([v, l]) => v === 'gb' && l === 'Велика Британія'));
});

test('рідкісна країна запису й кілька країн лишаються в списку', () => {
  assert.ok(countryOptions({ countries: ['uz'] }).some(([v]) => v === 'uz'));
  assert.ok(countryOptions({ countries: ['de', 'pl'] }).some(([v]) => v === MULTI));
});

test('що пишемо в базу', () => {
  assert.deepEqual(countryPatch('gb'), { countries: ['gb'] });
  assert.deepEqual(countryPatch(ABROAD), { countries: [], is_international: true });
  assert.deepEqual(countryPatch(''), { countries: [] });
  assert.equal(countryPatch(MULTI), null);
  assert.equal(countryPatch('<script>'), null);
  assert.equal(countryPatch(undefined), null);
});

test('Ньюкасл із країною — картка пише місто, а запис їде за кордон', () => {
  const o = { cities: ['Ньюкасл-апон-Тайн'], format: 'offline', ...countryPatch('gb') };
  assert.equal(goesAbroad(o), true);
  assert.equal(placeLabel(o), 'За кордоном');
});
