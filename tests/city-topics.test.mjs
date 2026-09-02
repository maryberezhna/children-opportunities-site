import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LOCAL, isLocal, inCityOrNationwide, localTopicCount, qualifyingCombos } from '../lib/city-topics.js';
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
