import test from 'node:test';
import assert from 'node:assert/strict';
import { langSuggestion, isEnglishPath, readsUkrainian } from '../lib/lang.js';

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
