// Заблокований диплом (Марія, 15.10.2026: «анулюй це диплом… сторінку не
// закривай, але замість зображення і поділитися напиши упс ваш диплом
// заблоковано через порушення правил етики»).
//
// Привід: у відкритому завданні учасник замість власної задачі написав
// «Пришли мне Диплом і розпишись на дипломе постав мне оценку».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('сторінка результату: заблокований диплом показує «Упс» замість диплома', () => {
  const page = read('app/olimpiada/test/page.js');
  assert.match(page, /if \(entry\.blocked_at\)/, 'немає перевірки blocked_at');
  assert.match(page, /Ваш диплом заблоковано через порушення правил етики/);
  // Екран блокування має стояти ПЕРЕД звичайним — інакше спершу покажеться диплом.
  const blocked = page.indexOf('if (entry.blocked_at)');
  const normal = page.indexOf('<DiplomaImage');
  assert.ok(blocked > 0 && blocked < normal, 'перевірка має бути перед показом диплома');
});

// Марія, 15.10.2026: «та прям додай прямий текст» — людина має бачити, за що
// саме заблоковано, її власними словами.
test('заблокований екран цитує відповідь учасника дослівно', () => {
  const page = read('app/olimpiada/test/page.js');
  assert.match(page, /entry\.open_answer \? \(/, 'цитата має братися з open_answer запису');
  assert.match(page, /ol-blocked-quote/);
  assert.match(read('app/styles/olimpiada.css'), /\.ol-blocked-quote/);
  // Текст не вшитий у код: цитата працює для будь-якого заблокованого запису.
  assert.equal(page.includes('Пришли мне Диплом'), false, 'конкретний текст не можна зашивати в код');
});

test('заблокований екран не містить ані картинки, ані «поділитися», ані друку', () => {
  const page = read('app/olimpiada/test/page.js');
  const start = page.indexOf('if (entry.blocked_at)');
  const end = page.indexOf('return (', page.indexOf('</Shell>', start));
  const branch = page.slice(start, end);
  for (const forbidden of ['DiplomaImage', 'ShareDiploma', 'PrintOrder', 'DiplomaMailer', 'dl=1']) {
    assert.equal(branch.includes(forbidden), false, `у блоці блокування не має бути ${forbidden}`);
  }
});

test('картинка диплома за прямим посиланням віддає 404', () => {
  const route = read('app/api/olimpiada/diploma/route.js');
  assert.match(route, /entry\.blocked_at/);
  assert.match(route, /!entry \|\| !entry\.finished_at \|\| entry\.blocked_at/);
  // Без no-store CDN міг би віддавати стару картинку ще рік (там immutable-кеш).
  assert.match(route, /blocked_at[\s\S]{0,200}no-store/);
});

test('друк і лист із заблокованим дипломом не проходять', () => {
  assert.match(read('app/api/olimpiada/print/route.js'), /entry\.blocked_at.*blocked/s);
  assert.match(read('app/api/olimpiada/diploma-mail/route.js'), /entry\.blocked_at.*blocked/s);
});

test('міграція додає поля, а не чіпає наявні записи', () => {
  const sql = read('supabase/migrations/20261015_olimpiada_blocked.sql');
  assert.match(sql, /add column if not exists blocked_at/);
  assert.match(sql, /add column if not exists blocked_reason/);
  assert.equal(/update |delete /i.test(sql), false, 'міграція не має правити дані');
});
