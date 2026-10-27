import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reachOf, reachDoubt, reachLabel, REACH } from '../lib/reach.js';

// Ті самі приклади читає бот: scraper/tests/test_reach.py.
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/reach-cases.json', import.meta.url), 'utf8'));

test('спільні приклади: група й сумнів', () => {
  for (const c of FIXTURE.cases) {
    assert.equal(reachOf(c.item), c.reach, c.name);
    assert.equal(reachDoubt(c.item), c.doubt, c.name);
  }
});

test('у прикладах є кожна група', () => {
  for (const r of REACH) assert.ok(FIXTURE.cases.some((c) => c.reach === r), r);
});

test('підписи груп — назви з меню сайту', () => {
  assert.equal(reachLabel('ukraine'), '🇺🇦 В Україні');
  assert.equal(reachLabel('online'), '💻 Онлайн для всіх');
  // Ті самі слова, що в меню: «Живемо за кордоном» і «За кордон».
  assert.equal(reachLabel('diaspora'), '🌍 Живемо за кордоном');
  assert.equal(reachLabel('travel'), '✈️ Поїхати за кордон');
  assert.equal(reachLabel('travel', 'en'), '✈️ Going abroad');
  assert.equal(reachLabel(null), '');
});
