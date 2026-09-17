import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, isPeriodic, whenRank, whenState } from '../lib/timing.js';
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

test('Google: кінець цілоденної події — наступний день', () => {
  const url = googleCalendarUrl({ title: 't', date: '2026-11-06', endDate: '2026-11-08', url: 'https://x' });
  assert.match(decodeURIComponent(url), /dates=20261106\/20261109/);
  const dl = googleCalendarUrl({ title: 't', date: '2026-09-30', url: 'https://x' });
  assert.match(decodeURIComponent(dl), /dates=20260930\/20260930/);
});
