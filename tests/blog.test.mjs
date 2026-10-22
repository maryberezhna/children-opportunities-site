// Блог (22.10.2026): кожна стаття — з джерелами, датою звірки, FAQ, живим
// списком з існуючої підбірки й перелінковкою лише на живі адреси сайту.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { BLOG_POSTS, BLOG_GUIDES, blogEntries, richParts, internalLinks } = await import('../lib/blog.js');
const { TOPICS, TOPIC_LIST } = await import('../lib/topics.js');
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => fs.existsSync(new URL(`../${p}`, import.meta.url));

const ROUTES = new Set([
  ...TOPIC_LIST.map((t) => `/${t.slug}`),
  '/olimpiady', '/erasmus', '/blog', '/olimpiada', '/modnyi-kod', '/plus', '/dedlainy',
  ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
]);

test('слаги статей унікальні й латиницею', () => {
  const slugs = BLOG_POSTS.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

test('кожна стаття має джерела, дату звірки, FAQ і фото', () => {
  for (const p of BLOG_POSTS) {
    assert.ok(p.sources.length >= 1 && p.sources.every((s) => /^https:\/\//.test(s.url)), p.slug);
    assert.match(p.checked, /^\d{4}-\d{2}-\d{2}$/, p.slug);
    assert.match(p.published, /^\d{4}-\d{2}-\d{2}$/, p.slug);
    assert.ok(p.faq.length >= 3, p.slug);
    assert.ok(exists(`public${p.hero.src}.jpg`) && exists(`public${p.hero.src}.webp`), p.slug);
    assert.ok(exists(`public${p.hero.src}-450.jpg`), `${p.slug}: картка в блозі бере -450`);
  }
});

test('живий список береться з існуючої підбірки, related — існуючі підбірки', () => {
  for (const p of BLOG_POSTS) {
    assert.ok(TOPICS[p.cards.topic], p.slug);
    for (const r of p.related) assert.ok(TOPICS[r], `${p.slug}: ${r}`);
  }
});

test('перелінковка: у тексті є внутрішні посилання, і всі ведуть на живі адреси', () => {
  for (const p of BLOG_POSTS) {
    const links = internalLinks(p);
    assert.ok(links.length >= 1, `${p.slug}: стаття без жодного посилання на сайт`);
    for (const href of links) assert.ok(ROUTES.has(href), `${p.slug}: ${href} — такої сторінки немає`);
  }
});

test('розмітка посилань розбирається', () => {
  const parts = richParts('Див. [підбірку](/bezkoshtovni-tabory) і [джерело](https://msp.gov.ua).');
  assert.deepEqual(parts.map((x) => x.href || null), [null, '/bezkoshtovni-tabory', null, 'https://msp.gov.ua', null]);
  assert.equal(parts[1].internal, true);
  assert.equal(parts[3].internal, false);
});

test('слововжиток: «платформа», не «каталог»; без «Dityam+ —»; назва повністю', () => {
  const txt = JSON.stringify(BLOG_POSTS) + JSON.stringify(BLOG_GUIDES);
  assert.doesNotMatch(txt, /каталог/i);
  assert.doesNotMatch(txt, /Dityam\+\s*[—–-]/);
  assert.doesNotMatch(txt, /Dityam(?!\.com\.ua|\+)/);
});

test('путівники стоять у блозі на своїх адресах', () => {
  const hrefs = blogEntries().map((e) => e.href);
  assert.ok(hrefs.includes('/olimpiady') && hrefs.includes('/erasmus'));
});

test('блог є в карті сайту, llms.txt і футері', () => {
  assert.match(read('app/sitemap.js'), /BLOG_PATH/);
  assert.match(read('app/sitemap.js'), /BLOG_POSTS\.map/);
  assert.match(read('app/llms.txt/route.js'), /\/blog\)/);
  assert.match(read('app/Footer.js'), /blog: '\/blog'/);
});

test('блог є в шапці (українська версія) — і на компʼютері, і в мобільному меню', () => {
  const h = read('app/Header.js');
  assert.match(h, /\{ href: '\/blog', label: 'Блог'/);
  // NAV рендериться і в шапці, і в мобільному меню.
  assert.equal((h.match(/\{NAV\.map\(/g) || []).length, 2);
});
