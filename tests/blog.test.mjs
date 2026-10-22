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

test('статті блогу й путівники — 3 колонки карток на широкому екрані', () => {
  const css = read('app/styles/topic-v2.css');
  assert.match(css, /@media \(min-width: 1100px\) \{\s*\.er-open \.tp-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
});

test('банер каналу в статтях і путівниках — після повних рядів (6, далі кожні 18)', () => {
  assert.match(read('app/topic/TopicCards.js'), /firstBanner = 2, bannerEvery = 20/);
  for (const f of ['app/blog/[slug]/page.js', 'app/erasmus/page.js']) {
    assert.match(read(f), /firstBanner=\{6\} bannerEvery=\{18\}/, f);
  }
});

test('кожна стаття має evidence: ≥5 дослівних цитат із перелічених джерел', async () => {
  for (const p of BLOG_POSTS) {
    const urls = new Set(p.sources.map((s) => s.url));
    assert.ok(Array.isArray(p.evidence) && p.evidence.length >= 5, `${p.slug}: мало цитат`);
    for (const e of p.evidence) {
      assert.ok(e.claim && e.quote && e.quote.length >= 20, `${p.slug}: порожня цитата`);
      assert.ok(urls.has(e.url), `${p.slug}: цитата з адреси, якої немає в sources — ${e.url}`);
    }
  }
});

test('фото статей і путівників — лише з перевіреного списку', async () => {
  const { BLOG_HEROES } = await import('../lib/blog.js');
  for (const p of BLOG_POSTS) assert.ok(BLOG_HEROES.includes(p.hero.src), `${p.slug}: ${p.hero.src}`);
  for (const g of BLOG_GUIDES) assert.ok(BLOG_HEROES.includes(g.hero.src), `${g.href}: ${g.hero.src}`);
});

test('план блогу: валідний, підбірки існують, «done» = стаття є', () => {
  const plan = JSON.parse(read('content/blog-plan.json'));
  const ids = plan.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'id повторюються');
  for (const it of plan.items) {
    assert.ok(['todo', 'done', 'blocked'].includes(it.status), it.id);
    assert.ok(TOPICS[it.hub], `${it.id}: немає підбірки ${it.hub}`);
    assert.ok([1, 2, 3].includes(it.priority), it.id);
    assert.ok(Array.isArray(it.months) && it.months.every((m) => m >= 1 && m <= 12), it.id);
    if (it.status === 'done') assert.ok(BLOG_POSTS.some((p) => p.slug === it.post_slug), `${it.id}: статті ${it.post_slug} немає`);
    if (it.status === 'blocked') assert.ok(it.note, `${it.id}: blocked без причини`);
  }
});

test('робот публікації блогу: лише статті й план, тести через workflow_dispatch, автомердж', () => {
  const wf = read('.github/workflows/blog-publish.yml');
  assert.match(wf, /branches: \['blog\/\*\*', 'claude\/blog-\*\*'\]/);
  assert.match(wf, /grep -vE '\^\(lib\/blog\\\.js\|content\/blog-plan\\\.json\)\$'/);
  assert.match(wf, /gh workflow run tests\.yml --ref "\$BRANCH"/);
  assert.match(wf, /gh pr merge .* --squash --auto/);
  // tests.yml має приймати ручний запуск, інакше робот не запустить тести.
  assert.match(read('.github/workflows/tests.yml'), /workflow_dispatch:/);
});
