import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSignature, cardSlugFromHref } from '../lib/track.js';

// Воронки 29.09.2026: filter_apply і card_click.
test('filterSignature: порожній стан — порожній рядок', () => {
  assert.equal(filterSignature({}), '');
  assert.equal(filterSignature({ type: [], age: [], deadline: 'all', need: [], cost: 'all', place: [] }), '');
});

test('filterSignature: лише непорожні групи, у сталому порядку', () => {
  assert.equal(
    filterSignature({ cost: 'free', type: ['camp', 'club'], age: ['12-14'] }),
    'type=camp,club;age=12-14;cost=free',
  );
});

test('filterSignature: місто сторінки міста — не фільтр людини', () => {
  assert.equal(filterSignature({ place: ['Київ'], presetCity: 'Київ' }), '');
  assert.equal(filterSignature({ place: ['Київ', 'Львів'], presetCity: 'Київ' }), 'place=Київ,Львів');
});

test('cardSlugFromHref дістає slug зі сторінки можливості', () => {
  assert.equal(cardSlugFromHref('/o/bur-tabir-efb0d6'), 'bur-tabir-efb0d6');
  assert.equal(cardSlugFromHref('/en/o/some-slug?x=1'), 'some-slug');
  assert.equal(cardSlugFromHref('/tabory'), null);
  assert.equal(cardSlugFromHref(null), null);
});
