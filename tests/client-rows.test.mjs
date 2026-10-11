// Записи каталогу без порожніх полів (07.10.2026, «чи не перевантажені
// сторінки»): у HTML головної порожнеча була кожним п'ятим байтом даних списку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clientRows } from '../lib/client-rows.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('порожні поля не їдуть, значення лишаються', () => {
  const [row] = clientRows([{
    id: 'a', slug: 's', deadline: null, featured_week: null, cities: [], child_needs: ['low_income'],
    is_international: false, age_from: 0, summary: '', countries: ['ua'],
  }]);
  assert.deepEqual(row, {
    id: 'a', slug: 's', child_needs: ['low_income'], age_from: 0, summary: '', countries: ['ua'],
  });
});

// Прибране поле читається як undefined, а не null. Для `o.x || …` це те саме,
// а от `o.x === null` тихо зламався б — тож таких порівнянь у публічному коді
// бути не має.
test('публічний код не порівнює поля записів із null чи false', () => {
  const fields = 'featured_week|results_date|aid_type|event_start_date|deadline|event_end_date|child_needs|'
    + 'is_international|teen_tags|teen_benefit|teen_requirement|countries|timing_kind|format|cities|cost_type|source';
  const strict = new RegExp(`\\.(${fields})\\s*(===|!==)\\s*(null|false)\\b`);
  const bare = new RegExp(`\\.(child_needs|cities|countries|teen_tags)\\.(length|includes|map|some|filter|forEach|join|every)\\b`);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(new URL(`../${dir}`, import.meta.url))) {
      const rel = join(dir, name);
      if (rel.startsWith('app/admin') || rel.startsWith('app/api')) continue;
      if (statSync(new URL(`../${rel}`, import.meta.url)).isDirectory()) walk(rel);
      else if (rel.endsWith('.js')) files.push(rel);
    }
  };
  walk('app'); walk('lib');
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, strict, `${f}: суворе порівняння поля з null/false — clientRows його зламає`);
    assert.doesNotMatch(src, bare, `${f}: список без «|| []» — clientRows прибирає порожні списки`);
  }
});

test('усі сторінки з повним каталогом віддають у браузер clientRows', () => {
  for (const f of ['app/page.js', 'app/en/page.js', 'app/[city]/page.js', 'app/en/[city]/page.js', 'app/[city]/[topic]/page.js']) {
    assert.match(read(f), /opportunities=\{(lightCatalog\()?clientRows\(opportunities\)/, f);
  }
});

// Пошукові індекси — лише коли людина взялась шукати (lib/search-suggest.js).
test('індекси пошуку рахуються не на кожному відкритті сторінки', () => {
  const list = read('app/OpportunitiesList.js');
  assert.match(list, /const wantSearch = searchWanted \|\| Boolean\(query\.trim\(\)\);/);
  assert.match(list, /if \(!wantSearch \|\| !searchRows\) return null;/);
  assert.match(list, /searchLive \? buildVocabulary\(searchLive\) : null/);
  assert.match(read('app/useSearchSuggest.js'), /onFocus: \(\) => \{ focused\.current = true; wantSuggestSource\(\);/,
    'поле пошуку має будити індекси на першому фокусі');
});

// Захист від копіювання (11.10.2026): /api/catalog віддавав одним запитом
// усі описи разом з адресами першоджерел. Картці адреса не потрібна.
test('адреси джерела й подачі не їдуть у браузер, назва організатора лишається', () => {
  const [row] = clientRows([{
    id: 'a', slug: 's', source: 'Мала академія наук', source_url: 'https://man.gov.ua/x',
    apply_url: 'https://forms.gle/x',
  }]);
  assert.deepEqual(row, { id: 'a', slug: 's', source: 'Мала академія наук' });
});

test('назву чужого Telegram-каналу картка не отримує', () => {
  const [row] = clientRows([{ id: 'a', source: 'Можливості', source_url: 'https://t.me/Mozhlyvosti/1' }]);
  assert.equal(row.source, undefined);
  assert.equal(row.source_url, undefined);
});

test('картки підбірок не везуть адресу джерела', () => {
  assert.doesNotMatch(read('app/TopicPage.js'), /source_url:\s*o\.source_url/);
});
