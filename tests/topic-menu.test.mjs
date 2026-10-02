import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPICS, TOPIC_LIST, TOPIC_GROUPS, groupItemSlug, topicMenu } from '../lib/topics.js';
import { ERASMUS_PATH } from '../lib/erasmus.js';
import { topicCityLinks, MIN_LOCAL, CITY_TOPIC_TEXTS } from '../lib/city-topics.js';

// Меню у два рівні, 02.10.2026. Підбірок стало чотирнадцять, і вони стояли
// одним стовпцем: «довге і не читабельне». За планом щотижня додається ще
// одна, тож правило мусить стерегти тест, а не памʼять.

// Підбірка поза розділом у меню не потрапила б узагалі — і ніхто б не помітив.
test('кожна підбірка стоїть рівно в одному розділі меню', () => {
  const placed = TOPIC_GROUPS.flatMap((g) => g.items.map(groupItemSlug)).filter(Boolean);
  for (const t of TOPIC_LIST) {
    assert.equal(placed.filter((s) => s === t.slug).length, 1, `${t.slug}: має бути в одному розділі`);
  }
  for (const slug of placed) assert.ok(TOPICS[slug], `розділ посилається на неіснуючу підбірку ${slug}`);
});

// Розділ на вісім пунктів — це той самий довгий список, лише з заголовком.
test('розділів небагато, і жоден не роздутий', () => {
  assert.ok(TOPIC_GROUPS.length <= 6, 'розділів більше шести — меню знову нечитабельне');
  for (const g of TOPIC_GROUPS) {
    assert.ok(g.items.length >= 1 && g.items.length <= 8, `${g.key}: ${g.items.length} пунктів`);
    assert.ok(g.label && g.labelEn && g.label !== g.labelEn, `${g.key}: підпис обома мовами`);
  }
});

test('українське меню має всі підбірки й путівники', () => {
  const menu = topicMenu('uk');
  const hrefs = menu.flatMap((g) => g.links.map((l) => l.href));
  assert.equal(new Set(hrefs).size, hrefs.length, 'посилання в меню повторюються');
  for (const t of TOPIC_LIST) assert.ok(hrefs.includes(`/${t.slug}`), t.slug);
  assert.ok(hrefs.includes('/olimpiady'), 'путівник по олімпіадах');
  assert.ok(hrefs.includes(ERASMUS_PATH), 'путівник Erasmus+');
});

// Путівники мають лише українську версію: в англійському меню їх бути не може,
// інакше посилання вело б на сторінку іншою мовою.
test('англійське меню веде лише на англійські сторінки', () => {
  for (const g of topicMenu('en')) {
    assert.ok(g.links.length > 0, `${g.key}: порожній розділ`);
    for (const l of g.links) {
      assert.ok(l.href.startsWith('/en/'), l.href);
      assert.doesNotMatch(l.label, /[а-яіїєґ]/i, `${l.href}: підпис не перекладено`);
    }
  }
});

// Дві олімпіадні сторінки поруч мусять називатись по-різному, а пункт у
// розділі «За кордон» не може дублювати назву розділу.
test('підписи в одному розділі не збігаються між собою й з назвою розділу', () => {
  for (const g of topicMenu('uk')) {
    const labels = g.links.map((l) => l.label);
    assert.equal(new Set(labels).size, labels.length, `${g.key}: однакові підписи`);
    assert.ok(!labels.includes(g.label), `${g.key}: пункт називається як розділ`);
  }
});

// Шапка бере меню з одного місця й лишає посилання в HTML при закритій панелі.
test('шапка малює розділи з topicMenu', () => {
  const src = readFileSync(new URL('../app/Header.js', import.meta.url), 'utf8');
  assert.match(src, /topicMenu\(isEnglish \? 'en' : 'uk'\)/);
  assert.match(src, /hidden=\{!topicsOpen\}/);
  assert.doesNotMatch(src, /TOPIC_NAV/);
});

// --- «Ця підбірка у вашому місті» ---
const hurtok = (city) => ({ cost_type: 'free', aid_type: null, opportunity_type: 'club', cities: [city], title: 'Гурток кераміки', format: 'offline' });

test('підбірка веде на місто лише від порогу сторінки міста', () => {
  const topic = TOPICS['bezkoshtovni-hurtky'];
  const rows = [
    ...Array.from({ length: MIN_LOCAL }, () => hurtok('Київ')),
    ...Array.from({ length: MIN_LOCAL - 1 }, () => hurtok('Львів')),
  ];
  const links = topicCityLinks(rows, topic);
  assert.deepEqual(links.map((l) => l.href), ['/kyiv/bezkoshtovni-hurtky']);
  assert.equal(links[0].count, MIN_LOCAL);
});

// Посилання на сторінку, якої немає, — це 404 з кожної підбірки.
test('підбірка без міських сторінок не веде нікуди', () => {
  const online = TOPICS['bezkoshtovni-onlain-kursy'];
  assert.equal(online.noCityPages, true);
  assert.deepEqual(topicCityLinks(Array.from({ length: 20 }, () => hurtok('Київ')), online), []);
  const noTexts = TOPIC_LIST.find((t) => !t.noCityPages && !CITY_TOPIC_TEXTS[t.slug]);
  if (noTexts) assert.deepEqual(topicCityLinks([], noTexts), []);
});
