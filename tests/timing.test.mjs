import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, isPeriodic, soonestDeadlines, whenRank, whenState } from '../lib/timing.js';
import { calendarTarget, googleCalendarUrl } from '../lib/calendar-links.js';

// Кейси з аудиту «Дедлайн, подія, сезон» (17.09.2026).
const TODAY = '2026-09-17';

test('подача відкрита — рахуємо дні до ДЕДЛАЙНУ, навіть якщо подія далі', () => {
  // Мальме: заявки до 17 вересня, сесія 6–8 листопада.
  const malmo = { deadline: '2026-09-17', event_start_date: '2026-11-06',
    event_end_date: '2026-11-08', timing_kind: 'one_time' };
  assert.deepEqual(whenState(malmo, TODAY), { state: 'deadline', days: 0 });
});

test('після дедлайну, до події — подія, а не «набір відкритий»', () => {
  const s = whenState({ event_start_date: '2026-11-06', event_end_date: '2026-11-08' }, TODAY);
  assert.equal(s.state, 'event');
  assert.equal(s.days, 50);
});

test('подія триває — running', () => {
  const s = whenState({ event_start_date: '2026-09-01', event_end_date: '2026-09-30' }, TODAY);
  assert.deepEqual(s, { state: 'running', days: 13 });
});

test('лише кінець події — показуємо кінець, не вигадуємо початок', () => {
  const s = whenState({ event_end_date: '2026-10-01' }, TODAY);
  assert.deepEqual(s, { state: 'event', days: 14, date: '2026-10-01' });
});

test('без дат вид важить більше за тип', () => {
  // Конкурс, що не повториться, більше не «🔄 щорічно».
  assert.equal(whenState({ opportunity_type: 'competition', timing_kind: 'one_time' }, TODAY).state, 'open');
  assert.equal(whenState({ opportunity_type: 'club', timing_kind: 'periodic' }, TODAY).state, 'periodic');
  assert.equal(whenState({ opportunity_type: 'course', timing_kind: 'permanent' }, TODAY).state, 'permanent');
  // Вид ще не визначено — лишається підказка за типом.
  assert.equal(whenState({ opportunity_type: 'olympiad' }, TODAY).state, 'periodic');
  assert.equal(whenState({ opportunity_type: 'course' }, TODAY).state, 'open');
});

test('isPeriodic: вид, а тип лише запасний', () => {
  assert.equal(isPeriodic({ opportunity_type: 'competition', timing_kind: 'one_time' }), false);
  assert.equal(isPeriodic({ opportunity_type: 'competition' }), true);
});

test('isExpired — дзеркало scraper/timing.py is_expired', () => {
  assert.equal(isExpired({ deadline: '2026-09-16' }, TODAY), true);
  assert.equal(isExpired({ deadline: '2026-09-17' }, TODAY), false);
  assert.equal(isExpired({ event_start_date: '2026-09-01', event_end_date: '2026-09-30' }, TODAY), false);
  assert.equal(isExpired({ event_start_date: '2026-09-01' }, TODAY), true);
  assert.equal(isExpired({ event_end_date: '2026-09-10' }, TODAY), true);
  assert.equal(isExpired({}, TODAY), false);
});

test('whenRank: найближче угорі, без дат — у кінець', () => {
  const items = [
    { id: 'none' },
    { id: 'event', event_start_date: '2026-10-01' },
    { id: 'deadline', deadline: '2026-09-20' },
  ];
  const sorted = [...items].sort((a, b) => whenRank(a, TODAY) - whenRank(b, TODAY));
  assert.deepEqual(sorted.map((i) => i.id), ['deadline', 'event', 'none']);
  assert.equal(whenRank({}, TODAY), Number.POSITIVE_INFINITY);
});


test('календар: дедлайн, поки попереду, інакше — дати події', () => {
  const malmo = { deadline: '2026-09-30', event_start_date: '2026-11-06', event_end_date: '2026-11-08' };
  assert.deepEqual(calendarTarget(malmo, TODAY), { kind: 'deadline', start: '2026-09-30', end: '2026-09-30' });
  assert.deepEqual(calendarTarget({ ...malmo, deadline: '2026-09-10' }, TODAY),
    { kind: 'event', start: '2026-11-06', end: '2026-11-08' });
  assert.equal(calendarTarget({ event_end_date: '2026-09-01' }, TODAY), null);
  assert.equal(calendarTarget({}, TODAY), null);
});

test('Google: подія — цілі дні, дедлайн — зустріч, і жодного порожнього проміжку', () => {
  const url = googleCalendarUrl({ title: 't', date: '2026-11-06', endDate: '2026-11-08', url: 'https://x' });
  assert.match(decodeURIComponent(url), /dates=20261106\/20261109/);
  // Дедлайн раніше давав «20260930/20260930» — початок і кінець в один день.
  // Google таку подію не створює, і кнопка «📅» в добірці не працювала
  // (Марія, 25.09.2026). Тепер це зустріч о 09:00, як у .ics.
  const dl = googleCalendarUrl({ title: 't', date: '2026-09-30', url: 'https://x' });
  assert.match(decodeURIComponent(dl), /dates=20260930T090000\/20260930T095900/);
});

test('лише дата розіграшу — стан results і закриття після неї', () => {
  // «10 річних грантів на англійську»: переможців визначать 30 вересня,
  // строк подачі й дати навчання не названі.
  const grant = { results_date: '2026-09-30', timing_kind: 'one_time' };
  assert.deepEqual(whenState(grant, TODAY), { state: 'results', days: 13, date: '2026-09-30' });
  assert.equal(whenRank(grant, TODAY), 13);
  assert.equal(isExpired(grant, '2026-10-01'), true);
  assert.equal(isExpired(grant, TODAY), false);
  // Дедлайн важить більше: результати — лише коли інших дат немає.
  assert.equal(whenState({ ...grant, deadline: '2026-09-25' }, TODAY).state, 'deadline');
});

test('блок «Кава чи можливість»: три найближчі дедлайни, без минулих', () => {
  const items = [
    { id: 'past', deadline: '2026-09-16' },
    { id: 'c', deadline: '2026-10-01' },
    { id: 'a', deadline: '2026-09-18' },
    { id: 'today', deadline: TODAY },
    { id: 'd', deadline: '2026-12-01' },
    { id: 'none' },
  ];
  assert.deepEqual(soonestDeadlines(items, TODAY).map((o) => o.id), ['today', 'a', 'c']);
  assert.deepEqual(soonestDeadlines([], TODAY), []);
  assert.deepEqual(soonestDeadlines(null, TODAY), []);
});
