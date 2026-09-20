import test from 'node:test';
import assert from 'node:assert/strict';
import { stillAhead } from '../lib/links.js';

// 20.09.2026: NASA Space Apps Challenge (хакатон 14–15 листопада) закрився
// як «мертвий лінк». Сайт живий — з мака 200; 403 віддається саме на IP
// GitHub Actions. Запис зник із каталогу за три тижні до події.
const TODAY = '2026-09-20';

test('подія попереду — запис не закриваємо', () => {
  assert.equal(stillAhead({ event_start_date: '2026-11-14', event_end_date: '2026-11-15' }, TODAY), true);
});

test('дедлайн подачі попереду — теж не закриваємо', () => {
  assert.equal(stillAhead({ deadline: '2026-10-30' }, TODAY), true);
});

test('сьогоднішній дедлайн — ще подають', () => {
  assert.equal(stillAhead({ deadline: TODAY }, TODAY), true);
});

test('усе в минулому — закриття дозволене', () => {
  assert.equal(stillAhead({ deadline: '2026-09-19', event_end_date: '2026-08-01' }, TODAY), false);
});

test('дат немає — закриття дозволене', () => {
  assert.equal(stillAhead({}, TODAY), false);
  assert.equal(stillAhead(null, TODAY), false);
});
