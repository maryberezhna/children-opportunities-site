// Search Console, 12.10.2026: «Indexed, though blocked by robots.txt».
// Адреси /api/, на які посилаються сторінки, Google мусить могти прочитати,
// щоб побачити noindex; решта /api/ лишається закритою.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('посилані /api/-адреси відкриті, решта /api/ і /admin — ні', () => {
  const src = readFileSync(new URL('../app/robots.js', import.meta.url), 'utf8');
  assert.match(src, /const ALLOW = \['\/', '\/api\/catalog\/', '\/api\/events\/', '\/api\/olimpiada\/diploma'\]/);
  assert.match(src, /const DISALLOW = \['\/admin', '\/api\/'\]/);
  assert.match(src, /userAgent: '\*', allow: ALLOW, disallow: DISALLOW/);
});

test('усі /api/-відповіді мають X-Robots-Tag: noindex', () => {
  const cfg = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');
  assert.match(cfg, /source: '\/api\/:path\*', headers: \[\{ key: 'X-Robots-Tag', value: 'noindex/);
});
