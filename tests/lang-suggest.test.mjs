import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import {
  langSuggestion, isEnglishPath, readsUkrainian, LANG_SUGGEST_BOOT_SCRIPT, LANG_SUGGEST_KEY,
} from '../lib/lang.js';

// Головне, чого не було до 30.09.2026. За 28 днів на англійські сторінки
// зайшли 326 разів, із них 103 з ChatGPT, а 81% трафіку з ChatGPT — з
// України. Україномовна людина потрапляла на англійську сторінку й не бачила
// жодної підказки, що та сама сторінка є українською.
test('україномовному на англійській сторінці пропонуємо українську', () => {
  for (const p of ['/en', '/en/contests', '/en/free-online-courses', '/en/language-courses', '/en/o/abc']) {
    assert.equal(langSuggestion({ pathname: p, uaReader: true }), 'to_uk', p);
  }
});

test('неукраїномовному на українській сторінці пропонуємо англійську', () => {
  for (const p of ['/', '/konkursy', '/o/abc']) {
    assert.equal(langSuggestion({ pathname: p, uaReader: false }), 'to_en', p);
  }
});

// Двічі одне й те саме не пропонуємо: людина вже там, де їй зрозуміло.
test('нічого не пропонуємо, коли мова сторінки й так підходить', () => {
  assert.equal(langSuggestion({ pathname: '/konkursy', uaReader: true }), null);
  assert.equal(langSuggestion({ pathname: '/en/contests', uaReader: false }), null);
});

// Доки браузер не перевірено, банер не має блимати не тією мовою.
test('до перевірки браузера не пропонуємо нічого', () => {
  assert.equal(langSuggestion({ pathname: '/en', uaReader: null }), null);
  assert.equal(langSuggestion({ pathname: '/en', uaReader: undefined }), null);
  assert.equal(langSuggestion({ pathname: '/' }), null);
});

test('в адмінці банера немає ніколи', () => {
  assert.equal(langSuggestion({ pathname: '/admin', uaReader: false }), null);
  assert.equal(langSuggestion({ pathname: '/admin/metrics', uaReader: true }), null);
});

test('/en розпізнається точно, а схожі адреси — ні', () => {
  assert.equal(isEnglishPath('/en'), true);
  assert.equal(isEnglishPath('/en/plus'), true);
  assert.equal(isEnglishPath('/energy'), false);
  assert.equal(isEnglishPath('/'), false);
});

// Діаспора: браузер польський, українська третя — це україномовна людина.
test('українська в кінці списку мов усе одно рахується', () => {
  assert.equal(readsUkrainian(['pl-PL', 'pl', 'uk']), true);
  assert.equal(langSuggestion({ pathname: '/en', uaReader: readsUkrainian(['pl-PL', 'pl', 'uk']) }), 'to_uk');
});

// 07.10.2026: банер вирішується до першої промальовки inline-скриптом, а не
// після гідратації (інакше він зсував сторінку на 70px). Скрипт — окрема копія
// правил, тож звіряємо його з langSuggestion на тих самих випадках.

const runBoot = ({ path, languages, dismissed = false }) => {
  const attrs = {};
  const ctx = {
    location: { pathname: path },
    navigator: { languages, language: languages[0] },
    localStorage: { getItem: (k) => (dismissed && k === LANG_SUGGEST_KEY ? '1' : null) },
    document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } },
    String,
  };
  vm.runInNewContext(LANG_SUGGEST_BOOT_SCRIPT, ctx);
  return attrs['data-lang-suggest'] || null;
};

test('скрипт до промальовки вирішує так само, як langSuggestion', () => {
  const paths = ['/', '/konkursy', '/o/abc', '/en', '/en/contests', '/admin', '/admin/metrics'];
  const langs = [['uk-UA', 'uk'], ['ru'], ['en-US', 'en'], ['pl-PL', 'pl', 'uk'], ['pl-PL'], ['de']];
  for (const path of paths) {
    for (const languages of langs) {
      const expected = langSuggestion({ pathname: path, uaReader: readsUkrainian(languages) });
      assert.equal(runBoot({ path, languages }), expected, `${path} ${languages}`);
    }
  }
});

test('закритий банер скрипт не повертає', () => {
  assert.equal(runBoot({ path: '/', languages: ['en-US'], dismissed: true }), null);
});

test('банер схований CSS-ом, доки скрипт не поставив атрибут', () => {
  const css = readFileSync(new URL('../app/styles/site-header.css', import.meta.url), 'utf8');
  assert.match(css, /\.lang-suggest \{\s*display: none;/);
  assert.match(css, /html\[data-lang-suggest="to_en"\] \.lang-suggest\[data-variant="to_en"\]/);
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.indexOf('LANG_SUGGEST_BOOT_SCRIPT }}') < layout.indexOf('<LangSuggest />'),
    'скрипт має стояти до банера, інакше банер зʼявиться після показу сторінки');
});

// 12.10.2026: на /en ведемо лише тих, хто читає англійською.
test('readsEnglish: англійська будь-де в списку — так; лише польська чи німецька — ні', async () => {
  const { readsEnglish, acceptLanguageTags } = await import('../lib/lang.js');
  assert.equal(readsEnglish(acceptLanguageTags('en-US,en;q=0.9')), true);
  assert.equal(readsEnglish(acceptLanguageTags('pl-PL,pl;q=0.9,en;q=0.5')), true);
  assert.equal(readsEnglish(acceptLanguageTags('pl-PL,pl;q=0.9')), false);
  assert.equal(readsEnglish(acceptLanguageTags('de-DE,de;q=0.9,en;q=0')), false);
});

test('головна з-за кордону: браузер без української й російської веде на /en навіть без англійської (27.10.2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('middleware.js', 'utf8');
  assert.ok(!/readsEnglish\(/.test(src), 'middleware більше не вимагає англійської в браузері');
  assert.match(src, /readsUkrainian\(tags\)/);
});

test('англійська головна — того самого вигляду, що українська', async () => {
  const { readFileSync } = await import('node:fs');
  const en = readFileSync('app/en/page.js', 'utf8');
  for (const prop of ['mobileLayout', 'sidebarLayout', 'soon={soon}', 'teenSoon={teenSoon}', 'v2-home']) {
    assert.ok(en.includes(prop), `app/en/page.js: ${prop}`);
  }
});
