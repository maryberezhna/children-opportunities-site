// Одні ворота перед сайтом — і тест, що їх кличуть усі шляхи.
//
// 02.10.2026: на сайті висіли пʼять записів, де джерелом був чужий
// Telegram-канал (правило Марії 27.09.2026), і записи без жодної цитати
// («світлофор», 22.09.2026). Обидві перевірки були написані. Їх не кликали:
// з чотирьох шляхів публікації ворота стояли на двох, а бот дивився лише на
// поля. Тому тут перевіряється не лише правило, а й те, що код його питає.
//
// 03.10.2026 Марія скасувала пʼять обовʼязкових полів і цитати як ворота:
// тримає лише брак дати в програми з датами й чуже джерело.
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

test('«пропустити перевірку» знімає лише відмову через джерело', () => {
  const media = { ...GOOD, source_url: 'https://dtv.dn.ua/news/1', apply_url: null };
  assert.equal(publishBlockers(media)?.error, 'bad_source');
  assert.equal(publishBlockers(media, { ignoreSource: true }), null);
  const noDate = { ...GOOD, opportunity_type: 'camp', deadline: null, source_url: 'https://dtv.dn.ua/news/1' };
  assert.equal(publishBlockers(noDate, { ignoreSource: true })?.error, 'missing_required');
});

test('програмі з датами без дати відмовляють першим', () => {
  const b = publishBlockers({ ...GOOD, opportunity_type: 'camp', deadline: null });
  assert.equal(b.error, 'missing_required');
  assert.match(b.text, /дата/i);
});

test('порожні вартість, вік і місце більше не тримають', () => {
  assert.equal(publishBlockers({ ...GOOD, cost_type: null, age_from: null, age_to: null, format: null }), null);
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

test('брак цитати більше не тримає (03.10.2026)', () => {
  const { cost, ...rest } = GOOD.evidence;
  assert.equal(publishBlockers({ ...GOOD, evidence: rest }), null);
  assert.equal(publishBlockers({ ...GOOD, evidence: null }), null);
});

test('порожній запис не валить ворота', () => {
  assert.equal(publishBlockers(null).error, 'not_found');
  assert.doesNotThrow(() => publishBlockers({}));
  assert.ok(publishBlockers({ opportunity_type: 'camp' }).error);
});

// Ключі відповіді читають наявні клієнти: `missing` в /admin і редакторі,
// `problem` у редакторі (EditForm), `detail` у /admin. Якщо котрийсь зникне,
// модератор побачить «Помилка: undefined» замість причини.
test('у відмові є всі ключі, які читають клієнти', () => {
  for (const row of [{ opportunity_type: 'camp' }, { ...GOOD, source_url: 'https://t.me/x/1' }]) {
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

// Марія, 09.10.2026: «так» — кнопка не публікує запис, чия дата вже минула.
// Раніше він виходив на сайт і того ж вечора закривався lifecycle.
test('минула дата не пускає на сайт', async () => {
  const { publishBlockers } = await import('../lib/publish-gate.js');
  const base = { opportunity_type: 'competition', timing_kind: 'one_time', source_url: 'https://org.ua/' };
  const past = publishBlockers({ ...base, deadline: '2020-01-01' });
  assert.equal(past?.error, 'expired');
  assert.equal(publishBlockers({ ...base, deadline: '2099-01-01' }), null);
});
