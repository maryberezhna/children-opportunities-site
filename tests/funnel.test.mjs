import test from 'node:test';
import assert from 'node:assert/strict';
import { plusFunnel, plusSources } from '../lib/funnel.js';

const sub = (id, o = {}) => ({ id, status: 'pending', consent_at: null, flow_step: null,
                               wfp_order_reference: null, source: null, ...o });

test('воронка: шість кроків у порядку від бота до оплати', () => {
  const f = plusFunnel({ subs: [sub(1)], childIds: new Set() });
  assert.deepEqual(f.map((s) => s.key), ['bot', 'consent', 'started', 'filled', 'pay', 'paid']);
});

test('воронка рахує втрату на кожному переході', () => {
  const subs = [
    sub(1),                                              // відкрив і зник
    sub(2, { consent_at: '2026-09-01' }),                // погодився, анкету не почав
    sub(3, { consent_at: '2026-09-01', flow_step: 'age' }), // застряг в анкеті
    sub(4, { consent_at: '2026-09-01' }),                // заповнив, до оплати не дійшов
    sub(5, { consent_at: '2026-09-01', wfp_order_reference: 'r5' }), // кинув оплату
    sub(6, { consent_at: '2026-09-01', wfp_order_reference: 'r6', status: 'active' }),
  ];
  const f = plusFunnel({ subs, childIds: new Set([3, 4, 5, 6]) });
  const n = Object.fromEntries(f.map((s) => [s.key, s.n]));
  assert.deepEqual(n, { bot: 6, consent: 5, started: 4, filled: 3, pay: 2, paid: 1 });
  assert.equal(f.find((s) => s.key === 'consent').drop, 1);
  assert.equal(f.find((s) => s.key === 'paid').share, 17);   // 1 із 6
});

// Людина з анкетою в процесі не рахується як «заповнив»: саме ці недороблені
// анкети й були невидимі, коли ми дивились лише на кількість оплат.
test('незавершена анкета не потрапляє в «заповнили»', () => {
  const subs = [sub(1, { consent_at: 'x', flow_step: 'freq' })];
  const f = plusFunnel({ subs, childIds: new Set([1]) });
  assert.equal(f.find((s) => s.key === 'started').n, 1);
  assert.equal(f.find((s) => s.key === 'filled').n, 0);
});

test('порожня база не ділить на нуль', () => {
  const f = plusFunnel({ subs: [], childIds: new Set() });
  assert.equal(f[0].n, 0);
  assert.equal(f[0].share, 0);
  assert.equal(f[1].dropShare, null);
});

test('джерела: сортування за тими, хто оплатив', () => {
  const subs = [sub(1, { source: 'channel' }), sub(2, { source: 'site' }),
                sub(3, { source: 'site', status: 'active' })];
  const r = plusSources(subs);
  assert.deepEqual(r[0], { source: 'site', all: 2, paid: 1 });
  assert.equal(r[1].source, 'channel');
});
