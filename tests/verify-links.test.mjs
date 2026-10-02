import test from 'node:test';
import assert from 'node:assert/strict';
import { siteWideFailure, stillAhead, verdictForStatus } from '../lib/links.js';

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

// --- «ліг весь сайт» ≠ «зникла сторінка», 02.10.2026 ---
//
// Три записи ГО «Важливі» — єдині в каталозі онлайн-групи психологічної
// підтримки для дітей полеглих і зниклих безвісти воїнів — пішли в suspect
// через http 423. Той самий 423 віддавала й головна important.org.ua: у
// організації закінчилась оплата хостингу, сторінки на місці. Перевіряльник
// закрив би всі три за три ночі — у категорії, де таких програм одиниці.
test('423 — «замкнено», а не «немає»', () => {
  const v = verdictForStatus(423);
  assert.equal(v.unknown, true);
  assert.notEqual(v.alive, false);
});

test('408 і 425 теж означають «спробуй пізніше»', () => {
  for (const s of [408, 425]) assert.equal(verdictForStatus(s).unknown, true, String(s));
});

test('той самий код на головній — ліг сайт, запис не чіпаємо', () => {
  assert.equal(siteWideFailure({ pageStatus: 423, rootStatus: 423 }), true);
  assert.equal(siteWideFailure({ pageStatus: 402, rootStatus: 402 }), true);
});

test('головна в порядку, а сторінки немає — закриття законне', () => {
  assert.equal(siteWideFailure({ pageStatus: 404, rootStatus: 200 }), false);
});

// 404 лишається 404, навіть якщо головна теж віддає 404: сервер прямо каже,
// що цієї сторінки немає, і вигадувати за нього «та то весь сайт ліг» не треба.
test('404 закриває запис навіть при битій головній', () => {
  assert.equal(siteWideFailure({ pageStatus: 404, rootStatus: 404 }), false);
  assert.equal(siteWideFailure({ pageStatus: 410, rootStatus: 500 }), false);
});

test('головна теж не відповіла — це не привід закривати', () => {
  // Корінь віддав 500, сторінка 400: сайт нездоровий цілком.
  assert.equal(siteWideFailure({ pageStatus: 400, rootStatus: 503 }), true);
});

test('до кореня не достукались — правило не спрацьовує', () => {
  // null = зʼєднання не відкрилось. Тоді вирішує звичайний лічильник невдач,
  // щоб відсутність відповіді від головної не ставала вічним щитом.
  assert.equal(siteWideFailure({ pageStatus: 400, rootStatus: null }), false);
});
