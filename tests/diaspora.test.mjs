// «Українським дітям за кордоном» (lib/diaspora.js): правило добору, поріг
// сторінок країн і групи хаба. Тексти прикладів — із живих записів бази на
// 28.09.2026 (скорочено); де запис вигаданий, це сказано поруч.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  diasporaReason, isDiaspora, liveCountryPages, hubGroups, countryName, inCountry, MIN_COUNTRY,
  SCHOOL_NOTES, schoolNotes,
} from '../lib/diaspora.js';

// «Школа в країні» (28.09.2026): права й процедури абзацом — кожен з
// офіційним джерелом, обома мовами; Італії немає.
test('абзаци «школа в країні»: обидві мови й офіційне джерело', () => {
  assert.deepEqual(Object.keys(SCHOOL_NOTES).sort(), ['cz', 'de', 'es', 'ie', 'nl', 'pl']);
  for (const [code, n] of Object.entries(SCHOOL_NOTES)) {
    assert.ok(n.uk && n.en, code);
    assert.match(n.source, /^https:\/\/\S+$/, code);
  }
  assert.equal(SCHOOL_NOTES.it, undefined);
  assert.equal(schoolNotes(['pl', 'it'], 'en')[0].country, 'Poland');
  assert.equal(schoolNotes(['pl', 'it']).length, 1);
});
import {
  TOPICS, TOPIC_LIST, DIASPORA_HUB, DIASPORA_COUNTRY_TOPICS, diasporaCountryBySlug,
  qualifyingCountryTopics,
} from '../lib/topics.js';

const rec = (opportunity_type, countries, title, summary = '') =>
  ({ opportunity_type, countries, title, summary, cities: [], is_international: true });

// ── Потрапляють: для тих, хто вже живе в країні ──

const INCLUDED = [
  ['strong', rec('camp', ['sk'], 'Християнський табір для українських дітей, які проживають у Словаччині (Літманова)',
    'Щорічний християнський табір для українських дітей, які проживають у Словаччині.')],
  ['strong', rec('camp', ['sk'], 'Денні мовні табори — словацька в ігровій формі для дітей іноземців',
    'Літні денні мовні табори у Братиславі для дітей з іншою рідною мовою (переважно з України).')],
  ['strong', rec('camp', ['nl'], 'Kindervakantieweken — літні табірні тижні для дітей біженців у Нідерландах',
    'Щорічні літні канікулярні тижні для дітей біженців (включно з українськими).')],
  ['strong', rec('club', ['ie'], 'Ridna Shkola (Рідна школа) — мережа українських суботніх шкіл',
    'Безкоштовна суботня українська школа для дітей (мова, історія, культура).')],
  ['strong', rec('club', ['cz'], 'Doučujte.cz — онлайн доучування та менторство для новоприбулих дітей з України')],
  ['strong', rec('club', ['ie'], 'Безкоштовні заняття з мистецтва та гончарства для українських родин — студія в Корку',
    'Постійні безкоштовні заняття для українських родин, які виїхали через війну.')],
  ['weak', rec('workshop', ['ie'], 'Художні заняття для українських дітей — музей мистецтв у Корку')],
  ['weak', rec('club', ['nl'], 'Connect Ukraine — платформа безкоштовних активностей та курсів',
    'Онлайн-платформа дозволяє українцям у Нідерландах (включно з дітьми) записуватися на безкоштовні активності.')],
  ['weak', rec('humanitarian', ['pl'], 'Kharpp — підтримка українських родин у Польщі')],
  ['weak', rec('workshop', ['ro'], 'UPLIFT Youth (освіта з підприємництва для українських та румунських учнів)')],
  ['weak', rec('workshop', ['it'], 'Empowering the Next Generation — майстерні й підтримка навчання для українських дітей в Італії')],
];

for (const [reason, o] of INCLUDED) {
  test(`діаспора, так (${reason}): ${o.title.slice(0, 60)}`, () => {
    assert.equal(diasporaReason(o), reason);
    assert.equal(TOPICS[DIASPORA_HUB].match(o), true);
  });
}

test('саміт для підлітків, «які тимчасово проживають у країнах ЄС», — так, щойно це є в summary', () => {
  // Той самий запис, що нижче не проходить: там умова лише в details.
  const o = rec('summer_school', ['ua', 'pl', 'hu', 'ro'], 'Саміт «Залізна Зміна» для українських підлітків',
    'Саміт для українських підлітків 14–16 років, які тимчасово проживають у країнах ЄС, США чи Канаді.');
  assert.equal(diasporaReason(o), 'strong');
});

// ── Не потрапляють: поїздки з України й чуже місцеве ──

const EXCLUDED = [
  ['поїздка: табір в Іспанії «для українських дітей»',
    rec('camp', ['es'], 'Фонд Марти Костюк організує безкоштовний тенісний табір в Іспанії для українських дітей',
      'Безкоштовний тренувально-освітній табір для 15 українських тенісистів віком від 10 до 14 років.')],
  ['поїздка: ретрит у Польщі з закордонним паспортом',
    rec('rehabilitation', ['pl'], 'Відновлювальний ретрит «Здоровʼя дітей України» в Польщі для дітей захисників',
      'Безкоштовний 18-денний ретрит. Потрібні закордонний паспорт дитини й документи.')],
  ['поїздка: табори в Німеччині для дітей із зон бойових дій',
    rec('camp', ['de'], 'Реабілітаційні табори фонду у Німеччині', 'Відновлювальні табори в Німеччині для дітей з зон бойових дій.')],
  ['обмін: «для українських і німецьких підлітків у Берліні»',
    rec('exchange', ['de'], 'InterExchange Academy 2026 для підлітків',
      'Міжнародна освітня програма для українських і німецьких підлітків у Берліні.')],
  ['обмін у Польщі для українських учасників',
    rec('exchange', ['pl'], 'Молодіжний обмін «All About Leadership 4»',
      'Міжнародний молодіжний обмін у Польщі для 5 українських учасників 14-17 років.')],
  ['стипендія на мовну школу для школярів з України',
    rec('scholarship', ['de'], 'Літні мовні школи у Німеччині',
      'Стипендії на літні мовні курси для старшокласників з України. Повне покриття.')],
  ['чуже місцеве «для всіх, включно з українськими»',
    rec('club', ['cz'], 'Program Pět P — менторська програма «дорослий друг» для дитини',
      'Програма відкрита для всіх дітей, включно з українськими, без вимоги громадянства.')],
  ['саміт, де умова «живуть за кордоном» лише в details',
    rec('summer_school', ['ua', 'pl', 'hu', 'ro'], 'Саміт «Залізна Зміна» для українських підлітків',
      'Участь безоплатна, витрати покриваються від моменту зустрічі в одному з хабів (Варшава, Будапешт).')],
  ['онлайн-школа без країни', rec('course', [], 'Українська онлайн-школа для дітей за кордоном',
    'Діти навчаються українською, можна долучитися з будь-якої країни.')],
  ['лише Україна', rec('humanitarian', ['ua'], 'Дитячі простори при вокзалах',
    'Безпечне місце для дітей-біженців та внутрішньо переміщених осіб.')],
  // Вигадані — межі правила:
  ['волонтерство з дітьми-біженцями — поїздка волонтера',
    rec('volunteer', ['pl'], 'Волонтерство в Польщі', 'Працюватимеш із дітьми-біженцями в денному центрі.')],
  ['«які проживають у Львівській області» — не за кордоном',
    rec('camp', ['pl'], 'Табір у Польщі', 'Для дітей, які проживають у Львівській області.')],
  ['курс мови в Німеччині з перельотом',
    rec('course', ['de'], 'Мовний курс для українських школярів у Німеччині', 'Переліт і проживання оплачує організатор.')],
];

for (const [why, o] of EXCLUDED) {
  test(`діаспора, ні: ${why}`, () => {
    assert.equal(diasporaReason(o), null);
    assert.equal(isDiaspora(o), false);
  });
}

test('«За кордон» більше не бере табір для дітей біженців у Нідерландах', () => {
  const o = { ...INCLUDED[2][1], format: 'Офлайн' };
  assert.equal(TOPICS['za-kordon'].match(o), false);
  assert.equal(TOPICS[DIASPORA_HUB].match(o), true);
});

// ── Сторінки країн: поріг і групи хаба ──

const pl = (n) => Array.from({ length: n }, (_, i) =>
  rec('club', ['pl'], `Українська суботня школа №${i + 1}`));

test(`сторінка країни — від ${MIN_COUNTRY} записів, нижче її немає`, () => {
  assert.equal(MIN_COUNTRY, 3);
  assert.deepEqual(liveCountryPages(pl(2)), []);
  const pages = liveCountryPages(pl(3));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].code, 'pl');
  assert.equal(pages[0].count, 3);
  assert.equal(qualifyingCountryTopics(pl(2)).length, 0);
  assert.deepEqual(qualifyingCountryTopics(pl(3)).map((t) => t.slug), ['ukrainskym-ditiam-za-kordonom/polshcha']);
});

test('власні сторінки — лише Польща й Німеччина: Ірландія з трьома лишається групою в хабі', () => {
  const ie = [0, 1, 2].map((i) => rec('club', ['ie'], `Українська суботня школа в Ірландії ${i}`));
  assert.deepEqual(liveCountryPages(ie), []);
  const { links, groups } = TOPICS[DIASPORA_HUB].groups(ie);
  assert.deepEqual(links, []);
  assert.deepEqual(groups.map((g) => [g.id, g.title, g.items.length]), [['country-ie', 'Ірландія', 3]]);
});

test('хаб: країна зі сторінкою — посиланням, решта — групами, більші вище', () => {
  const items = [
    ...pl(3),
    rec('club', ['sk'], 'Табір для дітей, які проживають у Словаччині'),
    rec('club', ['ie'], 'Українська суботня школа в Дубліні'),
    rec('club', ['ie'], 'Недільна школа в Корку'),
  ];
  const { links, groups } = TOPICS[DIASPORA_HUB].groups(items);
  assert.deepEqual(links, [{ href: '/ukrainskym-ditiam-za-kordonom/polshcha', label: 'Польща', count: 3 }]);
  assert.deepEqual(groups.map((g) => [g.title, g.items.length]), [['Ірландія', 2], ['Словаччина', 1]]);
  const en = TOPICS[DIASPORA_HUB].groups(items, 'en');
  assert.equal(en.links[0].href, '/en/ukrainian-children-abroad/poland');
  assert.deepEqual(en.groups.map((g) => g.title), ['Ireland', 'Slovakia']);
});

test('запис кількох країн — у першій без власної сторінки', () => {
  const o = rec('club', ['pl', 'cz'], 'Суботня українська школа');
  assert.deepEqual(hubGroups([o], ['pl']).map((g) => g.code), ['cz']);
  assert.deepEqual(hubGroups([o], ['pl', 'cz']), []);
});

test('назви країн', () => {
  assert.equal(countryName('nl'), 'Нідерланди');
  assert.equal(countryName('nl', 'en'), 'Netherlands');
  assert.equal(inCountry('de'), 'у Німеччині');
  assert.equal(inCountry('nl', 'en'), 'in the Netherlands');
  assert.ok(countryName('jp').length > 0);
});

// ── Сторінки: меню, адреси, SEO ──

test('хаб — звичайна підбірка, сторінки країн у меню не потрапляють', () => {
  assert.ok(TOPIC_LIST.some((t) => t.slug === DIASPORA_HUB));
  for (const t of DIASPORA_COUNTRY_TOPICS) {
    assert.ok(!TOPIC_LIST.includes(t));
    assert.equal(t.parent, DIASPORA_HUB);
    assert.equal(t.minItems, MIN_COUNTRY);
    assert.equal(t.noCityPages, true);
  }
  assert.equal(TOPICS[DIASPORA_HUB].noCityPages, true);
  assert.equal(diasporaCountryBySlug('polshcha').code, 'pl');
  assert.equal(diasporaCountryBySlug('germany', 'en').code, 'de');
  assert.equal(diasporaCountryBySlug('irlandiia'), undefined);
});

test('title до 60, description до 160, обидві мови; без «каталогу» й обіцянок', () => {
  for (const t of [TOPICS[DIASPORA_HUB], ...DIASPORA_COUNTRY_TOPICS]) {
    for (const c of [t, t.en]) {
      assert.ok(c.title.length <= 60, `${c.title} — ${c.title.length}`);
      assert.ok(c.description.length <= 160, `${c.description} — ${c.description.length}`);
      const copy = [c.title, c.description, c.intro, c.note, ...c.faq.flatMap((f) => [f.q, f.a])].join(' ');
      assert.doesNotMatch(copy, /каталог|catalogue|скоро|додамо|зберемо|\bsoon\b/i);
      assert.doesNotMatch(copy, /Dityam(?!\.com\.ua)/);
    }
  }
});

test('хаб і «За кордон» посилаються одне на одного', () => {
  assert.equal(TOPICS[DIASPORA_HUB].guide.href, '/za-kordon');
  assert.equal(TOPICS[DIASPORA_HUB].en.guide.href, '/en/abroad');
  assert.equal(TOPICS['za-kordon'].guide.href, '/ukrainskym-ditiam-za-kordonom');
  assert.equal(TOPICS['za-kordon'].en.guide.href, '/en/ukrainian-children-abroad');
});

test('сторінка країни нижче порогу — 404, у sitemap і llms.txt лише ті, що пройшли', () => {
  const root = new URL('..', import.meta.url).pathname;
  const read = (f) => readFileSync(join(root, f), 'utf8');
  assert.match(read('app/TopicPage.js'), /topic\.minItems && matched\.length < topic\.minItems\) notFound\(\)/);
  assert.match(read('app/sitemap.js'), /qualifyingCountryTopics\(liveCards\)/);
  assert.match(read('app/llms.txt/route.js'), /qualifyingCountryTopics\(liveRows\)/);
});
