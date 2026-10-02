import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch } from '../scripts/patch-opportunity.mjs';

// Точкова правка картки (22.09.2026, тур DEC Education).

const row = { summary: 'Освітня поїздка до Великої Британії', details: '## Важно про візу\nподачи документів' };

test('поле замінюється цілком', () => {
  assert.deepEqual(applyPatch(row, { summary: 'Поїздка від DEC Education' }), { summary: 'Поїздка від DEC Education' });
});

test('фрагменти виправляються на місці', () => {
  const out = applyPatch(row, { details: { replace: [['Важно', 'Важливо'], ['подачи', 'подачі']] } });
  assert.equal(out.details, '## Важливо про візу\nподачі документів');
});

test('фрагмента немає — правка не пишеться зовсім', () => {
  assert.throws(() => applyPatch(row, { details: { replace: [['немає такого', 'x']] } }), /немає фрагмента/);
});

// Джерело навмисно не редагується: цитати в evidence узяті саме з тієї
// сторінки, і підміна адреси зробила б їх брехнею, не торкнувшись жодного
// символу тексту. Запис із іншим джерелом треба перевіряти наново
// (підтверджено 01.10.2026, коли я спробувала це послабити).
test('статус і джерело тут не змінюються', () => {
  assert.throws(() => applyPatch(row, { status: 'active' }), /не змінюється/);
  assert.throws(() => applyPatch(row, { source_url: 'https://x' }), /не змінюється/);
});

// --- цитати, 01.10.2026 ---
//
// Публікація більше не проходить без цитат зі сторінки, тож має бути чим їх
// вписати. Доповнюємо по ключах: передали цитату на дату — цитата на вартість
// лишається. Інакше кожна правка затирала б усе, що вже перевірили.
test('evidence доповнюється, а не затирається', () => {
  const row = { evidence: { cost: 'Безкоштовно', type: 'Гурток' } };
  const out = applyPatch(row, { evidence: { date: 'до 8 жовтня' } });
  assert.deepEqual(out.evidence, { cost: 'Безкоштовно', type: 'Гурток', date: 'до 8 жовтня' });
});

test('evidence без обʼєкта не приймаємо', () => {
  assert.throws(() => applyPatch({}, { evidence: 'цитата' }), /обʼєктом/);
  assert.throws(() => applyPatch({}, { evidence: ['цитата'] }), /обʼєктом/);
});

test('запис без цитат лишається без них, поки їх не вписали', () => {
  const out = applyPatch({}, { evidence: { date: 'з 15 вересня до 8 жовтня' } });
  assert.deepEqual(out.evidence, { date: 'з 15 вересня до 8 жовтня' });
});

// --- формат, місце, вид за часом, 02.10.2026 ---
//
// Чернетка-заглушка з дослідження приходить без формату, міста й виду за
// часом, а publish-draft без них не публікує. Вписати їх не було чим:
// конектор бази в сесії відхилив запис, адмінки під рукою немає.
test('тип, формат, місто й вид за часом можна вписати', () => {
  const out = applyPatch({}, {
    opportunity_type: 'course', format: 'hybrid', cities: ['Дніпро'], countries: ['ua'],
    timing_kind: 'permanent', is_international: false,
  });
  assert.deepEqual(out, {
    opportunity_type: 'course', format: 'hybrid', cities: ['Дніпро'], countries: ['ua'],
    timing_kind: 'permanent', is_international: false,
  });
});

// Тип поза словником сайт показує як «курс», а невідомий формат — ніяк:
// помилка в одній літері стала б тихою брехнею на картці.
test('значення поза словником не пишуться', () => {
  assert.throws(() => applyPatch({}, { format: 'онлайн' }), /online, offline або hybrid/);
  assert.throws(() => applyPatch({}, { timing_kind: 'always' }), /permanent/);
  assert.throws(() => applyPatch({}, { opportunity_type: 'school' }), /словника/);
  assert.throws(() => applyPatch({}, { cities: 'Дніпро' }), /список/);
  assert.throws(() => applyPatch({}, { cities: [''] }), /список/);
  assert.throws(() => applyPatch({}, { is_international: 'ні' }), /true або false/);
});
