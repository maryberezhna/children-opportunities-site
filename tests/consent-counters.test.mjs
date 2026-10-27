// Власні лічильники (site_events, opportunity_clicks) — для ЄС лише після «Прийняти» (27.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyticsAllowed } from '../lib/consent.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('analyticsAllowed: Україна й світ — так; ЄС — лише після згоди', () => {
  assert.equal(analyticsAllowed(''), true);
  assert.equal(analyticsAllowed('dityam_lang=uk'), true);
  assert.equal(analyticsAllowed('dityam_region=eu'), false);
  assert.equal(analyticsAllowed('dityam_region=eu; dityam_consent=denied'), false);
  assert.equal(analyticsAllowed('dityam_region=eu; dityam_consent=granted'), true);
});

// Імітуємо браузер: cookie, сховище сесії й маяк.
function fakeBrowser(cookie) {
  const store = new Map();
  const beacons = [];
  globalThis.window = { location: { search: '', pathname: '/' }, __dityamNoAnalytics: false };
  globalThis.document = { cookie, referrer: '' };
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  Object.defineProperty(globalThis, 'navigator', {
    value: { sendBeacon: (url) => { beacons.push(url); return true; } }, configurable: true,
  });
  return { store, beacons };
}

test('ЄС без згоди: візит не рахується й нічого не пишеться в сховище', async () => {
  const { store, beacons } = fakeBrowser('dityam_region=eu');
  const { markVisit, sendSiteEvent, SITE_EVENTS } = await import('../lib/site-events.js');
  assert.equal(markVisit(), false);
  assert.equal(sendSiteEvent(SITE_EVENTS.PLUS_VIEW), false);
  assert.equal(store.size, 0);
  assert.equal(beacons.length, 0);
});

test('ЄС зі згодою і Україна: рахується, як і раніше', async () => {
  const { markVisit } = await import('../lib/site-events.js');
  let b = fakeBrowser('dityam_region=eu; dityam_consent=granted');
  assert.equal(markVisit(), true);
  assert.deepEqual(b.beacons, ['/api/event']);
  b = fakeBrowser('');
  assert.equal(markVisit(), true);
  assert.equal(b.store.get('dityam:visited'), '1');
});

test('лічильники сторінок і переходів перевіряють згоду', () => {
  for (const f of ['app/olimpiada/OlimpTrack.js', 'app/nashi-mozhlyvosti/OwnTrack.js', 'app/modnyi-kod/MkTrack.js']) {
    assert.match(read(f), /analyticsAllowed\(\)/, f);
  }
  assert.match(read('lib/track.js'), /analyticsAllowed\(\) && navigator\.sendBeacon/);
});

test('у політиці більше немає Google Ads — у продакшні його не налаштовано', () => {
  for (const f of ['app/privacy/page.js', 'app/en/privacy/page.js']) {
    assert.ok(!/Google Ads/.test(read(f)), f);
  }
});
