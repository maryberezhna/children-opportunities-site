// Власні записи Марії не рахуються в метриках (08.10.2026: «видаляй усюди, де
// бачиш @maryberezhna, з метрик»), а «Оформлює» — лише хто діяв за добу.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { isOwn, notOwn } = await import('../lib/own.js');
const { isStalled, peopleRows } = await import('../lib/plusPeople.js');
const read = (f) => readFileSync(f, 'utf8');

test('свої записи впізнаються за чатом, ніком і поштою', () => {
  assert.ok(isOwn({ telegram_chat_id: 388954322 }));
  assert.ok(isOwn({ telegram_handle: '@maryberezhna' }));
  assert.ok(isOwn({ telegram_username: 'MaryBerezhna' }));
  assert.ok(isOwn({ parent_email: 'Maryberezhna@gmail.com' }));
  assert.ok(isOwn({ email: 'mashaberezhna0209@gmail.com' }));
  assert.ok(!isOwn({ telegram_handle: '@mama', email: 'mama@example.com' }));
  assert.deepEqual(notOwn([{ telegram_chat_id: '388954322' }, { telegram_chat_id: '1' }]), [{ telegram_chat_id: '1' }]);
});

test('метрики й адмінка фільтрують свої записи', () => {
  for (const f of ['app/admin/metrics/page.js', 'app/admin/plus/page.js', 'app/admin/korystuvachi/page.js', 'app/admin/today/page.js',
    'app/api/telegram/webhook/route.js', 'scripts/plus-stats.mjs', 'scripts/metrics-snapshot.mjs']) {
    assert.match(read(f), /notOwn\(/, f);
  }
});

test('«Оформлює» лише до доби, далі — «Зупинились»; подарунок — ні', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(isStalled({ status: 'pending', updated_at: '2026-10-08T08:00:00Z' }, now), false);
  assert.equal(isStalled({ status: 'pending', updated_at: '2026-10-06T08:00:00Z' }, now), true);
  assert.equal(isStalled({ status: 'pending', billing_period: 'gift', created_at: '2026-10-01T08:00:00Z' }, now), false);
  assert.equal(isStalled({ status: 'active', updated_at: '2026-09-01T08:00:00Z' }, now), false);
  const [row] = peopleRows({ subs: [{ id: 1, status: 'pending', telegram_handle: 'x', telegram_chat_id: 5, created_at: '2026-10-01T00:00:00Z' }], now });
  assert.equal(row.status, 'stalled');
});
