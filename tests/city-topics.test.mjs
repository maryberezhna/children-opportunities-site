import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LOCAL, isLocal, inCityOrNationwide, localTopicCount, qualifyingCombos, CITY_TOPIC_TEXTS } from '../lib/city-topics.js';
import { TOPICS } from '../lib/topics.js';

const hurtok = (cities) => ({
  cost_type: 'free', aid_type: null, opportunity_type: 'club',
  cities, title: 'Гурток кераміки',
});

test('поріг: сторінка міста існує лише від MIN_LOCAL локальних записів', () => {
  const topic = TOPICS['bezkoshtovni-hurtky'];
  const local = Array.from({ length: MIN_LOCAL }, () => hurtok(['Житомир']));
  assert.equal(localTopicCount(local, topic, 'Житомир'), MIN_LOCAL);
  const combos = qualifyingCombos(local).map((c) => `${c.citySlug}/${c.topicSlug}`);
  assert.ok(combos.includes('zhytomyr/bezkoshtovni-hurtky'));
  // На один менше — сторінки немає: тонкий контент не генеруємо.
  assert.equal(qualifyingCombos(local.slice(1)).length, 0);
});

test('«Вся Україна» не рахується локальним записом міста', () => {
  const topic = TOPICS['bezkoshtovni-hurtky'];
  const rows = [hurtok(['Вся Україна']), hurtok(['Житомир'])];
  assert.equal(localTopicCount(rows, topic, 'Житомир'), 1);
  assert.equal(isLocal(rows[0], 'Житомир'), false);
  // ...але на сторінці міста всеукраїнське показуємо.
  assert.equal(inCityOrNationwide(rows[0], 'Житомир'), true);
});

// Сторінка «місто × тема» віддає 404, якщо для теми немає тексту під
// локальний запит. Без цієї перевірки такий слуг усе одно потрапляв би в
// sitemap і в generateStaticParams — Google діставав би адресу, якої немає.
test('у список комбінацій не потрапляють теми без локальних текстів', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: i, opportunity_type: 'psychology', title: 'Психологічна підтримка',
    summary: '', cities: ['Київ'], countries: [], format: 'offline',
  }));
  const combos = qualifyingCombos(rows);
  assert.equal(combos.filter((c) => c.topicSlug === 'psykholohichna-dopomoha').length, 0);
  for (const c of combos) assert.ok(CITY_TOPIC_TEXTS[c.topicSlug], `${c.topicSlug} без текстів`);
});
