import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  ROTATION, PLAN_START, FALLBACK_TOPIC, MONTHLY_DAY, MONTHLY_ENTRY, planEntryFor, addDays,
  COLLECTIONS, COLLECTION_START, DEADLINES_WEEK, MONTHLY_POLLS, pollFor,
} from '../scripts/channel-plan.mjs';

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

test('план стартував 16.09; з 06.10 щоденна тема — лише підбірка', () => {
  assert.equal(PLAN_START, '2026-09-16');
  assert.equal(COLLECTION_START, '2026-10-06');
  for (let i = 0; i < 70; i += 1) {
    const e = planEntryFor(addDays(COLLECTION_START, i));
    if (e.key === MONTHLY_ENTRY.key) continue;
    assert.ok(e.kind === 'digest' || e.kind === 'file', `${e.key}: ${e.kind}`);
  }
  assert.ok(!COLLECTIONS.some((e) => ['situation', 'number', 'story', 'deadlines'].includes(e.kind)));
  assert.ok(!COLLECTIONS.some((e) => e.file === 'dedlainy-dva-tyzhni.html'), 'дедлайни тепер щоранку окремо');
});

test('підбірки йдуть по колу, і жодна не повторюється раніше, ніж за 30 днів', () => {
  const keys = COLLECTIONS.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(COLLECTIONS.length > 30, `у черзі ${COLLECTIONS.length} підбірок`);
  assert.equal(planEntryFor(COLLECTION_START).index, 0);
  assert.equal(planEntryFor(addDays(COLLECTION_START, COLLECTIONS.length)).index, 0);
});

test('черга починається з підбірок, яких 16.09–05.10 ще не було', () => {
  const posted = ROTATION.slice(0, 20).map((e) => e.key);
  assert.ok(!posted.includes(planEntryFor(COLLECTION_START).key));
  // Ті, що вже вийшли, стоять у кінці черги — після всіх нових.
  const firstOld = COLLECTIONS.findIndex((e) => posted.includes(e.key));
  assert.ok(COLLECTIONS.slice(firstOld).every((e) => posted.includes(e.key)));
});

test('ранковий пост «Дедлайни цього тижня» веде на сторінку дедлайнів', () => {
  assert.equal(DEADLINES_WEEK.kind, 'deadlines-week');
  assert.ok(DEADLINES_WEEK.heading.includes('цього тижня'));
  assert.equal(DEADLINES_WEEK.link, 'https://dityam.com.ua/dedlainy');
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

test('раз на місяць замість теми дня — прохання розповісти історію', () => {
  assert.equal(MONTHLY_DAY, 15);
  for (const d of ['2026-10-15', '2026-11-15', '2027-02-15']) {
    assert.equal(planEntryFor(d).key, MONTHLY_ENTRY.key, d);
  }
  assert.notEqual(planEntryFor('2026-10-14').key, MONTHLY_ENTRY.key);
  assert.notEqual(planEntryFor('2026-10-16').key, MONTHLY_ENTRY.key);
  assert.ok(!ROTATION.some((e) => e.key === MONTHLY_ENTRY.key), 'щомісячний пост не має стояти ще й у ротації');
  assert.ok(existsSync(new URL(`../content/telegram/${MONTHLY_ENTRY.file}`, import.meta.url)));
});

test('addDays рахує календарні дні', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
});

test('15-го — опитування батьків: з жовтня 2026 по черзі, без повтору за пів року', () => {
  assert.equal(pollFor('2026-10-15').key, 'age');
  assert.equal(pollFor('2026-11-15').key, 'looking-for');
  // Жовтень — 1-ше, березень 2027 — 6-те (останнє), квітень — знову вік.
  assert.equal(pollFor('2027-03-15').key, MONTHLY_POLLS[MONTHLY_POLLS.length - 1].key);
  assert.equal(pollFor('2027-04-15').key, 'age');
  assert.equal(pollFor('2026-10-14'), null);
  assert.equal(pollFor('2026-10-16'), null);
  const keys = MONTHLY_POLLS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('опитування вкладаються в обмеження Telegram', () => {
  for (const p of MONTHLY_POLLS) {
    assert.ok(p.question.length >= 1 && p.question.length <= 300, p.key);
    assert.ok(p.options.length >= 2 && p.options.length <= 10, `${p.key}: ${p.options.length} варіантів`);
    for (const o of p.options) assert.ok(o.length >= 1 && o.length <= 100, `${p.key}: «${o}»`);
    assert.equal(new Set(p.options).size, p.options.length, `${p.key}: однакові варіанти`);
    assert.equal(typeof p.multiple, 'boolean');
  }
});
