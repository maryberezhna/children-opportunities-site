// Пошук у GA4 — один раз на дописаний запит (Марія, 28.10.2026: «а чому
// подія записується, коли людина перестає друкувати на 0,6 секунди»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('пошук не пишеться на паузі в друці, лише коли запит завершено', () => {
  const list = read('app/OpportunitiesList.js');
  assert.doesNotMatch(list, /trackSearch\(q, count\);\s*\}, 600\)/, 'повернулась подія після паузи 600 мс');
  for (const how of ["'submit'", "'blur'", "'open'", "'leave'"]) {
    assert.ok(list.includes(`commitSearch(${how})`), `немає тригера ${how}`);
  }
  assert.match(list, /searchFieldProps\(deskSuggest\)/);
  assert.match(list, /searchFieldProps\(mSuggest\)/);
  const track = read('lib/track.js');
  assert.match(track, /search_how: how \|\| undefined/);
  assert.match(track, /'search_open', withAbCard\(/);
});
