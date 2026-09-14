import test from 'node:test';
import assert from 'node:assert/strict';
import {
  placeOk, childMatch, childrenOf, childLabel, matchFamily, pickFair, formatsOf,
} from '../lib/plusProfile.js';

// Дзеркало: scraper/tests/test_plus_profile.py. Правити обидва файли.

const opp = (over = {}) => ({
  id: 'x', opportunity_type: 'club', age_from: 6, age_to: 12, cost_type: 'free',
  format: 'offline', cities: ['Львів'], countries: ['ua'], is_international: false,
  child_needs: [], ...over,
});
const none = new Set();

test('місце: порожній вибір підходить будь-де', () => {
  assert.equal(placeOk(opp(), []), true);
});

test('місце: місто, онлайн, за кордоном і «Вся Україна»', () => {
  assert.equal(placeOk(opp(), ['Київ']), false);
  assert.equal(placeOk(opp(), ['Львів']), true);
  assert.equal(placeOk(opp({ cities: ['Вся Україна'] }), ['Київ']), true);
  assert.equal(placeOk(opp({ cities: ['Вся Україна'] }), ['__other']), true);
  assert.equal(placeOk(opp({ format: 'online', cities: [] }), ['online']), true);
  assert.equal(placeOk(opp({ format: 'hybrid' }), ['online']), true);
  assert.equal(placeOk(opp({ countries: ['pl'], cities: [] }), ['abroad']), true);
  assert.equal(placeOk(opp({ is_international: true, cities: [] }), ['abroad']), true);
  // «Вся Україна» не означає «за кордоном»
  assert.equal(placeOk(opp({ cities: ['Вся Україна'] }), ['abroad']), false);
});

test('місце: запис без позначки місця не вгадуємо', () => {
  assert.equal(placeOk(opp({ format: null, cities: [], countries: null }), ['Київ']), false);
});

test('формат: за типом запису і за темою як запасний шлях', () => {
  assert.deepEqual([...formatsOf(opp({ opportunity_type: 'olympiad' }), none)], ['contests']);
  assert.deepEqual([...formatsOf(opp({ opportunity_type: 'rehabilitation' }), new Set(['camps']))], ['camps']);
});

test('дитина: вік обовʼязковий, вподобання й формат одночасно', () => {
  const child = { age_bands: ['7-10'], likes: ['stem'], formats: ['camps'], needs: [] };
  assert.equal(childMatch(child, opp({ opportunity_type: 'camp' }), new Set(['stem'])), 'profile');
  assert.equal(childMatch(child, opp({ opportunity_type: 'club' }), new Set(['stem'])), null);
  assert.equal(childMatch(child, opp({ opportunity_type: 'camp' }), new Set(['arts'])), null);
  assert.equal(childMatch(child, opp({ age_from: 15, age_to: 18, opportunity_type: 'camp' }), new Set(['stem'])), null);
});

test('дитина: особлива обставина відкриває запис поза вподобаннями, але не поза віком', () => {
  const child = { age_bands: ['7-10'], likes: ['stem'], formats: [], needs: ['idp'] };
  const aid = opp({ opportunity_type: 'allowance', child_needs: ['idp'], age_from: 0, age_to: 17 });
  assert.equal(childMatch(child, aid, none), 'need');
  assert.equal(childMatch(child, { ...aid, age_from: 15, age_to: 17 }, none), null);
});

test('діти: старий профіль з одного рядка стає першою дитиною', () => {
  const sub = { id: 's', age_bands: ['7-10'], interests: ['stem', 'camps', 'international'] };
  const [c] = childrenOf(sub, []);
  assert.deepEqual(c.age_bands, ['7-10']);
  assert.deepEqual(c.likes, ['stem']);
  assert.deepEqual(c.formats, ['camps']);
});

test('діти: окремі профілі мають перевагу над старими полями', () => {
  const sub = { id: 's', age_bands: ['0-3'], interests: [] };
  const rows = [
    { subscriber_id: 's', position: 2, age_bands: ['15-18'] },
    { subscriber_id: 's', position: 1, age_bands: ['7-10'] },
    { subscriber_id: 'other', position: 1, age_bands: ['4-6'] },
  ];
  assert.deepEqual(childrenOf(sub, rows).map((c) => c.position), [1, 2]);
});

test('підпис дитини лише коли дітей кілька', () => {
  const c = { position: 2, age_bands: ['11-14', '15-18'] };
  assert.equal(childLabel(c, 1), '');
  assert.equal(childLabel(c, 2), 'Дитина 2 (11–18 р.)');
});

test('родина: запис для двох дітей приходить один раз із обома', () => {
  const small = { position: 1, age_bands: ['7-10'], likes: [], formats: [], needs: [] };
  const teen = { position: 2, age_bands: ['11-14'], likes: [], formats: [], needs: [] };
  const both = opp({ id: 'both', age_from: 8, age_to: 13 });
  const res = matchFamily({ cost_pref: 'any', places: [] }, [small, teen], [both], () => none);
  assert.equal(res.length, 1);
  assert.deepEqual(res[0].kids, [small, teen]);
});

test('родина: вартість і місце спільні для всіх дітей', () => {
  const kid = { position: 1, age_bands: [], likes: [], formats: [], needs: [] };
  const paid = opp({ cost_type: 'paid_affordable' });
  assert.equal(matchFamily({ cost_pref: 'free_only', places: [] }, [kid], [paid], () => none).length, 0);
  assert.equal(matchFamily({ cost_pref: 'any', places: ['Київ'] }, [kid], [opp()], () => none).length, 0);
});

test('добірка ділиться по черзі між дітьми', () => {
  const a = { position: 1, age_bands: ['7-10'], likes: [], formats: [], needs: [] };
  const b = { position: 2, age_bands: ['15-18'], likes: [], formats: [], needs: [] };
  const young = [1, 2, 3, 4].map((i) => opp({ id: `y${i}`, age_from: 7, age_to: 10 }));
  const old = [opp({ id: 'o1', age_from: 15, age_to: 18 })];
  const matches = matchFamily({ cost_pref: 'any', places: [] }, [a, b], [...young, ...old], () => none);
  const picked = pickFair(matches, [a, b], 3).map((m) => m.o.id);
  assert.deepEqual(picked, ['y1', 'o1', 'y2']);
});
