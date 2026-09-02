import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../lib/topics.js';

// Правила добору підбірок матчать лише ПОЧАТОК слова у НАЗВІ: без цього
// «курс» ловив усі 91 «конКУРС» і сторінка гуртків показувала конкурси.
test('«курс» не матчить «конкурс» (word boundary)', () => {
  const o = { cost_type: 'free', aid_type: null, opportunity_type: null,
              title: 'Конкурс малюнка для дітей', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), false);
  assert.equal(TOPICS['konkursy'].match(o), true);
});

test('гурток за типом потрапляє в підбірку і без слова в назві', () => {
  const o = { cost_type: 'free', aid_type: null, opportunity_type: 'club',
              title: 'Юні натуралісти', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), true);
});

test('держвиплата не потрапляє в гуртки навіть зі словом «курс»', () => {
  const o = { cost_type: 'free', aid_type: 'retraining', opportunity_type: 'course',
              title: 'Курси перекваліфікації УБД', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), false);
});
