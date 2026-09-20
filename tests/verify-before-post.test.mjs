import test from 'node:test';
import assert from 'node:assert/strict';
import { keepOpen } from '../scripts/verify-before-post.mjs';

// Ворота публікації в канал: у пост іде лише те, що перевірка сторінки джерела
// щойно визнала відкритим. Випадок 20.09.2026 — «Літня ІТ-школа Star for Life
// Ukraine»: запис активний, лінк віддає 200, а школа скінчилась 20 серпня.

const row = (id, title) => ({ id, title, slug: id });

test('відкрита можливість проходить', () => {
  const items = [row('a', 'Конкурс')];
  const { kept, dropped } = keepOpen(items, { a: { state: 'open', status: 'active' } });
  assert.deepEqual(kept.map((r) => r.id), ['a']);
  assert.equal(dropped.length, 0);
});

test('сезон завершено — не публікуємо', () => {
  const items = [row('a', 'Літня ІТ-школа')];
  const { kept, dropped } = keepOpen(items, { a: { state: 'ended', status: 'closed' } });
  assert.equal(kept.length, 0);
  assert.match(dropped[0].why, /ended/);
});

test('сторінка вже не про цю можливість — не публікуємо', () => {
  const { kept } = keepOpen([row('a')], { a: { state: 'gone', status: 'closed' } });
  assert.equal(kept.length, 0);
});

test('«відкрито», але запис перестав бути активним — не публікуємо', () => {
  const { kept, dropped } = keepOpen([row('a')], { a: { state: 'open', status: 'closed' } });
  assert.equal(kept.length, 0);
  assert.match(dropped[0].why, /open\/closed/);
});

test('стан не зрозумілий у запису з датами — не публікуємо', () => {
  const { kept } = keepOpen([row('a'), row('b')], {
    a: { state: 'unclear', status: 'active', kind: 'one_time', has_dates: true },
    b: { state: 'unreadable', status: 'active', kind: 'periodic', has_dates: true },
  });
  assert.equal(kept.length, 0);
});

test('вічна платформа без дат проходить, навіть коли стан не зрозумілий', () => {
  // Khan Academy, CS50, Scratch: сторінка часто не пускає робота, а
  // «завершитись» такому запису нема як — дат у ньому немає взагалі.
  const { kept } = keepOpen([row('a'), row('b')], {
    a: { state: 'unclear', status: 'active', kind: 'permanent', has_dates: false },
    b: { state: 'unreadable', status: 'active', kind: 'permanent', has_dates: false },
  });
  assert.deepEqual(kept.map((r) => r.id), ['a', 'b']);
});

test('вічний вид, але дати в записі є — перевірка обовʼязкова', () => {
  const { kept } = keepOpen([row('a')], {
    a: { state: 'unclear', status: 'active', kind: 'permanent', has_dates: true },
  });
  assert.equal(kept.length, 0);
});

test('сезон завершено — не рятує навіть вид «постійна»', () => {
  const { kept } = keepOpen([row('a')], {
    a: { state: 'ended', status: 'closed', kind: 'permanent', has_dates: false },
  });
  assert.equal(kept.length, 0);
});

test('мовчання не доказ: немає вердикту — не публікуємо', () => {
  const { kept, dropped } = keepOpen([row('a')], {});
  assert.equal(kept.length, 0);
  assert.equal(dropped[0].why, 'без вердикту');
});

test('перевірка не міняє порядок і лишає кілька', () => {
  const items = [row('a'), row('b'), row('c')];
  const { kept } = keepOpen(items, {
    a: { state: 'open', status: 'active' },
    b: { state: 'ended', status: 'closed' },
    c: { state: 'open', status: 'active' },
  });
  assert.deepEqual(kept.map((r) => r.id), ['a', 'c']);
});
