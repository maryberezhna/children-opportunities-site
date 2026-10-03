// Підказки під полем пошуку (lib/search-suggest.js, 03.10.2026). Головне:
// підказка ніколи не веде в порожнечу і показує людську форму слова.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHaystack } from '../lib/search.js';
import { buildVocabulary, suggest, titleHaystack } from '../lib/search-suggest.js';

const items = [
  { id: 1, title: 'Курси англійської мови для дітей', summary: 'Англійська мова онлайн, групи 6–12 років.' },
  { id: 2, title: 'English Club — англійська для підлітків', summary: 'Розмовна англійська мова.' },
  { id: 3, title: 'Німецька мова для школярів', summary: 'Курс німецької мови онлайн.' },
  { id: 4, title: 'Олімпіада МОН з математики', summary: 'Всеукраїнська олімпіада МОН.' },
  { id: 5, title: 'Олімпіада МОН з фізики', summary: 'Етапи олімпіади МОН.' },
];
const source = {
  items,
  vocab: buildVocabulary(items),
  index: new Map(items.map((i) => [i.id, buildHaystack([i.title, i.summary])])),
  titles: new Map(items.map((i) => [i.id, titleHaystack(i)])),
};

test('«англ» дописується в називну форму «англійська», а не «англійської»', () => {
  const r = suggest('англ', source);
  assert.equal(r.words[0].text, 'англійська');
  assert.equal(r.words[0].n, 2);
});

test('друге слово дописується з однієї літери: «англійська м» → «англійська мова»', () => {
  const r = suggest('англійська м', source);
  assert.ok(r.words.some((w) => w.text === 'англійська мова'));
});

test('підказка, яка нічого не знайде, не показується', () => {
  const r = suggest('німецька англ', source);
  assert.equal(r.words.length, 0);
});

test('абревіатури лишаються великими: «мо» → «МОН»', () => {
  const r = suggest('мо', source);
  assert.ok(r.words.some((w) => w.word === 'МОН'));
});

test('записи-підказки — лише ті, у назві яких є всі слова запиту', () => {
  const r = suggest('німецька', source);
  assert.deepEqual(r.records.map((x) => x.id), [3]);
});

test('порожній запит — без підказок', () => {
  assert.deepEqual(suggest('  ', source), { words: [], records: [] });
});
