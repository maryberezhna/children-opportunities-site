import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlace, matchRange, filterPlaces, placeOption, PLACE_KINDS,
} from '../lib/place-search.js';

// Поле «Де» (Марія 27.09.2026): місто вписують, підказки звужуються.

const opts = [
  placeOption('abroad', '🌍 За кордоном', '🌍 Abroad'),
  placeOption('ukraine', '🇺🇦 Україна', '🇺🇦 Ukraine'),
  placeOption('online', '💻 Онлайн', '💻 Online'),
  placeOption('Київ', 'Київ', 'Kyiv'),
  placeOption('Львів', 'Львів', 'Lviv'),
  placeOption('Львівська область', 'Львівська область', 'Lviv region'),
  placeOption('Кам’янське', 'Кам’янське', 'Kamianske'),
  placeOption('Івано-Франківськ', 'Івано-Франківськ', 'Ivano-Frankivsk'),
  placeOption('Біла Церква', 'Біла Церква', 'Bila Tserkva'),
  placeOption('Жовква', 'Жовква', 'Zhovkva'),
];
const counts = {
  abroad: 50, ukraine: 900, online: 300, 'Київ': 120, 'Львів': 40,
  'Львівська область': 6, 'Кам’янське': 3, 'Івано-Франківськ': 12,
  'Біла Церква': 5, 'Жовква': 1,
};
const values = (list) => list.map((o) => o.value);

test('normalizePlace: регістр, апострофи, емодзі, пробіли й дефіси', () => {
  assert.equal(normalizePlace('  ЛЬВІВ  '), 'львів');
  assert.equal(normalizePlace('Камʼянське'), 'камянське');
  assert.equal(normalizePlace("Кам'янське"), 'камянське');
  assert.equal(normalizePlace('Кам’янське'), 'камянське');
  assert.equal(normalizePlace('🌍 За кордоном'), 'за кордоном');
  assert.equal(normalizePlace('🇺🇦 Україна'), 'україна');
  assert.equal(normalizePlace('Івано-Франківськ'), 'івано франківськ');
  assert.equal(normalizePlace('Біла   Церква'), 'біла церква');
  assert.equal(normalizePlace(''), '');
  assert.equal(normalizePlace(null), '');
});

test('«льв» — першим Львів; Жовква (льв лише всередині) не підходить', () => {
  const got = values(filterPlaces(opts, 'льв', { counts }));
  assert.deepEqual(got, ['Львів', 'Львівська область']);
});

test('назва, вписана повністю, випереджає довшу з тим самим початком', () => {
  // Людина вписала місто повністю — воно має стояти першим, навіть якщо в
  // області можливостей більше.
  const got = values(filterPlaces(opts, 'львів', { counts: { ...counts, 'Львівська область': 500 } }));
  assert.deepEqual(got, ['Львів', 'Львівська область']);
});

test('англійська назва: «kyiv» знаходить Київ, «lviv» — Львів', () => {
  assert.deepEqual(values(filterPlaces(opts, 'kyiv', { counts })), ['Київ']);
  assert.equal(values(filterPlaces(opts, 'LVIV', { counts }))[0], 'Львів');
});

test('види місця: «онл», «online», «кордон», «abroad», «україна», «ukraine»', () => {
  assert.deepEqual(values(filterPlaces(opts, 'онл', { counts })), ['online']);
  assert.deepEqual(values(filterPlaces(opts, 'online', { counts })), ['online']);
  assert.deepEqual(values(filterPlaces(opts, 'кордон', { counts })), ['abroad']);
  assert.deepEqual(values(filterPlaces(opts, 'закордон', { counts })), ['abroad']);
  assert.deepEqual(values(filterPlaces(opts, 'abroad', { counts })), ['abroad']);
  assert.deepEqual(values(filterPlaces(opts, 'україна', { counts })), ['ukraine']);
  assert.deepEqual(values(filterPlaces(opts, 'ukraine', { counts })), ['ukraine']);
});

test('апостроф у запиті й у назві — будь-який', () => {
  for (const q of ['камʼян', "кам'ян", 'кам’ян', 'камян']) {
    assert.deepEqual(values(filterPlaces(opts, q, { counts })), ['Кам’янське'], q);
  }
});

test('дефіс і пробіл рівноцінні, слово всередині назви теж знаходиться', () => {
  assert.deepEqual(values(filterPlaces(opts, 'івано франк', { counts })), ['Івано-Франківськ']);
  assert.deepEqual(values(filterPlaces(opts, 'франк', { counts })), ['Івано-Франківськ']);
  assert.deepEqual(values(filterPlaces(opts, 'церква', { counts })), ['Біла Церква']);
});

test('порядок: з початку назви → з початку слова → усередині', () => {
  const list = [
    placeOption('Ківерці', 'Ківерці', 'Kivertsi'),
    placeOption('Нова Ківа', 'Нова Ківа', 'Nova Kiva'),
    placeOption('Ликівка', 'Ликівка', 'Lykivka'),
  ];
  // Кількість навмисно обернена: ранг важливіший.
  const c = { 'Ківерці': 1, 'Нова Ківа': 10, 'Ликівка': 100 };
  assert.deepEqual(values(filterPlaces(list, 'ків', { counts: c })),
    ['Ківерці', 'Нова Ківа', 'Ликівка']);
});

test('рівний ранг: більше можливостей вище, далі за абеткою', () => {
  const list = [
    placeOption('Бар', 'Бар', 'Bar'),
    placeOption('Балта', 'Балта', 'Balta'),
    placeOption('Бахмут', 'Бахмут', 'Bakhmut'),
  ];
  assert.deepEqual(values(filterPlaces(list, 'ба', { counts: { 'Бахмут': 5 } })),
    ['Бахмут', 'Балта', 'Бар']);
});

test('порожнє поле: види місця першими, далі міста від найбільшої кількості', () => {
  const got = values(filterPlaces(opts, '   ', { counts }));
  assert.deepEqual(got.slice(0, 3), PLACE_KINDS);
  assert.deepEqual(got.slice(3, 6), ['Київ', 'Львів', 'Івано-Франківськ']);
  assert.equal(got.length, opts.length);
});

test('порожнє поле без видів місця — шторка, де вони вже чипами', () => {
  const got = values(filterPlaces(opts, '', { counts, kindsWhenEmpty: false }));
  assert.ok(PLACE_KINDS.every((k) => !got.includes(k)));
  assert.equal(got[0], 'Київ');
  // А з текстом — знаходяться: «онлайн» у полі «Де» не має казати «нічого».
  assert.deepEqual(values(filterPlaces(opts, 'онлайн', { counts, kindsWhenEmpty: false })), ['online']);
});

test('обране вже не пропонується', () => {
  const got = values(filterPlaces(opts, 'льв', { counts, exclude: ['Львів'] }));
  assert.deepEqual(got, ['Львівська область']);
  assert.ok(!values(filterPlaces(opts, '', { counts, exclude: ['online'] })).includes('online'));
});

test('нічого не підходить — порожньо', () => {
  assert.deepEqual(filterPlaces(opts, 'ґзщ', { counts }), []);
});

test('англійська сторінка: підпис англійський, шукається й українською', () => {
  const en = [placeOption('Київ', 'Київ', 'Kyiv', 'en'), placeOption('online', '💻 Онлайн', '💻 Online', 'en')];
  assert.equal(en[0].label, 'Kyiv');
  assert.deepEqual(values(filterPlaces(en, 'київ')), ['Київ']);
  assert.deepEqual(values(filterPlaces(en, 'онлайн')), ['online']);
});

test('matchRange підсвічує збіг у вихідному підписі', () => {
  assert.deepEqual(matchRange('Львів', 'льв'), [0, 3]);
  const kind = '🌍 За кордоном';
  const r = matchRange(kind, 'кордон');
  assert.equal(kind.slice(r[0], r[1]), 'кордон');
  const apos = 'Кам’янське';
  const a = matchRange(apos, 'камян');
  assert.equal(apos.slice(a[0], a[1]), 'Кам’ян');
  const dash = 'Івано-Франківськ';
  const d = matchRange(dash, 'івано франк');
  assert.equal(dash.slice(d[0], d[1]), 'Івано-Франк');
  // Збіг за англійською назвою — у підписі його немає, підсвітки нема.
  assert.equal(matchRange('Київ', 'kyiv'), null);
  assert.equal(matchRange('Київ', ''), null);
});

// Країна за кордоном (Марія 29.09.2026): вибір звужує закордон, а не додає до нього.
import { pickPlace, countryValue } from '../lib/place-search.js';

test('країна заміняє «За кордоном», «За кордоном» — країни', () => {
  const de = countryValue('de');
  assert.deepEqual(pickPlace(['abroad'], de), [de]);
  assert.deepEqual(pickPlace(['Київ', 'abroad'], de), ['Київ', de]);
  assert.deepEqual(pickPlace([de, countryValue('pl')], 'abroad'), ['abroad']);
  assert.deepEqual(pickPlace([de], countryValue('pl')), [de, countryValue('pl')]);
  assert.deepEqual(pickPlace([de], de), []);
  assert.deepEqual(pickPlace(['Київ'], 'Львів'), ['Київ', 'Львів']);
});

test('обрано закордон — на порожньому полі першими країни', () => {
  const list = [
    ...opts,
    placeOption(countryValue('de'), 'Німеччина', 'Germany'),
    placeOption(countryValue('pl'), 'Польща', 'Poland'),
  ];
  const counts = { Київ: 200, Львів: 90, [countryValue('de')]: 39, [countryValue('pl')]: 16 };
  const abroad = filterPlaces(list, '', { counts, exclude: ['abroad'], kindsWhenEmpty: false });
  assert.deepEqual(abroad.slice(0, 2).map((o) => o.label), ['Німеччина', 'Польща']);
  const plain = filterPlaces(list, '', { counts, kindsWhenEmpty: false });
  assert.equal(plain[0].label, 'Київ');
  assert.equal(filterPlaces(list, 'німеч', { counts })[0].label, 'Німеччина');
  assert.equal(filterPlaces(list, 'germ', { counts })[0].label, 'Німеччина');
});
