import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_FIELD, TRACKED_FIELDS,
  changedFields, correctionRows, groupCorrections, normalizeValue, pairValue,
} from '../lib/corrections.js';

// Телеметрія навчання (23.09.2026): ми не зберігали, ЩО саме виправила людина,
// тож конвеєр повторював ті самі помилки. Ці тести стережуть дві речі, на яких
// усе тримається: що ми рахуємо змінене поле чесно і що звіт показує
// закономірність, а не шум.

// ── Що саме змінила людина ────────────────────────────────────────────────

test('змінений тип і вартість дають по рядку на поле', () => {
  const changed = changedFields(
    { opportunity_type: 'course', cost_type: 'free', title: 'Табір «Джерело»' },
    { opportunity_type: 'camp', cost_type: 'paid_affordable', title: 'Табір «Джерело»' },
  );
  assert.deepEqual(changed, [
    { field: 'opportunity_type', before: 'course', after: 'camp' },
    { field: 'cost_type', before: 'free', after: 'paid_affordable' },
  ]);
});

test('порожнє → заповнене теж виправлення: модель не знайшла, людина знайшла', () => {
  const changed = changedFields({ deadline: null }, { deadline: '2026-10-01' });
  assert.deepEqual(changed, [{ field: 'deadline', before: null, after: '2026-10-01' }]);
});

test('заповнене → порожнє теж рахується: людина прибрала вигадане', () => {
  const changed = changedFields({ price_note: 'від 12 000 грн' }, { price_note: null });
  assert.deepEqual(changed, [{ field: 'price_note', before: 'від 12 000 грн', after: null }]);
});

test('порожній рядок і null — те саме, а не виправлення', () => {
  assert.deepEqual(changedFields({ summary: null }, { summary: '' }), []);
  assert.deepEqual(changedFields({ apply_url: '' }, { apply_url: null }), []);
});

test('пробіли по краях не роблять із збереження виправлення', () => {
  assert.deepEqual(changedFields({ title: 'Табір' }, { title: '  Табір  ' }), []);
});

test('0 — це вік, а не порожнє', () => {
  assert.deepEqual(changedFields({ age_from: 7 }, { age_from: 0 }),
    [{ field: 'age_from', before: 7, after: 0 }]);
  assert.deepEqual(changedFields({ age_from: 0 }, { age_from: 0 }), []);
});

test('міста порівнюються як список, а не як рядок', () => {
  assert.deepEqual(changedFields({ cities: ['Львів'] }, { cities: ['Львів', 'Київ'] }),
    [{ field: 'cities', before: ['Львів'], after: ['Львів', 'Київ'] }]);
  assert.deepEqual(changedFields({ cities: ['Львів'] }, { cities: [' Львів '] }), []);
  // Порожній список — та сама порожнеча, що й null.
  assert.deepEqual(changedFields({ cities: null }, { cities: [] }), []);
});

test('поля, якого немає в патчі, ми не чіпаємо', () => {
  // Вік із чернетки-заглушки форма не шле зовсім. Відсутність ≠ «людина стерла».
  const changed = changedFields({ age_from: 7, age_to: 14, title: 'Курс' }, { title: 'Курс ІТ' });
  assert.deepEqual(changed, [{ field: 'title', before: 'Курс', after: 'Курс ІТ' }]);
});

test('службові поля патча в телеметрію не потрапляють', () => {
  const patch = { updated_at: '2026-09-23T10:00:00Z', status: 'active', verified_at: 'x', format: 'online' };
  const changed = changedFields({ format: null, status: 'draft' }, patch);
  assert.deepEqual(changed.map((c) => c.field), ['format']);
});

test('запис без попереднього стану не падає', () => {
  assert.deepEqual(changedFields(null, { format: 'online' }),
    [{ field: 'format', before: null, after: 'online' }]);
  assert.deepEqual(changedFields({ format: 'online' }, null), []);
});

test('перелік полів — рівно те, що може змінити форма', () => {
  for (const f of ['title', 'summary', 'deadline', 'event_start_date', 'event_end_date',
    'results_date', 'age_from', 'age_to', 'opportunity_type', 'cost_type', 'format',
    'recurrence', 'cities', 'price_note', 'apply_url', 'details']) {
    assert.ok(TRACKED_FIELDS.includes(f), `${f} має бути у TRACKED_FIELDS`);
  }
  assert.ok(!TRACKED_FIELDS.includes('status'), 'status — не виправлення людини');
});

test('correctionRows дає готові рядки для бази', () => {
  const rows = correctionRows('opp-1', { format: null }, { format: 'offline' }, 'edit');
  assert.deepEqual(rows, [{
    opportunity_id: 'opp-1', field: 'format', before: null, after: 'offline', source: 'edit',
  }]);
});

test('нічого не змінилось — нічого й не пишемо', () => {
  assert.deepEqual(correctionRows('opp-1', { title: 'Курс' }, { title: 'Курс' }), []);
});

test('normalizeValue не плутає false з порожнім', () => {
  assert.equal(normalizeValue(false), false);
  assert.equal(normalizeValue(undefined), null);
  assert.equal(normalizeValue('   '), null);
});

// ── Групування для звіту ──────────────────────────────────────────────────

const row = (field, before, after, extra = {}) => ({
  field, before, after, opportunity_id: extra.id || 'x', ...extra,
});

test('найчастіше виправлюване поле стоїть першим', () => {
  const groups = groupCorrections([
    row('opportunity_type', 'course', 'camp'),
    row('opportunity_type', 'course', 'camp'),
    row('opportunity_type', 'course', 'club'),
    row('cost_type', 'free', 'paid_affordable'),
  ]);
  assert.deepEqual(groups.map((g) => [g.field, g.count]),
    [['opportunity_type', 3], ['cost_type', 1]]);
});

test('пара рахується лише якщо повторилась: один раз — випадок', () => {
  const groups = groupCorrections([
    ...Array.from({ length: 14 }, () => row('opportunity_type', 'course', 'camp')),
    ...Array.from({ length: 3 }, () => row('opportunity_type', 'course', 'club')),
    row('opportunity_type', 'workshop', 'festival'),
  ]);
  assert.deepEqual(groups[0].pairs, [
    { before: 'course', after: 'camp', count: 14 },
    { before: 'course', after: 'club', count: 3 },
  ]);
});

test('вільний текст закономірності не дає — лишається сама кількість', () => {
  const groups = groupCorrections([
    row('summary', 'Опис один', 'Переписаний один'),
    row('summary', 'Опис два', 'Переписаний два'),
  ]);
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].pairs, []);
});

test('прикладів рівно три, з назвою й слагом для посилання', () => {
  const groups = groupCorrections(Array.from({ length: 9 }, (_, i) => row(
    'cost_type', 'free', 'paid_affordable',
    { id: `opp-${i}`, opportunities: { title: `Табір ${i}`, slug: `tabir-${i}` } },
  )));
  assert.equal(groups[0].examples.length, 3);
  assert.deepEqual(groups[0].examples[0], {
    id: 'opp-0', title: 'Табір 0', slug: 'tabir-0', before: 'free', after: 'paid_affordable',
  });
});

test('рішення в черзі групується за дією, а не за коментарем', () => {
  // Інакше кожна причина робила б пару унікальною, і «на сайті → прибрати ×3»
  // не склалось би жодного разу.
  const groups = groupCorrections([
    row(DECISION_FIELD, 'active', { action: 'remove', comment: 'набір закрито' }),
    row(DECISION_FIELD, 'active', { action: 'remove', comment: 'сторінка зникла' }),
    row(DECISION_FIELD, 'active', { action: 'remove' }),
    row(DECISION_FIELD, 'draft', { action: 'skip', comment: 'для дорослих' }),
  ]);
  assert.equal(groups[0].field, DECISION_FIELD);
  assert.deepEqual(groups[0].pairs, [{ before: 'active', after: 'remove', count: 3 }]);
  // Причина лишається в прикладі — без неї «прибрано» не пояснює нічого.
  assert.equal(groups[0].examples[0].after.comment, 'набір закрито');
});

test('pairValue бере дію з рішення і не чіпає звичайні значення', () => {
  assert.equal(pairValue({ action: 'skip', comment: 'не те' }), 'skip');
  assert.equal(pairValue('course'), 'course');
  assert.deepEqual(pairValue(['Львів']), ['Львів']);
  assert.equal(pairValue(null), null);
});

test('порожній тиждень — порожній звіт, без вигаданих груп', () => {
  assert.deepEqual(groupCorrections([]), []);
  assert.deepEqual(groupCorrections(null), []);
});

test('однакова кількість — порядок сталий між запусками', () => {
  const rows = [row('format', 'online', 'offline'), row('cost_type', 'free', null)];
  assert.deepEqual(groupCorrections(rows).map((g) => g.field),
    groupCorrections([...rows].reverse()).map((g) => g.field));
});
