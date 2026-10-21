// «Наші можливості» (/nashi-mozhlyvosti, 13.10.2026): аналітика й SEO/GEO
// (Марія: «і аналітику там», «і оптимізацію під гео сео»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownOpportunities, OWN_PATH } from '../lib/own-opportunities.js';
import { PLUS_FREE } from '../lib/plus.js';
import { SITE_EVENT_NAMES } from '../lib/site-events.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('кожна картка має ключ для аналітики й веде на свою сторінку', () => {
  const items = ownOpportunities({ plusMonth: 99 });
  assert.ok(items.length >= 2);
  for (const it of items) {
    assert.match(it.key, /^[a-z-]+$/);
    assert.match(it.href, /^\/[a-z-]+$/);
  }
  // Поки Dityam+ безкоштовний (PLUS_FREE), у картці стоїть слово, а не ціна:
  // суперечність між карткою й ботом, який грошей не просить, гірша за
  // відсутність числа.
  assert.match(items.find((i) => i.key === 'plus').note, PLUS_FREE ? /безкоштовно/ : /99 грн\/міс/);
});

test('лічильники own_view і own_click приймає /api/event', () => {
  assert.ok(SITE_EVENT_NAMES.includes('own_view'));
  assert.ok(SITE_EVENT_NAMES.includes('own_click'));
  const page = read('app/nashi-mozhlyvosti/page.js');
  assert.match(page, /<OwnTrack \/>/);
  assert.match(page, /data-own=\{it\.key\}/);
  assert.match(read('app/admin/korystuvachi/page.js'), /'own_view'/);
});

test('SEO/GEO: canonical, OG-картинка, FAQPage з видимими відповідями, карта сайту, llms.txt', () => {
  const page = read('app/nashi-mozhlyvosti/page.js');
  assert.match(page, /canonical: URL/);
  assert.match(page, /'@type': 'FAQPage'/);
  assert.match(page, /'@type': 'BreadcrumbList'/);
  assert.match(page, /className="own-faq"/);
  assert.match(read('app/nashi-mozhlyvosti/opengraph-image.js'), /ownOgImage/);
  assert.ok(read('app/sitemap.js').includes(OWN_PATH));
  assert.ok(read('app/llms.txt/route.js').includes(OWN_PATH));
});

test('ніде «Dityam+ —» (читається «плюс мінус»)', () => {
  for (const f of ['app/nashi-mozhlyvosti/page.js', 'lib/own-opportunities.js', 'lib/og-own.js']) {
    assert.doesNotMatch(read(f), /Dityam\+ —/, f);
  }
});
