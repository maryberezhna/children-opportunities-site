import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl } from '../scrapers/lib/canonical.mjs';

// Спільна таблиця для обох дзеркал. Той самий список лежить у
// scraper/tests/test_canonical.py — якщо правити, правити обидва файли.
// Формула ідентичності мусить давати однаковий рядок у Node і Python,
// інакше два пайплайни бачать один запис як два.
export const CASES = [
  // мовний префікс шляху не є частиною ідентичності
  ['https://americancouncils.org.ua/en/programs/future-leaders-exchange-program',
   'https://americancouncils.org.ua/programs/future-leaders-exchange-program'],
  ['https://americancouncils.org.ua/programs/future-leaders-exchange-program',
   'https://americancouncils.org.ua/programs/future-leaders-exchange-program'],
  ['https://uboost.study/ua/career', 'https://uboost.study/career'],
  ['https://100millionlearners.org/uk/register-info?partner=USF',
   'https://100millionlearners.org/register-info?partner=USF'],
  ['https://refugeehelp.nl/nl/ukrainian-refugee/article/100107-x',
   'https://refugeehelp.nl/ukrainian-refugee/article/100107-x'],
  ['https://example.com/EN-US/page', 'https://example.com/page'],

  // а ось це НЕ мова, і зрізати не можна
  ['https://mitocw.zendesk.com/hc/en-us/articles/533286-x',
   'https://mitocw.zendesk.com/hc/en-us/articles/533286-x'],   // hc = help center
  ['https://example.com/it/courses', 'https://example.com/it/courses'], // IT, не італійська
  ['https://example.com/id/12', 'https://example.com/id/12'],
  ['https://britishschool.ua/uk', 'https://britishschool.ua/uk'],       // головна, не сторінка

  // решта правил канонізації
  ['https://ukraine.uwc.org/apply/', 'https://ukraine.uwc.org/apply'],
  ['http://WWW.Example.COM/a/?utm_source=x&b=2&a=1#frag', 'https://example.com/a?a=1&b=2'],
  ['example.com/a', 'https://example.com/a'],
  ['ftp://example.com/a', null],
];

test('canonicalUrl: мовний префікс, трекінг, хвостовий слеш', () => {
  for (const [input, want] of CASES) {
    assert.equal(canonicalUrl(input), want, `для ${input}`);
  }
});

test('canonicalUrl не падає на смітті', () => {
  for (const junk of [null, undefined, '', '   ', 'не url', 42, {}]) {
    assert.doesNotThrow(() => canonicalUrl(junk));
  }
});
