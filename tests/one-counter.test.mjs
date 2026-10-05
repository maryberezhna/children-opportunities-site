import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { statsOf } from '../lib/supabase.js';
import { visibleFor } from '../lib/audience.js';

// 05.10.2026: головна показувала 711 можливостей, а /about, /press, /plus і
// «Як ми перевіряємо» — 718, бо рахували ще й прострочені записи власним
// HEAD-запитом. Марія: «всюди має бути 1 каунтер». Усі цифри сайту — з
// liveStats() у lib/supabase.js.

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

test('публічні сторінки не рахують можливості власним запитом', () => {
  const root = new URL('..', import.meta.url).pathname;
  const offenders = [...walk(join(root, 'app')), ...walk(join(root, 'lib'))]
    .filter((f) => !f.includes('/app/admin/') && !f.includes('/app/api/'))
    .filter((f) => /publicOpportunities\([^)]*count:\s*'exact'/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'лічильник — лише liveStats() / countActiveOpportunities()');
});

test('прострочене не входить у лічильник — як і в список на головній', () => {
  const today = '2026-10-05';
  const rows = [
    { id: 1, cost_type: 'free', source: 'a', deadline: '2026-10-10' },
    { id: 2, cost_type: 'paid', source: 'b', deadline: '2026-10-01' },
    { id: 3, cost_type: 'free', source: 'a', event_end_date: '2026-09-30' },
    { id: 4, cost_type: 'free', source: 'c' },
  ];
  const live = visibleFor(rows, today);
  const stats = statsOf(live);
  assert.equal(stats.total, live.length);
  assert.equal(stats.total, 2);
  assert.equal(stats.free, 2);
  assert.equal(stats.sources, 2);
});

test('«перевірено за 3 доби» не більше за загальне число', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const rows = [
    { id: 1, last_verified_at: '2026-10-05T01:00:00Z' },
    { id: 2, last_verified_at: '2026-09-20T01:00:00Z' },
    { id: 3, last_verified_at: null },
  ];
  const stats = statsOf(rows, now);
  assert.equal(stats.verified, 1);
  assert.ok(stats.verified <= stats.total);
});
