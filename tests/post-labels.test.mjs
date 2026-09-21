import test from 'node:test';
import assert from 'node:assert/strict';
import { costLabel, deadlineTag } from '../scripts/post-labels.mjs';

// 21.09.2026 у каналі вийшло «⏰ Заявки до: за 32 дн.» — «до» і «за N дн.»
// разом. Після «Заявки до:» завжди стоїть дата, а скільки лишилось — окремо.

test('дата подачі і скільки лишилось, з правильним відмінком', () => {
  assert.equal(deadlineTag('2026-10-23', 32), '<b>23 жовтня 2026</b> · ще 32 дні');
  assert.equal(deadlineTag('2026-10-12', 21), '<b>12 жовтня 2026</b> · ще 21 день');
  assert.equal(deadlineTag('2026-10-02', 11), '<b>2 жовтня 2026</b> · ще 11 днів');
  assert.equal(deadlineTag('2026-09-26', 5), '<b>26 вересня 2026</b> · ще 5 днів');
});

test('сьогодні й завтра — останній день, а не «за 0 дн.»', () => {
  assert.equal(deadlineTag('2026-09-21', 0), '<b>21 вересня 2026</b> · сьогодні останній день');
  assert.equal(deadlineTag('2026-09-22', 1), '<b>22 вересня 2026</b> · завтра останній день');
});

test('без лічильника — лише дата', () => {
  assert.equal(deadlineTag('2026-10-23', null), '<b>23 жовтня 2026</b>');
  assert.equal(deadlineTag('2026-09-01', -3), '<b>1 вересня 2026</b>');
  assert.equal(deadlineTag(null, 5), null);
});

test('вартість — лише «Безкоштовно» або «Платно»', () => {
  assert.equal(costLabel('free'), 'Безкоштовно');
  assert.equal(costLabel('paid_affordable'), 'Платно');
  assert.equal(costLabel('paid_premium'), 'Платно');
  // Проміжні не кажуть, чи платить родина, — рядка немає.
  assert.equal(costLabel('partially_free'), null);
  assert.equal(costLabel('subsidized'), null);
  assert.equal(costLabel(null), null);
});
