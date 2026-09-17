import test from 'node:test';
import assert from 'node:assert/strict';
import { dateWarnings } from '../lib/date-warnings.js';
import { formatEventDates } from '../lib/dates.js';

// Усі випадки — справжні записи з бази на 17.09.2026.

test('академія ветмедицини в старій розмітці: обидва сигнали', () => {
  const w = dateWarnings({
    opportunity_type: 'course', deadline: '2026-10-27',
    event_start_date: null, event_end_date: '2026-10-29',
  });
  assert.equal(w.length, 2);
  assert.match(w[0], /перший день події/);
  assert.match(w[1], /«Курс», а подія триває 3 дні/);
});

test('та сама академія після виправлення: лише тип', () => {
  const w = dateWarnings({
    opportunity_type: 'course', deadline: null,
    event_start_date: '2026-10-27', event_end_date: '2026-10-29',
  });
  assert.equal(w.length, 1);
  assert.match(w[0], /триває 3 дні/);
});

test('одноденна зустріч із типом «Гурток»', () => {
  const w = dateWarnings({
    opportunity_type: 'club', deadline: '2026-09-20',
    event_start_date: null, event_end_date: '2026-09-20',
  });
  assert.match(w[0], /перший день події/);
  assert.match(w[1], /«Гурток», а подія триває 1 день/);
});

test('справжній дедлайн задовго до події не чіпаємо', () => {
  // Школа журналістських розслідувань: подача до 21 вересня, школа 19–23
  // жовтня. Дедлайн правдивий; тип — привід глянути, бо 5 днів.
  const w = dateWarnings({
    opportunity_type: 'course', deadline: '2026-09-21',
    event_start_date: '2026-10-19', event_end_date: '2026-10-23',
  });
  assert.equal(w.length, 1);
  assert.match(w[0], /триває 5 днів/);
});

test('табір на кілька днів — нормальний тип, мовчимо', () => {
  assert.deepEqual(dateWarnings({
    opportunity_type: 'camp', event_start_date: '2026-10-26', event_end_date: '2026-10-30',
  }), []);
});

test('гурток на рік і запис без дат — мовчимо', () => {
  assert.deepEqual(dateWarnings({
    opportunity_type: 'club', event_end_date: '2027-12-31',
  }), []);
  assert.deepEqual(dateWarnings({ opportunity_type: 'course', recurrence: 'ongoing' }), []);
});

test('діапазон проведення друкується без повтору місяця', () => {
  assert.equal(
    formatEventDates({ event_start_date: '2026-10-27', event_end_date: '2026-10-29' }),
    '27 — 29 жовтня 2026',
  );
});
