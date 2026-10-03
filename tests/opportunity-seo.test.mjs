import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { opportunityTitle, structuredType, audienceOf, TITLE_MAX } from '../lib/opportunity-seo.js';

// Аудит Semrush 02.10.2026: 72 зі 100 сторінок мали задовгий заголовок.
// Медіана була 100 символів, бо до назви дописувались тип, вік і назва сайту.

test('короткий заголовок лишається повним: назва, тип і вік', () => {
  const t = opportunityTitle({ name: 'Гурток шахів', typeLabel: 'Гурток', ageRange: '6-12 років' });
  assert.equal(t, 'Гурток шахів — Гурток для дітей 6-12 років');
});

test('середній заголовок скорочує лише наш дописок', () => {
  const name = 'Школа Мапсі — онлайн-уроки англійської';
  const t = opportunityTitle({ name, typeLabel: 'Курс', ageRange: '6-17 років' });
  assert.equal(t, `${name} — Курс, 6-17 років`);
  assert.ok(t.length <= TITLE_MAX);
});

// Назва програми — власна назва: її не обрізаємо, навіть коли вона довша за
// межу. Обрізаний заголовок із трьома крапками зробить сам Google.
test('довга назва лишається цілою і без дописків', () => {
  const name = 'Всеукраїнський конкурс-захист науково-дослідницьких робіт учнів-членів МАН (секція біологічних наук)';
  assert.equal(opportunityTitle({ name, typeLabel: 'Конкурс', ageRange: '13-18 років' }), name);
});

test('англійський заголовок скорочується так само', () => {
  assert.equal(
    opportunityTitle({ name: 'Chess club', typeLabel: 'Club', ageRange: '6–12 yrs', lang: 'en' }),
    'Chess club — Club for children 6–12 yrs',
  );
});

// 50 сторінок із 50 перевірених віддавали Course без розкладу занять, якого
// Google вимагає. Тривалості занять у базі немає, а вигадувати її не можна.
test('курс і гурток — Service, а не Course', () => {
  assert.equal(structuredType({ opportunity_type: 'course' }), 'Service');
  assert.equal(structuredType({ opportunity_type: 'club' }), 'Service');
});

// Олімпіада, обмін, стипендія й стажування раніше теж ішли як Course.
test('олімпіада з датою — подія, стипендія й обмін — просто сторінка', () => {
  assert.equal(structuredType({ opportunity_type: 'olympiad', event_start_date: '2026-11-01' }), 'Event');
  assert.equal(structuredType({ opportunity_type: 'olympiad' }), 'WebPage');
  assert.equal(structuredType({ opportunity_type: 'scholarship' }), 'WebPage');
  assert.equal(structuredType({ opportunity_type: 'exchange', event_start_date: '2026-11-01' }), 'WebPage');
});

// Event без дати проведення Google відхиляє; дедлайн датою події не є.
test('подія без дати проведення не стає Event', () => {
  assert.equal(structuredType({ opportunity_type: 'camp', deadline: '2026-11-01' }), 'WebPage');
  assert.equal(structuredType({ opportunity_type: 'camp', event_start_date: '2026-11-01' }), 'Event');
});

test('вік іде в розмітку лише коли відомі обидві межі', () => {
  assert.deepEqual(audienceOf({ age_from: 6, age_to: 12 }),
    { '@type': 'PeopleAudience', suggestedMinAge: 6, suggestedMaxAge: 12 });
  assert.equal(audienceOf({ age_from: 6, age_to: null }), null);
  assert.equal(audienceOf({}), null);
});

// Сторож: сторінка можливості не повертається до Course і бере заголовок без
// шаблону сайту. Файл тягне стилі, тож читаємо його текстом.
test('сторінка можливості не віддає Course і ставить абсолютний заголовок', () => {
  const src = readFileSync(new URL('../app/o/shared.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /'@type': 'Course'/);
  assert.match(src, /title: \{ absolute: title \}/);
  assert.match(src, /structuredType\(item\)/);
});

// Для офлайн-події Google вимагає location.address; Country його не має.
test('етапи олімпіад мають місце з адресою, а не Country', () => {
  const src = readFileSync(new URL('../app/olimpiady/page.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /location: \{ '@type': 'Country'/);
  assert.match(src, /addressCountry: 'UA'/);
});

test('www веде на основну адресу', () => {
  const src = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');
  assert.match(src, /value: 'www\.dityam\.com\.ua'/);
  assert.match(src, /destination: 'https:\/\/dityam\.com\.ua\/:path\*'/);
});

// --- «18+», 03.10.2026 ---
//
// База не пускає вік понад 18, тож студентська програма записана як «від 18
// до 18», і картка читалась «18 років» — ніби лише для тих, кому рівно 18.
test('вік 18–18 показується як «18+» обома мовами й у заголовку', async () => {
  const { ageLabel, ageRangeLabel } = await import('../lib/labels.js');
  assert.equal(ageLabel(18, 18), '18+');
  assert.equal(ageRangeLabel({ age_from: 18, age_to: 18 }), '18+');
  assert.equal(ageRangeLabel({ age_from: 18, age_to: 18 }, 'en'), '18+');
  // Решта підписів не змінюється.
  assert.equal(ageLabel(7, 11), '7-11 років');
  assert.equal(ageLabel(0, 18), '0-18 років');
  assert.equal(ageLabel(12, 12), '12 років');
  assert.equal(opportunityTitle({ name: 'Інженерна програма', typeLabel: 'Курс', ageRange: '18+' }), 'Інженерна програма — Курс для дітей 18+');
});
