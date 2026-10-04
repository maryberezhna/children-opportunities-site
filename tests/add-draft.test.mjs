// «Додати знахідку в чернетки» (Марія, 04.10.2026: «крута можливість, шукай і
// додавай»). Шляху в базу для таких знахідок не було зовсім: і форма
// пропозицій, і нічний скрап ведуть через модель, а кошти на API скінчились.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIELDS, buildRecord, slugify } from '../scripts/add-draft.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ok = { title: 'Конкурс', source_url: 'https://example.org/konkurs' };

test('запис завжди лягає чернеткою', () => {
  // Головне правило: скрипт уміє лише «додати в чергу», а не «показати людям».
  assert.equal(buildRecord(ok).status, 'draft');
});

test('статус ззовні не задається', () => {
  assert.throws(() => buildRecord({ ...ok, status: 'active' }), /не задаються/);
  assert.ok(!FIELDS.has('status'));
  assert.ok(!FIELDS.has('verified_at'), 'позначку перевірки ставить людина');
});

test('без назви чи джерела не створюємо', () => {
  assert.throws(() => buildRecord({ source_url: 'https://x.ua' }), /без назви/);
  assert.throws(() => buildRecord({ title: 'Щось' }), /без джерела/);
});

test('slug — латиниця, без хвостів і в межах довжини', () => {
  const s = slugify('Green Rising Ukraine 2026 — молодіжна кліматична конференція', 'ab12cd');
  assert.match(s, /^[a-z0-9-]+$/, 'у slug лишились не-латинські символи');
  assert.ok(!s.includes('--') && !s.endsWith('-'));
  assert.ok(s.endsWith('-ab12cd'), 'без хвоста два записи з однаковою назвою зіткнулись би');
  assert.ok(slugify('а'.repeat(300), 'x').length <= 90);
});

test('апостроф і мʼякий знак не лишають дірок', () => {
  assert.equal(slugify("Об'єднання дітей"), 'obiednannia-ditei');
});

test('канонічна адреса рахується з джерела', () => {
  // За нею upsert і дедуплікація впізнають «та сама сторінка».
  assert.equal(buildRecord(ok).canonical_url, 'https://example.org/konkurs');
});

test('скрипт не публікує сам, а лише каже, що скажуть ворота', () => {
  const src = read('scripts/add-draft.mjs');
  assert.match(src, /publishBlockers\(/, 'має показувати, чого бракує для публікації');
  assert.doesNotMatch(src, /status: 'active'/, 'скрипт не має права публікувати');
  assert.match(src, /CONFIRM !== 'ADD'/, 'без підтвердження — лише сухий прогін');
  assert.match(src, /canonical_url/, 'дубль має перевірятись');
});

test('воркфлоу не записує без підтвердження', () => {
  const yml = read('.github/workflows/add-draft.yml');
  assert.match(yml, /CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/);
  assert.match(yml, /default: ''/, 'типово — сухий прогін');
});
