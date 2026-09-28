import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineCardAfter, inlineCardPositions } from '../lib/inline-card.js';

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

// Картка повторюється кожні 20 можливостей (28.09.2026).
//
// До того вона була одна й стояла після четвертої, а на головній видно було
// шість карток — тож той самий заклик («Щоб не шукати вручну») траплявся
// двічі за пів екрана: у списку й одразу під ним.
test('у довгому списку картка повторюється кожні 20', () => {
  assert.deepEqual([...inlineCardPositions(60)], [19, 39]);
  assert.deepEqual([...inlineCardPositions(41)], [19, 39]);
});

test('остання позиція пропускається — під списком і так є блок', () => {
  // 40 карток: після 40-ї нічого не ставимо, бо це кінець видимого списку.
  assert.deepEqual([...inlineCardPositions(40)], [19]);
});

test('у короткому списку картки немає зовсім', () => {
  for (const n of [0, 3, 9, NaN]) {
    assert.equal(inlineCardPositions(n).size, 0, String(n));
  }
});

test('у списку коротшому за 20 вбудованої картки немає', () => {
  // Раніше тут стояло запасне правило «показати один раз у кінці». На
  // телефоні список — 10 карток, і картка ставала ОСТАННЬОЮ: просто над
  // кнопкою «Показати ще», а за нею одразу блок каналу внизу сторінки й
  // спливна підказка. Три однакові заклики на один екран (28.09.2026).
  // У короткому списку заклик і так є під ним.
  assert.deepEqual([...inlineCardPositions(15)], []);
  assert.deepEqual([...inlineCardPositions(10)], []);
  assert.deepEqual([...inlineCardPositions(19)], []);
});

test('крок налаштовується', () => {
  assert.deepEqual([...inlineCardPositions(25, { every: 10, min: 5 })], [9, 19]);
});
