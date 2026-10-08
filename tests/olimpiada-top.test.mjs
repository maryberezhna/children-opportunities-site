// Олімпіада в «Топ 3 цього тижня» (Марія, 06.10.2026: «помісти цю можливість
// у топ 3»). Вона — наша сторінка, а не запис у базі, тож картка веде на
// /olimpiada і не повинна витісняти місця, які оплатили організатори.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { topWeekCards, selectWeeklyTop, day } from '../lib/weekly-top.js';
import { sliderCards } from '../lib/top-week-slider.js';
import { OLIMP_TOP, OLIMP_OPEN, OLIMP_PUBLIC } from '../lib/olimpiada.js';
import { daysUntil } from '../lib/dates.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const WEEK = '2026-W41';
const card = (id, deadline, extra = {}) => ({ id, deadline, title: `К${id}`, ...extra });
const items = [card(1, '2026-10-08'), card(2, '2026-10-09'), card(3, '2026-10-10')];

const pin = (id) => card(id, null, { featured_week: WEEK, status: 'active', timing_kind: 'permanent' });

test('олімпіада стає першою в трійці, поки сторінка відкрита', () => {
  assert.equal(OLIMP_TOP.length, OLIMP_OPEN || OLIMP_PUBLIC ? 1 : 0);
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-06', daysUntil, own: OLIMP_TOP });
  assert.deepEqual(top.map((c) => c.id), [OLIMP_TOP[0].id, 1, 2]);
});

test('відмічене в адмінці олімпіада не витісняє: 2 позначки — вона й обидві', () => {
  const top = topWeekCards({ items: [...items, pin(8), pin(9)], week: WEEK, todayIso: '2026-10-06', daysUntil, own: OLIMP_TOP });
  assert.deepEqual(top.map((c) => c.id), [OLIMP_TOP[0].id, 8, 9]);
});

test('3 позначки (напр. 3 оплачені місця) — олімпіади цього тижня в блоці немає', () => {
  const top = topWeekCards({ items: [...items, pin(7), pin(8), pin(9)], week: WEEK, todayIso: '2026-10-06', daysUntil, own: OLIMP_TOP });
  assert.deepEqual(top.map((c) => c.id), [7, 8, 9]);
});

test('правило тижня лишає олімпіаді місце: добирає 3 − OLIMP_TOP', () => {
  const today = day('2026-10-06');
  const free = [5, 6, 7].map((n, i) => ({ id: n, opportunity_type: `t${i}`, deadline: `2026-10-1${i}`, age_from: 6, age_to: 18 }));
  assert.equal(selectWeeklyTop({ free, pinned: [], today, slots: 3 - OLIMP_TOP.length }).length, 3 - OLIMP_TOP.length);
  assert.equal(selectWeeklyTop({ free, pinned: [], today }).length, 3, 'без slots — як і було');
  assert.match(read('scripts/pick-weekly-top.mjs'), /slots: 3 - OLIMP_TOP\.length/);
});

test('без own трійка та сама, що й була', () => {
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-06', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [1, 2, 3]);
});

test('картка веде на /olimpiada, а не на /o/<slug>, і має підпис замість дати', () => {
  const [c] = sliderCards(OLIMP_TOP, { pinned: 'Топ', type: { olympiad: 'Олімпіада' }, age: (o) => `${o.age_from}–${o.age_to} років` });
  assert.equal(c.href, '/olimpiada');
  assert.equal(c.day, null);
  assert.equal(c.dateLabel, OLIMP_OPEN ? 'Топ' : 'Скоро старт');
  // «На самій картці написати, що дитина отримає» (Марія, 07.10.2026).
  assert.equal(c.meta, 'Олімпіада · 9–11 років · диплом одразу й призи щомісяця');
  for (const f of ['app/TopWeekSlider.js', 'app/TopWeekStrip.js']) {
    assert.match(read(f), /href=\{o\.href \|\| /, `${f}: власне посилання картки ігнорується`);
  }
});

test('олімпіада — на головній, у підбірках і в смужці телефона; не підліткам і не в /en', () => {
  assert.match(read('app/page.js'), /const soon = topWeekCards\(\{[^}]*own: OLIMP_TOP/);
  assert.doesNotMatch(read('app/page.js'), /const teenSoon = [^\n]*OLIMP_TOP/);
  assert.match(read('app/TopicPage.js'), /own: isEn \? \[\] : OLIMP_TOP/);
  assert.match(read('app/OpportunitiesList.js'), /const withOlimp = mobileLayout && !isEn && !teens;/);
});
