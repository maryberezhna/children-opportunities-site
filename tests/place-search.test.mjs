import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlace, matchRange, filterPlaces, placeOption, PLACE_KINDS, placeFieldMode,
} from '../lib/place-search.js';

// Поле «Де» (Марія 27.09.2026): місто вписують, підказки звужуються.

const opts = [
  placeOption('ukraine', '🇺🇦 В Україні', '🇺🇦 In Ukraine'),
  placeOption('online', '💻 Онлайн для всіх', '💻 Online for all'),
  placeOption('diaspora', '🌍 Живемо за кордоном', '🌍 Living abroad'),
  placeOption('travel', '✈️ Поїхати за кордон', '✈️ Going abroad'),
  placeOption('Київ', 'Київ', 'Kyiv'),
  placeOption('Львів', 'Львів', 'Lviv'),
  placeOption('Львівська область', 'Львівська область', 'Lviv region'),
  placeOption('Кам’янське', 'Кам’янське', 'Kamianske'),
  placeOption('Івано-Франківськ', 'Івано-Франківськ', 'Ivano-Frankivsk'),
  placeOption('Біла Церква', 'Біла Церква', 'Bila Tserkva'),
  placeOption('Жовква', 'Жовква', 'Zhovkva'),
];
const counts = {
  diaspora: 80, travel: 40, ukraine: 900, online: 300, 'Київ': 120, 'Львів': 40,
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
  // «кордон» — обидві закордонні групи, більша першою.
  assert.deepEqual(values(filterPlaces(opts, 'кордон', { counts })), ['diaspora', 'travel']);
  assert.deepEqual(values(filterPlaces(opts, 'закордон', { counts })), ['travel']);
  assert.deepEqual(values(filterPlaces(opts, 'abroad', { counts })), ['diaspora', 'travel']);
  assert.deepEqual(values(filterPlaces(opts, 'діаспора', { counts })), ['diaspora']);
  assert.deepEqual(values(filterPlaces(opts, 'поїхати', { counts })), ['travel']);
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
  assert.deepEqual(got.slice(0, 4), PLACE_KINDS);
  assert.deepEqual(got.slice(4, 7), ['Київ', 'Львів', 'Івано-Франківськ']);
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
  const kind = '🌍 Живемо за кордоном';
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

// Країна за кордоном (Марія 29.09.2026).
import { pickPlace, countryValue, placeMatches, expandLegacyPlace } from '../lib/place-search.js';

test('pickPlace: повторний вибір знімає, решта додається', () => {
  const de = countryValue('de');
  assert.deepEqual(pickPlace(['diaspora'], de), ['diaspora', de]);
  assert.deepEqual(pickPlace([de], countryValue('pl')), [de, countryValue('pl')]);
  assert.deepEqual(pickPlace([de], de), []);
  assert.deepEqual(pickPlace(['Київ'], 'Львів'), ['Київ', 'Львів']);
  assert.deepEqual(pickPlace(['ukraine'], 'travel'), ['ukraine', 'travel']);
  assert.deepEqual(pickPlace(['ukraine', 'travel', 'online'], 'online'), ['ukraine', 'travel']);
});

test('обрано закордонну групу — на порожньому полі першими країни', () => {
  const list = [
    ...opts,
    placeOption(countryValue('de'), 'Німеччина', 'Germany'),
    placeOption(countryValue('pl'), 'Польща', 'Poland'),
  ];
  const counts = { Київ: 200, Львів: 90, [countryValue('de')]: 39, [countryValue('pl')]: 16 };
  const abroad = filterPlaces(list, '', { counts, exclude: ['diaspora'], kindsWhenEmpty: false });
  assert.deepEqual(abroad.slice(0, 2).map((o) => o.label), ['Німеччина', 'Польща']);
  const plain = filterPlaces(list, '', { counts, kindsWhenEmpty: false });
  assert.equal(plain[0].label, 'Київ');
  assert.equal(filterPlaces(list, 'німеч', { counts })[0].label, 'Німеччина');
  assert.equal(filterPlaces(list, 'germ', { counts })[0].label, 'Німеччина');
});

// --- поле під видами місця, 30.09.2026 ---
test('без вибору поля місця немає', () => {
  assert.equal(placeFieldMode([]), null);
  assert.equal(placeFieldMode(['online']), null);
});

test('«В Україні» → міста, закордонна група → країни', () => {
  assert.equal(placeFieldMode(['ukraine']), 'city');
  assert.equal(placeFieldMode(['diaspora']), 'country');
  assert.equal(placeFieldMode(['travel']), 'country');
  assert.equal(placeFieldMode(['online', 'diaspora']), 'country');
  // Країну вже обрано — поле лишається полем країн.
  assert.equal(placeFieldMode(['diaspora', 'country:de']), 'country');
});

test('Україна й закордон разом — показуємо все', () => {
  assert.equal(placeFieldMode(['travel', 'ukraine']), 'both');
});

test('уже обране місто тримає поле відкритим', () => {
  assert.equal(placeFieldMode(['Київ']), 'both');
  assert.equal(placeFieldMode(['online', 'Львів']), 'both');
  assert.equal(placeFieldMode(['country:de']), 'both');
});

// --- чотири групи, 27.10.2026 ---
test('старі адреси ?city=abroad і Міжнародні — обидві закордонні групи', () => {
  assert.deepEqual(expandLegacyPlace(['abroad']), ['diaspora', 'travel']);
  assert.deepEqual(expandLegacyPlace(['Міжнародні', 'Київ']), ['diaspora', 'travel', 'Київ']);
  assert.deepEqual(expandLegacyPlace(['diaspora', 'abroad']), ['diaspora', 'travel']);
});

test('placeMatches: групи й міста — «або»', () => {
  const kyiv = { reach: 'ukraine', cityMatch: (v) => v === 'Київ' };
  assert.equal(placeMatches([], kyiv), true);
  assert.equal(placeMatches(['ukraine'], kyiv), true);
  assert.equal(placeMatches(['online'], kyiv), false);
  assert.equal(placeMatches(['online', 'Київ'], kyiv), true);
  assert.equal(placeMatches(['abroad'], { reach: 'travel' }), true);
  assert.equal(placeMatches(['abroad'], { reach: 'diaspora' }), true);
  assert.equal(placeMatches(['abroad'], { reach: 'online' }), false);
});

test('країна звужує закордонну групу, а не додається до неї', () => {
  const schoolPl = { reach: 'diaspora', codes: ['pl'] };
  const campPl = { reach: 'travel', codes: ['pl'] };
  const schoolDe = { reach: 'diaspora', codes: ['de'] };
  const pl = countryValue('pl');
  assert.equal(placeMatches(['diaspora', pl], schoolPl), true);
  assert.equal(placeMatches(['diaspora', pl], campPl), false);
  assert.equal(placeMatches(['diaspora', pl], schoolDe), false);
  // Країна без групи — усе, що в цій країні.
  assert.equal(placeMatches([pl], campPl), true);
  assert.equal(placeMatches([pl], schoolDe), false);
  // Онлайн поруч із країною лишається «або».
  assert.equal(placeMatches(['online', 'diaspora', pl], { reach: 'online' }), true);
});
