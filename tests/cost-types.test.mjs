// Значення вартості мусять бути однакові в коді й у базі.
//
// 02.10.2026: cost_type = 'ask_school' («вартість уточнюйте в школі», рішення
// Марії 28.09) не проходив у базу з дня ухвалення. Міграція знімала обмеження
// з назвою opportunities_cost_type_enum, а записи відкидало те, що насправді
// зветься opportunities_cost_type_check: «drop constraint if exists» на чужу
// назву тихо не зробив нічого, і поряд народилось друге, дозвільне — а
// найсуворіше з двох перемогло.
//
// Побачити це можна було лише з повного прогону: за один нічний скрап 24
// upserti впали, і всі 24 — суботні школи діаспори, тобто пріоритетний напрям.
// Тест читає SQL і код: від розбіжності в переліку й почалось.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Остання міграція, що описує обмеження на cost_type, — вона й діє.
function activeCostMigration() {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const hit = files.filter((f) => /cost_type/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.ok(hit.length, 'немає жодної міграції про cost_type');
  return { name: hit[hit.length - 1], sql: readFileSync(new URL(hit[hit.length - 1], dir), 'utf8') };
}

const valuesIn = (sql) => {
  const m = sql.match(/cost_type in\s*\(([^)]*)\)/i);
  assert.ok(m, 'у міграції немає переліку значень');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
};

const codeValues = () => {
  const m = read('app/api/admin/edit/route.js').match(/const COST = \[([^\]]*)\]/);
  assert.ok(m, 'не знайшла COST у app/api/admin/edit/route.js');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
};

test('перелік вартостей у міграції збігається з кодом', () => {
  assert.deepEqual(valuesIn(activeCostMigration().sql), codeValues());
});

test('ask_school дозволений і в базі, і в коді', () => {
  assert.ok(valuesIn(activeCostMigration().sql).includes('ask_school'),
    'міграція не дозволяє ask_school — школи діаспори знову не збережуться');
  assert.ok(codeValues().includes('ask_school'));
});

// Саме звідси й виросла помилка: міграція чистила не ту назву.
test('міграція знімає обмеження під УСІМА іменами, що існували', () => {
  const { sql } = activeCostMigration();
  for (const name of ['opportunities_cost_type_check', 'opportunities_cost_type_enum']) {
    assert.match(sql, new RegExp(`drop constraint if exists ${name}`, 'i'),
      `не знято ${name} — лишиться два обмеження, і суворіше переможе`);
  }
});

test('значення з критеріїв публікації теж дозволені базою', () => {
  const criteria = JSON.parse(read('lib/publish-criteria.json'));
  const allowed = valuesIn(activeCostMigration().sql);
  for (const v of criteria.required.cost.allowed || []) {
    assert.ok(allowed.includes(v), `критерії вимагають «${v}», база не дозволяє`);
  }
  assert.ok(allowed.includes(criteria.required.cost.ask_school.value));
});
