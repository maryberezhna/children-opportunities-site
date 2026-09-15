import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROTATION, PLAN_START, FALLBACK_TOPIC, planEntryFor, addDays } from '../scripts/channel-plan.mjs';

// До 16.09.2026 канал жив за шаблоном тижня: ті самі формати в ті самі дні.
// Марія попросила план, де кожен день має свою тему. Ці тести не дають плану
// тихо знову стати шаблоном: тема двічі за цикл, дві ситуації поспіль,
// посилання кудись не туди.

test('жодна тема не повторюється за цикл', () => {
  const keys = ROTATION.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('цикл довший за вікно, в якому можливості не повторюються (30 днів)', () => {
  assert.ok(ROTATION.length > 30, `у циклі ${ROTATION.length} днів`);
});

test('план стартує 16.09, перший цикл закінчується 31.10 і йде по колу', () => {
  assert.equal(PLAN_START, '2026-09-16');
  assert.equal(planEntryFor(PLAN_START).index, 0);
  assert.equal(planEntryFor('2026-10-31').index, ROTATION.length - 1);
  assert.equal(planEntryFor('2026-11-01').index, 0);
  assert.equal(planEntryFor('2026-09-15').index, ROTATION.length - 1);
});

test('кожна з шести ситуацій і кожна з трьох цифр — рівно раз за цикл', () => {
  const situations = ROTATION.filter((e) => e.kind === 'situation').map((e) => e.situation).sort();
  assert.deepEqual(situations, [0, 1, 2, 3, 4, 5]);
  const cards = ROTATION.filter((e) => e.kind === 'number').map((e) => e.card).sort();
  assert.deepEqual(cards, [0, 1, 2]);
});

test('готові пости існують і кожен виходить раз за цикл', () => {
  const files = ROTATION.filter((e) => e.kind === 'file').map((e) => e.file);
  assert.equal(new Set(files).size, files.length);
  for (const f of files) {
    assert.ok(existsSync(new URL(`../content/telegram/${f}`, import.meta.url)), `немає content/telegram/${f}`);
  }
});

test('два однакові формати не стоять поруч (крім дайджестів)', () => {
  for (let i = 0; i < ROTATION.length; i += 1) {
    const a = ROTATION[i];
    const b = ROTATION[(i + 1) % ROTATION.length];
    if (a.kind === 'digest') continue;
    assert.notEqual(a.kind, b.kind, `${a.key} і ${b.key} — обидва ${a.kind}`);
  }
});

test('у тем із добором є заголовок, фільтр і посилання на dityam.com.ua', () => {
  for (const e of [...ROTATION, FALLBACK_TOPIC]) {
    if (!['digest', 'story', 'deadlines'].includes(e.kind)) continue;
    assert.ok(e.heading, `${e.key}: немає заголовка`);
    assert.ok(e.link?.startsWith('https://dityam.com.ua/'), `${e.key}: посилання ${e.link}`);
    if (e.kind !== 'deadlines') assert.equal(typeof e.match, 'function', `${e.key}: немає фільтра`);
  }
});

test('фільтри тем відповідають назві', () => {
  const kid = { age_from: 3, age_to: 6, child_needs: [], cities: [] };
  const teen = { age_from: 14, age_to: 18, child_needs: [], cities: [] };
  const byKey = Object.fromEntries(ROTATION.map((e) => [e.key, e]));
  assert.equal(byKey['kids-0-6'].match(kid), true);
  assert.equal(byKey['kids-0-6'].match(teen), false);
  assert.equal(byKey['age-15-17'].match(teen), true);
  assert.equal(byKey['need-idp'].match({ child_needs: ['idp'] }), true);
  assert.equal(byKey['city-kyiv'].match({ cities: ['Київ'] }), true);
  assert.equal(byKey.it.match({ title: 'Курс програмування Python' }), true);
});

test('addDays рахує календарні дні', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
});
