import test from 'node:test';
import assert from 'node:assert/strict';
import { packFullRows } from '../lib/grid-rows.js';

const full = (c) => c.startsWith('G');

test('без блоків на весь рядок порядок не змінюється', () => {
  assert.deepEqual(packFullRows(['a', 'b', 'c'], full), ['a', 'b', 'c']);
});

test('блок на парному місці лишається на місці', () => {
  assert.deepEqual(packFullRows(['a', 'b', 'G', 'c', 'd'], full), ['a', 'b', 'G', 'c', 'd']);
});

test('блок після самотньої картки стає перед нею — дірки немає', () => {
  // Головна 30.09.2026: картка «Ось як це було…» сама в рядку, поруч пусто,
  // під нею олімпіади на всю ширину.
  assert.deepEqual(packFullRows(['a', 'b', 'c', 'G', 'd', 'e'], full), ['a', 'b', 'G', 'c', 'd', 'e']);
  // Другий блок після повного рядка лишається на місці; після неповного —
  // теж стає перед ним.
  assert.deepEqual(packFullRows(['a', 'G1', 'b', 'G2'], full), ['G1', 'a', 'b', 'G2']);
  assert.deepEqual(packFullRows(['a', 'b', 'c', 'G1', 'd', 'G2'], full), ['a', 'b', 'G1', 'c', 'd', 'G2']);
  assert.deepEqual(packFullRows(['a', 'b', 'c', 'G1', 'd', 'e', 'G2'], full), ['a', 'b', 'G1', 'c', 'd', 'G2', 'e']);
});

test('три колонки: блок стає перед двома картками неповного рядка', () => {
  assert.deepEqual(packFullRows(['a', 'b', 'c', 'd', 'e', 'G', 'f'], full, 3), ['a', 'b', 'c', 'G', 'd', 'e', 'f']);
});

test('два блоки поспіль обидва стають перед неповним рядком', () => {
  assert.deepEqual(packFullRows(['a', 'G1', 'G2', 'b'], full), ['G1', 'G2', 'a', 'b']);
});
