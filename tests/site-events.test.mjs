import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE_EVENTS, SITE_EVENT_NAMES, sendSiteEvent, markVisit, isPlusPath } from '../lib/site-events.js';

function withBrowser(fn, { noAnalytics = false } = {}) {
  const sent = [];
  const store = new Map();
  // navigator у Node 22 — властивість лише для читання, звичайне присвоєння
  // кидає TypeError. Тому підміняємо через defineProperty і повертаємо як було.
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const set = (name, value) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

  set('window', { __dityamNoAnalytics: noAnalytics });
  set('navigator', { sendBeacon: (url, body) => { sent.push({ url, body }); return true; } });
  set('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  set('Blob', class { constructor(parts) { this.parts = parts; } });
  try { fn(sent); } finally {
    delete globalThis.window; delete globalThis.sessionStorage; delete globalThis.Blob;
    if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    else delete globalThis.navigator;
  }
}

test('подію зі списку відправляємо на /api/event', () => {
  withBrowser((sent) => {
    assert.equal(sendSiteEvent(SITE_EVENTS.PLUS_CLICK), true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/event');
    assert.equal(sent[0].body.parts[0], JSON.stringify({ name: 'plus_click' }));
  });
});

// Інакше будь-хто перетворив би таблицю на смітник, а воронку — на вигадку.
test('чужу назву не відправляємо', () => {
  withBrowser((sent) => {
    assert.equal(sendSiteEvent('щось своє'), false);
    assert.equal(sent.length, 0);
  });
});

// Той самий прапорець, що вимикає GA4: заходи Марії й модераторів псували
// статистику ще в GA4, і власний лічильник мав би ту саму ваду.
test('свій браузер (?noga=1) не рахується', () => {
  withBrowser((sent) => {
    assert.equal(sendSiteEvent(SITE_EVENTS.VISIT), false);
    assert.equal(markVisit(), false);
    assert.equal(sent.length, 0);
  }, { noAnalytics: true });
});

// Якби «зайшов» рахувався на кожній сторінці, верхній крок показував би
// перегляди, а не людей: у нас ~4 сторінки за сесію, і конверсія виглядала б
// учетверо меншою, ніж є.
test('«зайшов на сайт» — раз на сесію', () => {
  withBrowser((sent) => {
    assert.equal(markVisit(), true);
    assert.equal(markVisit(), false);
    assert.equal(markVisit(), false);
    assert.equal(sent.length, 1);
  });
});

test('сторінка Dityam+ впізнається і українською, і англійською', () => {
  for (const p of ['/plus', '/plus/', '/en/plus', '/en/plus/']) assert.ok(isPlusPath(p), p);
  for (const p of ['/', '/plusy', '/en/plusy', '/o/plus-something', null]) assert.equal(isPlusPath(p), false, String(p));
});

test('поза браузером нічого не робимо', () => {
  assert.equal(sendSiteEvent(SITE_EVENTS.VISIT), false);
  assert.equal(markVisit(), false);
  assert.deepEqual(SITE_EVENT_NAMES, ['visit', 'plus_view', 'plus_click']);
});
