// «Чим цікавляться в Dityam+» на /admin/today (24.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plusInterests } from '../lib/plusInterests.js';

const subs = [
  { id: 'a', status: 'active', places: ['Київ'], cost_pref: 'free_only', role: 'parent' },
  { id: 'b', status: 'pending', places: ['__other'], cost_pref: 'any', role: null },
  { id: 'c', status: 'active', places: [], cost_pref: 'any', role: 'teen' }, // без дітей — не рахуємо
];
const kids = [
  { subscriber_id: 'a', likes: ['arts', 'languages'], formats: ['camps'], age_bands: ['11-14'], needs: ['veteran_family'] },
  { subscriber_id: 'a', likes: ['arts'], formats: ['camps', 'grants'], age_bands: ['15-18'], needs: [] },
  { subscriber_id: 'b', likes: ['stem'], formats: [], age_bands: ['7-10'], needs: null },
  { subscriber_id: 'zzz', likes: ['sport'] }, // родини немає (наприклад, власна Марії, відсіяна раніше)
];

test('рахує лише родини з дітьми й лише їхніх дітей', () => {
  const r = plusInterests(subs, kids);
  assert.equal(r.families, 2);
  assert.equal(r.kids, 3);
  assert.equal(r.active, 1);
  assert.equal(r.freeOnly, 1);
});

test('вподобання з підписами й відсотком від дітей, найчастіше першим', () => {
  const r = plusInterests(subs, kids);
  assert.deepEqual(r.likes[0], { key: 'arts', label: 'Творчість', n: 2, pct: 67 });
  assert.ok(!r.likes.some((x) => x.key === 'sport'));
});

test('вік — у порядку анкети, місце й роль — від родин', () => {
  const r = plusInterests(subs, kids);
  assert.deepEqual(r.ages.map((x) => x.key), ['7-10', '11-14', '15-18']);
  assert.equal(r.places.find((x) => x.key === '__other').label, 'Мого міста немає в списку');
  assert.equal(r.places.find((x) => x.key === 'Київ').pct, 50);
  assert.equal(r.roles.find((x) => x.key === 'none').label, 'Не вказано');
});

test('порожньо — без ділення на нуль', () => {
  const r = plusInterests([], []);
  assert.equal(r.kids, 0);
  assert.deepEqual(r.likes, []);
});
