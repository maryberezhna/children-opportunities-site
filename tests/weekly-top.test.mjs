import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWeeklyTop, topWeekCards, day } from '../lib/weekly-top.js';
import { daysUntil } from '../lib/dates.js';

const today = day('2026-10-01');
const iso = (d) => new Date((day('2026-10-01') + d) * 86400000).toISOString().slice(0, 10);
const free = (id, type, days) => ({
  id, opportunity_type: type, cost_type: 'free', deadline: iso(days),
  title: `Безкоштовна ${id}`, summary: 'x'.repeat(130), cities: ['Київ'],
  age_from: 6, age_to: 18, details: 'опис',
});

test('правило бере три різні типи з вікна дедлайнів', () => {
  const picked = selectWeeklyTop({
    free: [free(1, 'camp', 10), free(2, 'camp', 12), free(3, 'contest', 8), free(4, 'olympiad', 9)],
    pinned: [], today,
  });
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((o) => o.opportunity_type)).size, 3);
});

test('дедлайн поза вікном 3–30 днів не береться', () => {
  const picked = selectWeeklyTop({ free: [free(1, 'camp', 1), free(2, 'camp', 60)], pinned: [], today });
  assert.equal(picked.length, 0);
});

// Головне, заради чого правило винесене в окремий файл. Платне просування
// організаторам (500 грн за тиждень у «Топ тижня», з 21.09.2026) виконується
// саме позначкою featured_week. Доти скрипт тягнув із бази лише
// cost_type='free', тож платний запис не потрапляв ні у вибір, ні в список
// «лишити» — і крок «зняти позначку з чужих» стирав його мовчки. Партнер
// платив за тиждень і зникав із блока в день перезапуску воркфлоу.
test('платний запис, відмічений вручну, лишається в трійці', () => {
  const partner = { id: 99, opportunity_type: 'competition', cost_type: 'paid_affordable',
                    deadline: iso(20), title: 'Конкурс партнера', summary: 'y'.repeat(130),
                    cities: ['Львів'], age_from: 7, age_to: 17, featured_week: '2026-W40' };
  const picked = selectWeeklyTop({ free: [free(1, 'camp', 10), free(2, 'olympiad', 9)], pinned: [partner], today });
  assert.ok(picked.some((o) => o.id === 99), 'платний пін зник із трійки');
  assert.equal(picked.length, 3);
});

test('три ручні позначки не лишають місця правилу', () => {
  const pin = (id) => ({ id, opportunity_type: 'camp', cost_type: 'paid_affordable', title: `П${id}` });
  const picked = selectWeeklyTop({ free: [free(1, 'olympiad', 10)], pinned: [pin(7), pin(8), pin(9)], today });
  assert.deepEqual(picked.map((o) => o.id), [7, 8, 9]);
});

// --- блок «Топ тижня» на сайті ---
//
// Доти блок рахував трійку сам — три найближчі дедлайни — і позначки
// featured_week не бачив зовсім. Тобто послуга, яку ми продаємо організаторам
// за 500 грн, не виконувалась: оплачена картка в блок не потрапляла, позначка
// давала лише ⭐ на сторінці можливості.
const WEEK = '2026-W40';
const card = (id, deadline, extra = {}) => ({ id, deadline, title: `К${id}`, ...extra });

test('Топ тижня: відмічена картка стоїть першою й займає місце', () => {
  const items = [card(1, '2026-10-05'), card(2, '2026-10-06'), card(3, '2026-10-07'),
                 card(9, '2026-11-20', { featured_week: WEEK })];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [9, 1, 2]);
});

test('Топ тижня: відмічена картка без дат теж потрапляє', () => {
  const items = [card(1, '2026-10-05'), card(2, '2026-10-06'),
                 card(9, null, { featured_week: WEEK })];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [9, 1, 2]);
});

// Правило Марії: якщо термін закінчився — знімаємо. 30.09.2026 у блоці висів
// закріплений вручну Erasmus+ Mobility з підписом «стежте за новим набором»:
// набір цього сезону минув, а блок кричить «⏰ встигніть цього тижня».
// Пропустило його послаблення з #569 — закріплені обходили перевірку дат.
test('Топ тижня: закріплений «щорічно, стежте за новим набором» не показуємо', () => {
  const periodic = { id: 9, deadline: null, timing_kind: 'periodic', recurrence: 'annual',
                     title: 'Щорічна програма', featured_week: WEEK };
  const items = [card(1, '2026-10-05'), card(2, '2026-10-06'), card(3, '2026-10-07'), periodic];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [1, 2, 3]);
});

test('Топ тижня: закріплений із протермінованим дедлайном не показуємо', () => {
  const past = card(9, '2026-09-01', { featured_week: WEEK });
  const items = [card(1, '2026-10-05'), card(2, '2026-10-06'), card(3, '2026-10-07'), past];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.ok(!top.some((c) => c.id === 9), 'протермінований лишився в трійці');
});

test('Топ тижня: закріплений постійний набір лишається', () => {
  const perm = { id: 9, deadline: null, timing_kind: 'permanent', title: 'Гурток партнера',
                 featured_week: WEEK };
  const top = topWeekCards({ items: [card(1, '2026-10-05'), perm], week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.equal(top[0].id, 9);
});

test('Топ тижня: позначка минулого тижня не діє', () => {
  const items = [card(1, '2026-10-05'), card(2, '2026-10-06'), card(3, '2026-10-07'),
                 card(9, '2026-11-20', { featured_week: '2026-W39' })];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [1, 2, 3]);
});

test('Топ тижня: без позначок — три найближчі дедлайни, як і було', () => {
  const items = [card(3, '2026-10-20'), card(1, '2026-10-05'), card(2, '2026-10-06'),
                 card(4, '2026-09-20')];
  const top = topWeekCards({ items, week: WEEK, todayIso: '2026-10-01', daysUntil });
  assert.deepEqual(top.map((c) => c.id), [1, 2, 3]);
});
