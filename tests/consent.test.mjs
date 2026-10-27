// Згода на cookie для ЄС/ЄЕЗ, Британії й Швейцарії і вікно вибору мови (27.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONSENT_COUNTRIES, needsConsent, analyticsBlocked, shouldAskConsent,
  consentFromCookie, CONSENT_DEFAULT_SNIPPET,
} from '../lib/consent.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('країни згоди: 27 ЄС + Ісландія, Ліхтенштейн, Норвегія + Британія й Швейцарія', () => {
  assert.equal(CONSENT_COUNTRIES.size, 32);
  for (const c of ['DE', 'PL', 'FR', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH']) assert.ok(needsConsent(c), c);
  for (const c of ['UA', 'US', 'MD', 'GE', 'CA', '', null]) assert.ok(!needsConsent(c), String(c));
  assert.ok(needsConsent('de'), 'регістр не важливий');
});

test('аналітика стримується лише в регіоні eu без «Прийняти»', () => {
  assert.equal(analyticsBlocked(''), false, 'Україна й решта світу — як було');
  assert.equal(analyticsBlocked('dityam_region=eu'), true);
  assert.equal(analyticsBlocked('dityam_region=eu; dityam_consent=denied'), true);
  assert.equal(analyticsBlocked('x=1; dityam_region=eu; dityam_consent=granted'), false);
});

test('банер сам — лише в регіоні eu, поки вибору немає', () => {
  assert.equal(shouldAskConsent(''), false);
  assert.equal(shouldAskConsent('dityam_region=eu'), true);
  assert.equal(shouldAskConsent('dityam_region=eu; dityam_consent=denied'), false);
  assert.equal(consentFromCookie('dityam_consent=whatever'), null);
});

test('Consent Mode default стоїть до gtag config, Hotjar і Amplitude чекають згоди', () => {
  const src = read('app/Analytics.js');
  const snippet = src.indexOf('${CONSENT_DEFAULT_SNIPPET}');
  const config = src.indexOf("gtag('config', '${GA_ID}')");
  assert.ok(snippet > 0 && config > snippet, 'consent default — до config');
  assert.match(CONSENT_DEFAULT_SNIPPET, /gtag\('consent', 'default'/);
  assert.match(CONSENT_DEFAULT_SNIPPET, /analytics_storage: 'denied'/);
  assert.match(src, /if \(!window\.__dityamConsentPending\) window\.__dityamLoadHotjar\(\)/);
  assert.match(src, /if \(!window\.__dityamConsentPending\) window\.__dityamLoadAmplitude\(\)/);
});

test('inline-правило consent збігається з analyticsBlocked', () => {
  const run = (cookie) => {
    const calls = [];
    const window = {};
    const document = { cookie };
    const gtag = (...a) => calls.push(a);
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'gtag', CONSENT_DEFAULT_SNIPPET)(window, document, gtag);
    return { pending: window.__dityamConsentPending, calls };
  };
  for (const c of ['', 'dityam_region=eu', 'dityam_region=eu; dityam_consent=granted', 'dityam_region=eu; dityam_consent=denied']) {
    const r = run(c);
    assert.equal(r.pending, analyticsBlocked(c), c);
    assert.equal(r.calls.length, r.pending ? 1 : 0, c);
  }
});

test('middleware: регіон eu ставиться, ab_card у регіоні згоди без «Прийняти» — ні', () => {
  const src = read('middleware.js');
  assert.match(src, /needsConsent\(country\)/);
  assert.match(src, /if \(set && abAllowed\)/);
});

test('банер змонтовано, кнопки рівноцінні, у політиці є #cookies', () => {
  assert.match(read('app/layout.js'), /<ConsentBanner \/>/);
  const banner = read('app/ConsentBanner.js');
  assert.equal((banner.match(/className="consent-btn"/g) || []).length, 2, 'обидві кнопки одного класу');
  assert.match(read('app/privacy/page.js'), /id="cookies"/);
  assert.match(read('app/en/privacy/page.js'), /id="cookies"/);
  assert.match(read('app/Footer.js'), /<CookieSettingsLink/);
});

test('вікно вибору мови — діалог із двома мовами', () => {
  const src = read('app/LangSuggest.js');
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /Оберіть мову/);
  assert.match(src, /Choose your language/);
  assert.match(src, /Escape/);
});
