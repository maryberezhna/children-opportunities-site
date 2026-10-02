import test from 'node:test';
import assert from 'node:assert/strict';
import { stillAhead, verdictForStatus } from '../lib/links.js';

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

// --- «не достукались» ≠ «сторінки немає», 02.10.2026 ---
//
// Перевірка ходить з IP GitHub Actions, і частина сайтів — особливо
// державних — рве зʼєднання або віддає 5xx саме для них. Доти це рахувалось
// як мертвий лінк: за три ночі запис ставав dead, а то й закривався.
//
// З 13 записів, позначених мертвими, 11 відповідали 200 зі звичайної адреси.
// Тобто два справжні биті лінки губились серед девʼяти вигаданих.
test('404 і 410 — сторінки справді немає', () => {
  for (const s of [404, 410]) assert.equal(verdictForStatus(s).alive, false, String(s));
});

test('5xx — ми нічого не дізнались, запис не чіпаємо', () => {
  for (const s of [500, 502, 503, 522]) {
    const v = verdictForStatus(s);
    assert.equal(v.unknown, true, String(s));
    assert.notEqual(v.alive, false, `${s} не має рахуватись мертвим`);
  }
});

test('403 і 429 — бот-захист, сторінка жива', () => {
  for (const s of [403, 429]) assert.equal(verdictForStatus(s).alive, true, String(s));
});

test('2xx — жива', () => {
  assert.equal(verdictForStatus(200).alive, true);
});

// Саме цей код віддає сторінка Фастівської громади — і це єдиний із
// тринадцяти, що справді не відповідає.
test('522 не закриває запис', () => {
  assert.equal(verdictForStatus(522).unknown, true);
});
