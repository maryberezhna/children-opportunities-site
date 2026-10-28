// 28.10.2026, Марія: «завжди найготовіші спочатку»; аудит Google Search
// Essentials — фото на плитках мають alt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('черга в адмінці: за замовчуванням найготовіші, і ця кнопка перша', () => {
  const q = read('app/admin/Queue.js');
  assert.match(q, /useState\('ready'\)/);
  assert.match(q, /const ORDERS = \[\s*\{ key: 'ready'/);
});

test('фото на плитках підбірок і блогу мають alt з даних', () => {
  for (const [f, re] of [
    ['app/HomeTopics.js', /alt=\{tile\.img\.alt/],
    ['app/TopicPage.js', /alt=\{img\.alt/],
    ['app/olimpiady/page.js', /alt=\{t\.heroImage\.alt/],
    ['app/blog/page.js', /alt=\{e\.hero\.alt/],
  ]) assert.match(read(f), re, f);
});

test('Event: країна місця — з запису, не завжди UA', () => {
  assert.match(read('app/o/shared.js'), /addressCountry: \(item\.countries \|\| \[\]\)\.find/);
});
