import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineCardAfter } from '../lib/inline-card.js';

test('у короткому списку картки немає', () => {
  assert.equal(inlineCardAfter(0), -1);
  assert.equal(inlineCardAfter(2), -1);
  assert.equal(inlineCardAfter(NaN), -1);
});

test('після шостої картки, а в коротшому списку — в кінці', () => {
  assert.equal(inlineCardAfter(3), 2);
  assert.equal(inlineCardAfter(6), 5);
  assert.equal(inlineCardAfter(40), 5);
});

test('позиція налаштовується: на підбірках — після восьмої', () => {
  assert.equal(inlineCardAfter(10, { after: 8 }), 7);
  assert.equal(inlineCardAfter(5, { after: 8 }), 4);
});
