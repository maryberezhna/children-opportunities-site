import test from 'node:test';
import assert from 'node:assert/strict';
import { isLive, isForTeens, audienceStats } from '../lib/audience.js';

// Хіро головної рахувало можливості як «усі рядки», а каталог під ним — без
// прострочених і, у підлітковому режимі, без того, що закінчується раніше
// 13 років. Підлітку обіцяли 1115, показували 1006 (10.09.2026).

const TODAY = '2026-09-10';

const item = (over = {}) => ({
  opportunity_type: 'course', deadline: null, age_to: 18,
  cost_type: 'free', source: 'a', ...over,
});

test('прострочена разова можливість не рахується', () => {
  assert.equal(isLive(item({ deadline: '2026-09-09' }), TODAY), false);
  assert.equal(isLive(item({ deadline: '2026-09-10' }), TODAY), true);
  assert.equal(isLive(item({ deadline: null }), TODAY), true);
});

test('щорічна можливість не гасне після дедлайну', () => {
  const olympiad = item({ opportunity_type: 'olympiad', deadline: '2026-01-01' });
  assert.equal(isLive(olympiad, TODAY), true);
});

test('підліткам — усе, що доступне у 13+', () => {
  assert.equal(isForTeens(item({ age_to: 12 })), false);
  assert.equal(isForTeens(item({ age_to: 13 })), true);
  // Запис без верхньої межі віку підлітку не показуємо — так каталог
  // поводився з першого дня режиму, і хіро тепер рахує так само.
  assert.equal(isForTeens(item({ age_to: null })), false);
});

test('цифри хіро рахуються тим самим предикатом, що й каталог', () => {
  const items = [
    item({ age_to: 10, source: 'a' }),                       // лише батькам
    item({ age_to: 18, source: 'b' }),                       // обом
    item({ age_to: 18, source: 'b', cost_type: 'paid' }),    // обом, платна
    item({ age_to: 18, source: 'c', deadline: '2026-09-01' }), // прострочена
  ];

  assert.deepEqual(audienceStats(items, TODAY), { total: 3, freeCount: 2, sourceCount: 2 });
  assert.deepEqual(audienceStats(items, TODAY, true), { total: 2, freeCount: 1, sourceCount: 1 });
});
