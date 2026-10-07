// Головна без важкого HTML (07.10.2026, «швидкість понад усе»): тексти карток
// поза першим екраном їдуть окремим файлом (lib/catalog-split.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightCatalog, keepIds, DETAIL_FIELDS, KEEP, detailsUrl } from '../lib/catalog-split.js';
import { isOnline } from '../lib/online.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const TODAY = '2026-10-07';

const row = (i, extra = {}) => ({
  id: `id-${i}`, slug: `slug-${i}`, title: `Гурток ${i}`, summary: 'Заняття для дітей щотижня в Києві.',
  source: 'Організатор', source_url: 'https://example.org', title_en: `Club ${i}`,
  opportunity_type: 'club', age_from: 6, age_to: 14, cost_type: 'free', cities: ['Київ'],
  timing_kind: 'permanent', created_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  ...extra,
});

const many = Array.from({ length: 300 }, (_, i) => row(i));

test('легкий запис — без текстів картки, але з усім для фільтрів', () => {
  const light = lightCatalog(many, { todayIso: TODAY });
  const stripped = light.filter((o) => !o.slug);
  assert.ok(stripped.length > 0, 'нічого не полегшено');
  for (const o of stripped) {
    for (const f of DETAIL_FIELDS) assert.equal(o[f], undefined, `${o.id}: лишилось ${f}`);
    for (const f of ['id', 'title', 'opportunity_type', 'age_from', 'age_to', 'cost_type', 'cities', 'created_at']) {
      assert.notEqual(o[f], undefined, `${o.id}: зникло ${f} — фільтри порахують інакше`);
    }
  }
});

test('повністю їдуть перші KEEP кожного режиму', () => {
  const ids = keepIds(many, TODAY);
  assert.ok(ids.size >= KEEP && ids.size < many.length);
});

// Кандидати «Топ 3» — записи з дедлайном у найближчі 30 днів; weekly-top
// рахує бал і за довжину опису, тож їхні описи мають доїхати.
test('усе з дедлайном у найближчі 31 день їде повністю', () => {
  const rows = [...many, row(900, { deadline: '2026-10-20', timing_kind: 'one_time' }), row(901, { deadline: '2026-11-07', timing_kind: 'one_time' })];
  const ids = keepIds(rows, TODAY, 0);
  assert.ok(ids.has('id-900'));
  assert.ok(ids.has('id-901'));
});

test('відмічені на тиждень і олімпіади МОН їдуть повністю', () => {
  const rows = [...many,
    row(910, { featured_week: '2026-W41' }),
    row(911, { title: 'Всеукраїнська олімпіада з фізики', opportunity_type: 'olympiad' })];
  const ids = keepIds(rows, TODAY, 0);
  assert.ok(ids.has('id-910'));
  assert.ok(ids.has('id-911'), 'група олімпіад показує чипи зі slug');
});

test('«онлайн» з опису переходить у позначку — чип «Онлайн» рахує так само', () => {
  const rows = [...many, row(920, { summary: 'Заняття проходять онлайн у Zoom.' })];
  const light = lightCatalog(rows, { todayIso: TODAY, keep: 0 });
  const byId = new Map(light.map((o) => [o.id, o]));
  for (const full of rows) {
    assert.equal(isOnline(byId.get(full.id)), isOnline(full), full.id);
  }
  assert.equal(byId.get('id-920').online_text, true);
});

test('головні сторінки везуть легкі записи й кажуть, звідки довантажити тексти', () => {
  assert.match(read('app/page.js'), /opportunities=\{lightCatalog\(clientRows\(opportunities\), \{ todayIso: today \}\)\}/);
  assert.match(read('app/page.js'), /detailsUrl=\{detailsUrl\('uk'\)\}/);
  assert.match(read('app/en/page.js'), /detailsUrl=\{detailsUrl\('en'\)\}/);
  assert.equal(detailsUrl('uk'), '/api/catalog/uk');
  assert.equal(detailsUrl('en'), '/api/catalog/en');
});

test('файл текстів — статичний з перебудовою, і помилка бази не кешується порожнечею', () => {
  const route = read('app/api/catalog/[lang]/route.js');
  assert.match(route, /export const revalidate = 300;/);
  assert.match(route, /rowsOrThrow\(/);
  assert.match(route, /publicOpportunities\(/);
});

test('список не рахує пошук без текстів і не каже «нічого не знайдено» до них', () => {
  const list = read('app/OpportunitiesList.js');
  assert.match(list, /const searchPending = queryTokens\(query\)\.length > 0 && !searchIndex;/);
  assert.match(list, /searchPending \? \(\s*<div className="v2-empty" aria-live="polite">/);
  assert.match(list, /className="card card-skel"/, 'картка без текстів має малюватись заглушкою');
});
