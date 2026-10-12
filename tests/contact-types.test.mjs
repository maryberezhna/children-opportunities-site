// Типи звернень у коді й у базі мають збігатися (12.10.2026).
//
// Привід: 'story' і 'olimpiada' додали в lib/contactTypes.js, а перевірку
// contact_messages_type_chk у базі — ні. Форма показувала «Не вдалося
// надіслати», бо база відмовляла, і цього ніхто не бачив. Тест бере
// останню міграцію, що задає цю перевірку, і звіряє список із кодом.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { CONTACT_TYPES, isValidContactType } = await import('../lib/contactTypes.js');
const dir = new URL('../supabase/migrations/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function typesInDb() {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let last = null;
  for (const f of files) {
    const sql = fs.readFileSync(new URL(f, dir), 'utf8');
    const m = sql.match(/contact_messages_type_chk check \(type in\s*\(([^)]*)\)/);
    if (m) last = m[1];
  }
  assert.ok(last, 'не знайшов міграції з contact_messages_type_chk');
  return [...last.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

test('кожен тип із форми дозволений перевіркою в базі', () => {
  assert.deepEqual(typesInDb(), CONTACT_TYPES.map((t) => t.value).sort());
});

test('амбасадор — окремий тип зі своєю міткою для адмінки', () => {
  assert.ok(isValidContactType('ambassador'));
  const t = CONTACT_TYPES.find((x) => x.value === 'ambassador');
  assert.equal(t.label, 'Стати амбасадором');
});

test('згоду на імʼя на сайті сервер зберігає й для амбасадора', () => {
  const route = read('app/api/contact/route.js');
  assert.match(route, /type === 'story' \|\| type === 'ambassador'/);
  assert.match(read('app/ambasadory/AmbassadorForm.js'), /type: 'ambassador'/);
});

test('сторінка амбасадорів є в карті сайту, футері й llms.txt', () => {
  assert.match(read('app/sitemap.js'), /\/ambasadory`/);
  assert.match(read('app/Footer.js'), /ambassadors: '\/ambasadory'/);
  assert.match(read('app/llms.txt/route.js'), /\/ambasadory\)/);
});

test('на сторінці немає «Dityam+ —»', () => {
  for (const f of ['app/ambasadory/page.js', 'app/ambasadory/AmbassadorForm.js', 'app/llms.txt/route.js']) {
    assert.doesNotMatch(read(f), /Dityam\+\s*[—–-]/, f);
  }
});
