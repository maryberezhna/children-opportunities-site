// Черга вікон сайту: одночасно лише одне (27.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlayQueue, pickNext, GAP_MS, SETTLE_MS } from '../lib/overlay-queue.js';

// Ручний годинник: schedule лише запамʼятовує, tick просуває час і виконує.
function clock() {
  let t = 0;
  let jobs = [];
  return {
    now: () => t,
    schedule: (fn, ms) => { jobs.push({ at: t + ms, fn }); },
    tick(ms) {
      t += ms;
      const due = jobs.filter((j) => j.at <= t);
      jobs = jobs.filter((j) => j.at > t);
      for (const j of due) j.fn();
    },
  };
}

test('pickNext: найважливіше першим', () => {
  assert.equal(pickNext(new Set(['subscribe', 'night', 'consent'])), 'consent');
  assert.equal(pickNext(new Set(['subscribe', 'lang'])), 'lang');
  assert.equal(pickNext(new Set()), null);
});

test('на старті збираємо заявки й першим виходить мова, а не перше змонтоване', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('night');
  q.request('consent');
  q.request('lang');
  assert.equal(q.active, null);
  c.tick(SETTLE_MS);
  assert.equal(q.active, 'lang');
});

test('наступне — лише після закриття попереднього і паузи', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('lang'); q.request('consent'); q.request('night');
  c.tick(SETTLE_MS);
  q.release('lang');
  assert.equal(q.active, null);
  c.tick(GAP_MS - 1);
  assert.equal(q.active, null);
  c.tick(1);
  assert.equal(q.active, 'consent');
  q.release('consent');
  c.tick(GAP_MS);
  assert.equal(q.active, 'night');
});

test('хто не показується — не тримає чергу', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('night');
  c.tick(SETTLE_MS);
  assert.equal(q.active, 'night', 'мови й cookie немає — нічна тема не чекає на них');
});

test('вікно, відкрите людиною, ховає автоматичне, а те повертається після', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('consent');
  c.tick(SETTLE_MS);
  assert.equal(q.active, 'consent');
  q.request('subscribe', { force: true });
  assert.equal(q.active, 'subscribe');
  assert.ok(q.isWaiting('consent'));
  q.release('subscribe');
  c.tick(GAP_MS);
  assert.equal(q.active, 'consent');
});

test('вибір мови не перебиває навіть дія людини', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('lang');
  c.tick(SETTLE_MS);
  q.request('olimp', { force: true });
  assert.equal(q.active, 'lang');
  q.release('lang');
  c.tick(GAP_MS);
  assert.equal(q.active, 'olimp');
});

test('відкликана заявка зникає з черги', () => {
  const c = clock();
  const q = createOverlayQueue(c);
  q.request('consent'); q.request('subscribe');
  q.release('subscribe');
  c.tick(SETTLE_MS);
  assert.equal(q.active, 'consent');
  q.release('consent');
  c.tick(GAP_MS);
  assert.equal(q.active, null);
});

test('компоненти беруть місце в черзі', async () => {
  const { readFileSync } = await import('node:fs');
  for (const [file, name] of [
    ['app/LangSuggest.js', 'lang'], ['app/ConsentBanner.js', 'consent'], ['app/NightThemePrompt.js', 'night'],
    ['app/OlimpPopup.js', 'olimp'], ['app/SubscribePopup.js', 'subscribe'],
  ]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(new RegExp(`useOverlaySlot\\('${name}'|overlayQueue\\(\\)\\?\\.(request|release)\\('${name}'`).test(src), `${file} → ${name}`);
  }
});
