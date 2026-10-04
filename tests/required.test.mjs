import test from 'node:test';
import assert from 'node:assert/strict';
import { missingRequired, missingFieldKeys, needsDate, DATE } from '../lib/required.js';

// Що тримає запис перед публікацією. 11.09.2026 це були пʼять полів (дата,
// тип, вік, вартість, місце-або-формат); 03.10.2026 Марія лишила лише дату —
// і лише для програм із датами: «обовʼязкові поля включають тільки дату
// початку програми і дату дедлайна для деяких типів програм… якщо якогось не
// вистачає, то це не має затримувати чергу». Решта полів — підказка, що
// дозаповнити (missingFieldKeys). Ці тести стережуть саме межу «показуємо /
// не показуємо», а не формулювання. Визначення — lib/publish-criteria.json.

const full = (over = {}) => ({
  age_from: 6, age_to: 12, deadline: '2026-10-01', cost_type: 'free',
  opportunity_type: 'camp', format: 'offline', cities: ['Львів'],
  countries: ['ua'], is_international: false, ...over,
});

test('повний запис нічого не потребує', () => {
  assert.deepEqual(missingRequired(full()), []);
  assert.deepEqual(missingFieldKeys(full()), []);
});

test('тримає лише дата; решта полів — підказка', () => {
  assert.deepEqual(missingRequired(full({ deadline: null })), [DATE]);
  for (const [over, key] of [
    [{ age_to: null }, 'age'],
    [{ cost_type: null }, 'cost'],
    [{ opportunity_type: null }, 'type'],
    [{ format: null, cities: [], countries: [], is_international: false }, 'place'],
  ]) {
    assert.deepEqual(missingRequired(full(over)), [], key);
    assert.deepEqual(missingFieldKeys(full(over)), [key], key);
  }
});

// Дата ПРОВЕДЕННЯ відповідає на питання «коли» не гірше за дедлайн подачі:
// сесія «6–8 листопада» без оголошеного строку подачі — повноцінний запис.
// До 16.09.2026 такий запис ішов у чернетки, і саме тому перший день події
// писали в deadline, аби «закрити» вимогу.
test('дату закриває будь-яка дата', () => {
  const bare = { deadline: null, event_start_date: null, event_end_date: null, recurrence: null };
  assert.deepEqual(missingRequired(full(bare)), [DATE]);
  assert.deepEqual(missingRequired(full({ ...bare, deadline: '2026-09-17' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, event_start_date: '2026-11-06' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, event_end_date: '2026-11-08' })), []);
  // Дата розіграшу теж дає запису кінець (з 17.09.2026).
  assert.deepEqual(missingRequired(full({ ...bare, results_date: '2026-09-30' })), []);
});

test('«щороку» в recurrence — не дата (03.10.2026)', () => {
  const bare = { deadline: null, event_end_date: null };
  assert.deepEqual(missingRequired(full({ ...bare, recurrence: 'annual' })), [DATE]);
  assert.deepEqual(missingRequired(full({ ...bare, recurrence: 'ongoing' })), [DATE]);
});

test('кому дата потрібна: за видом у часі, а без виду — за типом', () => {
  assert.equal(needsDate({ opportunity_type: 'club', timing_kind: 'one_time' }), true);
  assert.equal(needsDate({ opportunity_type: 'competition', timing_kind: 'periodic' }), true);
  assert.equal(needsDate({ opportunity_type: 'competition', timing_kind: 'permanent' }), false);
  assert.equal(needsDate({ opportunity_type: 'workshop' }), true);
  assert.equal(needsDate({ opportunity_type: 'club' }), false);
  assert.equal(needsDate({ opportunity_type: 'course' }), false);
  assert.equal(needsDate({}), false);
});

test('сміттєве значення не рахується за заповнене поле', () => {
  // LLM віддавала cost_type "unknown" і тип поза словником — раніше такий
  // запис мовчки ставав null уже після перевірок.
  assert.deepEqual(missingFieldKeys(full({ cost_type: 'unknown' })), ['cost']);
  assert.deepEqual(missingFieldKeys(full({ opportunity_type: 'щось' })), ['type']);
});

test('порожній масив міст не вважається місцем', () => {
  // `cities` у базі має default '{}', а порожній масив у JS істинний —
  // саме на цьому перевірка «де» мовчки проходила б завжди.
  const row = full({ format: null, cities: [], countries: null, is_international: false });
  assert.deepEqual(missingFieldKeys(row), ['place']);
});

test('виплаті дата не обовʼязкова, програмам із датами — так', () => {
  // Рішення Марії 14.09.2026: строк подання виплат громад часто ніде не
  // вказаний.
  const bare = { deadline: null, event_end_date: null, recurrence: null };
  assert.deepEqual(missingRequired(full({ ...bare, opportunity_type: 'allowance' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, opportunity_type: 'support_payment' })), []);
  assert.deepEqual(missingRequired(full({ ...bare, opportunity_type: 'scholarship' })), [DATE]);
  assert.deepEqual(
    missingRequired(full({ ...bare, opportunity_type: 'allowance', age_to: null })), [],
  );
});

test('місце закриває будь-що з чотирьох', () => {
  const nowhere = { format: null, cities: [], countries: [], is_international: false };
  assert.deepEqual(missingFieldKeys(full({ ...nowhere, format: 'online' })), []);
  assert.deepEqual(missingFieldKeys(full({ ...nowhere, cities: ['Київ'] })), []);
  assert.deepEqual(missingFieldKeys(full({ ...nowhere, countries: ['pl'] })), []);
  assert.deepEqual(missingFieldKeys(full({ ...nowhere, is_international: true })), []);
});

test('порожній запис: дата не застосовна, решта — у підказці', () => {
  assert.deepEqual(missingRequired({}), []);
  assert.deepEqual(missingFieldKeys({}), ['age', 'cost', 'type', 'place']);
});
