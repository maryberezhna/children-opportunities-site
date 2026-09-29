import test from 'node:test';
import assert from 'node:assert/strict';
import { abroadPlaceText, foreignOnly, detailCities, detailCountries } from '../lib/place.js';

test('місто й країна — разом', () => {
  assert.equal(abroadPlaceText({ cities: ['Прага'], countries: ['cz'] }), 'Прага, Чехія');
  assert.equal(abroadPlaceText({ cities: ['Прага'], countries: ['cz'] }, 'en'), 'Прага, Czechia');
});

test('українське місто з закордонною країною — не «Київ, Греція»', () => {
  assert.equal(abroadPlaceText({ cities: ['Київ'], countries: ['ua', 'gr'] }), 'Київ і за кордоном');
});

test('рядок «Країна» з Україною, якщо вона є в записі', () => {
  assert.deepEqual(detailCountries({ countries: ['ua', 'gr'] }), ['Україна', 'Греція']);
  assert.deepEqual(detailCountries({ countries: ['ua'] }), []);
  assert.deepEqual(detailCountries({ countries: ['cz'] }), ['Чехія']);
});

test('лише країна, кілька країн, нічого', () => {
  assert.equal(abroadPlaceText({ cities: [], countries: ['pl'] }), 'Польща');
  assert.equal(abroadPlaceText({ countries: ['pl', 'de'] }), 'Польща, Німеччина');
  assert.equal(abroadPlaceText({ is_international: true, countries: [] }), null);
});

test('«за кордоном» у полі міста — не місто', () => {
  assert.equal(abroadPlaceText({ cities: ['за кордоном'], countries: ['it'] }), 'Італія');
});

test('рядок «Місто» без «за кордоном» і без «Міжнародні» біля країни', () => {
  assert.deepEqual(detailCities({ cities: ['за кордоном'], countries: ['ie'] }), []);
  assert.deepEqual(detailCities({ cities: ['Міжнародні'], countries: ['gr'] }), []);
  assert.deepEqual(detailCities({ cities: ['Міжнародні'], countries: [] }), ['Міжнародні']);
  assert.deepEqual(detailCities({ cities: ['Київ'], countries: ['ua'] }), ['Київ']);
});

test('лише закордонні записи ховають місто з фільтра «Де»', () => {
  assert.equal(foreignOnly({ countries: ['ie'] }), true);
  assert.equal(foreignOnly({ countries: ['ua', 'pl'] }), false);
  assert.equal(foreignOnly({ countries: [], is_international: true }), false);
});
