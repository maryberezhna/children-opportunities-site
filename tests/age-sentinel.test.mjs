// «0–18» — не факт, а сентинель: схема бази не дозволяє порожнього віку, і
// саме так конвеєр записує «вік невідомий» чи «без обмежень» (аудит
// 14.10.2026, приклад One Camp: «вік 7–17 — здогад без цитати, не записано»).
// Пігулка «0-18 років» інформації не несе, тож ніде не показується; фільтр
// за віком такі записи проходять повністю, як і раніше.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ageRangeLabel } from '../lib/labels.js';
import { opportunityTitle } from '../lib/opportunity-seo.js';

test('вік-сентинель 0–18 не має підпису', () => {
  assert.equal(ageRangeLabel({ age_from: 0, age_to: 18 }), '');
  assert.equal(ageRangeLabel({ age_from: 0, age_to: 17 }), '');
  assert.equal(ageRangeLabel({ age_from: 0, age_to: 18 }, 'en'), '');
});

test('справжні діапазони підписуються як і раніше', () => {
  assert.equal(ageRangeLabel({ age_from: 6, age_to: 12 }), '6-12 років');
  assert.equal(ageRangeLabel({ age_from: 0, age_to: 6 }), '0-6 років');
  assert.equal(ageRangeLabel({ age_from: 14, age_to: 14 }), '14 років');
  assert.equal(ageRangeLabel({ age_from: 6, age_to: 12 }, 'en'), '6–12 yrs');
  assert.equal(ageRangeLabel({ age_from: 18, age_to: 18 }), '18+');
});

test('заголовок без віку тримає тип, а не падає до голої назви', () => {
  const t = opportunityTitle({ name: 'One Camp', typeLabel: 'Табір', ageRange: '' });
  assert.equal(t, 'One Camp — Табір');
});
