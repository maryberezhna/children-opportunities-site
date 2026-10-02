// Одні ворота перед сайтом — і тест, що їх кличуть усі шляхи.
//
// 02.10.2026: на сайті висіли пʼять записів, де джерелом був чужий
// Telegram-канал (правило Марії 27.09.2026), і записи без жодної цитати
// («світлофор», 22.09.2026). Обидві перевірки були написані. Їх не кликали:
// з чотирьох шляхів публікації ворота стояли на двох, а бот дивився лише на
// поля. Тому тут перевіряється не лише правило, а й те, що код його питає.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GATE_SELECT, publishBlockers } from '../lib/publish-gate.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Повний запис: усі пʼять полів, цитати на кожне, джерело — сторінка.
const GOOD = {
  title: 'Курс робототехніки',
  opportunity_type: 'course',
  age_from: 10,
  age_to: 15,
  deadline: '2026-11-20',
  cost_type: 'free',
  format: 'online',
  source_url: 'https://example.org/kurs',
  evidence: {
    date: 'Реєстрація до 20 листопада', type: 'Курс робототехніки',
    age: 'для учнів 10–15 років', cost: 'участь безкоштовна', place: 'онлайн',
  },
};

test('повний запис проходить', () => {
  assert.equal(publishBlockers(GOOD), null);
});

test('запису без полів відмовляють першим — бракує поля', () => {
  const b = publishBlockers({ ...GOOD, cost_type: null });
  assert.equal(b.error, 'missing_required');
  assert.match(b.text, /вартість/i);
});

test('чуже Telegram-джерело не пускає', () => {
  const b = publishBlockers({ ...GOOD, source_url: 'https://t.me/tviyspace/11922' });
  assert.equal(b.error, 'bad_source');
  assert.match(b.text, /Telegram/);
});

test('наш власний канал джерелом не порушення', () => {
  // Хоча й не ідеал — але це не привід блокувати публікацію.
  assert.equal(publishBlockers({ ...GOOD, source_url: 'https://t.me/dityam_com_ua/512' }), null);
});

test('поле без цитати не пускає', () => {
  const { cost, ...rest } = GOOD.evidence;
  const b = publishBlockers({ ...GOOD, evidence: rest });
  assert.equal(b.error, 'missing_proof');
  assert.deepEqual(b.missing, ['вартість']);
});

test('цитат немає зовсім — теж відмова', () => {
  assert.equal(publishBlockers({ ...GOOD, evidence: null }).error, 'missing_proof');
});

test('порожній запис не валить ворота', () => {
  assert.equal(publishBlockers(null).error, 'not_found');
  assert.ok(publishBlockers({}).error);
});

// Ключі відповіді читають наявні клієнти: `missing` в /admin і редакторі,
// `problem` у редакторі (EditForm), `detail` у /admin. Якщо котрийсь зникне,
// модератор побачить «Помилка: undefined» замість причини.
test('у відмові є всі ключі, які читають клієнти', () => {
  for (const row of [{}, { ...GOOD, source_url: 'https://t.me/x/1' }, { ...GOOD, evidence: {} }]) {
    const b = publishBlockers(row);
    for (const k of ['error', 'missing', 'problem', 'detail', 'text']) {
      assert.ok(b[k] !== undefined, `немає ключа ${k}`);
    }
    assert.ok(b.text.length > 0);
  }
});

// --- Усі чотири шляхи публікації -----------------------------------------
//
// Доти правила були розкидані по цих файлах і розʼїхались. Кожен, хто ставить
// status='active', має спитати ворота — і вибрати поля, без яких вони сліпі.
const PATHS = [
  'app/api/admin/review/route.js',     // кнопка ✅ в /admin
  'app/api/admin/edit/route.js',       // «Зберегти й опублікувати» в редакторі
  'app/api/telegram/webhook/route.js', // ✅ в адмін-боті
  'scripts/publish-draft.mjs',         // воркфлоу publish-draft
];

test('усі шляхи публікації кличуть ворота', () => {
  for (const f of PATHS) {
    assert.match(read(f), /publishBlockers\(/, `${f}: ворота не викликані`);
  }
});

test('усі шляхи читають поля, без яких ворота сліпі', () => {
  for (const f of PATHS) {
    assert.match(read(f), /GATE_SELECT/, `${f}: select не з GATE_SELECT — перевірка була б сліпа`);
  }
});

test('ворота стоять перед записом у базу, а не після', () => {
  for (const f of PATHS) {
    const src = read(f);
    const gate = src.indexOf('publishBlockers(');
    const write = src.indexOf('.update(');
    assert.ok(gate !== -1, `${f}: ворота не викликані`);
    if (write === -1) continue;
    assert.ok(gate < write, `${f}: запис у базу стоїть раніше за перевірку`);
  }
});

test('GATE_SELECT містить і джерело, і цитати', () => {
  for (const f of ['source_url', 'evidence', 'timing_kind', 'cost_type', 'countries']) {
    assert.ok(GATE_SELECT.includes(f), `GATE_SELECT без ${f}`);
  }
});
