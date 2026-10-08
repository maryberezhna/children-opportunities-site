// Захисні заголовки (план безпеки, 08.10.2026): без них сайт можна вбудувати в
// чужий фрейм, а браузер вгадує тип файлів.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
process.env.VERCEL = '1';
const config = require('../next.config.js');

test('усі сторінки віддають захисні заголовки', async () => {
  const cfg = typeof config === 'function' ? await config('phase-production-server', {}) : config;
  const rules = await cfg.headers();
  const all = rules.find((r) => r.source === '/:path*');
  assert.ok(all, 'немає правила на всі адреси');
  const h = Object.fromEntries(all.headers.map((x) => [x.key, x.value]));
  assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
  assert.match(h['Content-Security-Policy'], /frame-ancestors 'self'/);
  // Скрипти CSP не обмежує: GA4, Hotjar і Amplitude вбудовані інлайном.
  assert.doesNotMatch(h['Content-Security-Policy'], /script-src/);
});

test('мітка Google AdSense у <head> (08.10.2026)', () => {
  const layout = readFileSync('app/layout.js', 'utf8');
  assert.match(layout, /'google-adsense-account': 'ca-pub-9994894072460383'/);
});
