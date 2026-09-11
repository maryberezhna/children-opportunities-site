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

// «Дитина їде за кордон»: лише справжні поїздки. Гурток в Ірландії для родин,
// які вже виїхали, і онлайн-курс закордонного організатора сюди не потрапляють.
test('за кордон: обмін із країною і міжнародною міткою — так', () => {
  const o = { opportunity_type: 'exchange', title: 'Програма обміну FLEX',
              countries: ['us'], is_international: true, format: 'Офлайн', cities: [] };
  assert.equal(TOPICS['za-kordon'].match(o), true);
});

test('за кордон: міжнародна олімпіада без країни — так', () => {
  const o = { opportunity_type: 'olympiad', title: 'Міжнародна біологічна олімпіада',
              countries: [], is_international: true, format: 'Офлайн', cities: ['Міжнародні'] };
  assert.equal(TOPICS['za-kordon'].match(o), true);
});

test('за кордон: гурток для родин, які вже за кордоном — ні', () => {
  const o = { opportunity_type: 'club', title: 'Art classes for Ukrainian families',
              countries: ['ie'], is_international: false, format: 'Офлайн', cities: [] };
  assert.equal(TOPICS['za-kordon'].match(o), false);
});

test('за кордон: онлайн-курс закордонного організатора — ні, підготовка до вступу за кордон — так', () => {
  const online = { opportunity_type: 'course', title: 'English for STEM',
                   countries: ['ie'], is_international: true, format: 'Онлайн', cities: ['Онлайн'] };
  assert.equal(TOPICS['za-kordon'].match(online), false);
  const prep = { opportunity_type: 'course', title: 'Підготовка до вступу в закордонні школи',
                 countries: [], is_international: true, format: 'Онлайн', cities: ['Онлайн'] };
  assert.equal(TOPICS['za-kordon'].match(prep), true);
});

test('за кордон: український гурток із міткою «міжнародний» — ні', () => {
  const o = { opportunity_type: 'club', title: 'Дитячий хор',
              countries: ['ua'], is_international: true, format: 'Офлайн', cities: ['Київ'] };
  assert.equal(TOPICS['za-kordon'].match(o), false);
});

// «Дітям ветеранів»: сюди потрапляє лише те, де статус родини — умова участі.
// Окреме слово «ветеран» будь-де в описі ловило 99 записів, у яких ветерани
// згадані мимохідь: у переліку партнерів, в історії організації, у складі
// журі. Родина, яка витратить сили на таку програму, дізнається про помилку
// вже в заявці, тому правило вимагає звʼязки «діти/родини» + статус.
test('дітям ветеранів: мітка child_needs достатня', () => {
  const o = { title: 'Табір у Карпатах', summary: '', child_needs: ['veteran_family'] };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), true);
});

test('дітям ветеранів: звʼязка «діти + загиблі» у тексті — так', () => {
  const o = { title: 'Безкоштовний табір', child_needs: [],
              summary: 'Путівки для дітей загиблих захисників України, 7–17 років.' };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), true);
});

test('дітям ветеранів: згадка ветеранів мимохідь — ні', () => {
  const o = { title: 'StudBiz Award — премія для шкільних підприємств', child_needs: [],
              summary: 'Серед партнерів премії — ветеранські організації та бізнес.' };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), false);
});
