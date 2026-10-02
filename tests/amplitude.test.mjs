import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { amplitudeKey, amplitudeIsEu } from '../lib/amplitude.js';

const KEY = '0123456789abcdef0123456789abcdef';

test('без ключа Amplitude вимкнений', () => {
  assert.equal(amplitudeKey({}), '');
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: '' }), '');
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: '   ' }), '');
});

test('ключ — рівно 32 шістнадцяткові символи', () => {
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: KEY }), KEY);
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: ` ${KEY}\n` }), KEY);
  // Ключ іде в адресу скрипта й у текст inline-скрипта: усе, що не схоже на
  // ключ, туди потрапити не повинно.
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: 'TODO' }), '');
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: `${KEY}'); alert(1); ('` }), '');
  assert.equal(amplitudeKey({ NEXT_PUBLIC_AMPLITUDE_API_KEY: KEY.slice(1) }), '');
});

test('європейський дата-центр вмикається лише значенням EU', () => {
  assert.equal(amplitudeIsEu({}), false);
  assert.equal(amplitudeIsEu({ NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE: 'US' }), false);
  assert.equal(amplitudeIsEu({ NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE: 'eu' }), true);
  assert.equal(amplitudeIsEu({ NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE: ' EU ' }), true);
});

test('Amplitude поважає вимикач власного трафіку', () => {
  // Марія й модератори (?noga=1, адмінка), прев'ю й headless не рахуються в
  // GA4 — і в Amplitude теж: і сам скрипт, і дзеркало подій дивляться на
  // той самий прапорець.
  const src = readFileSync(new URL('../app/Analytics.js', import.meta.url), 'utf8');
  const tag = src.slice(src.indexOf('<Script id="amplitude"'));
  assert.match(tag, /if \(!window\.__dityamNoAnalytics\)/);
  const mirror = src.slice(src.indexOf('function gtag(){'), src.indexOf("gtag('js', new Date());"));
  assert.match(mirror, /!window\.__dityamNoAnalytics/);
  assert.match(mirror, /arguments\[1\] !== 'conversion'/);
});
