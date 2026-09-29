import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatLabel, isEvent, itemFormatLabel, PAYMENT_TYPES } from '../lib/labels.js';

// Поле format у базі — enum (CHECK-констрейнт від 01.09.2026). Картка має
// розуміти всі три значення обома мовами, а на сміття відповідати null.
test('formatLabel розуміє enum', () => {
  assert.equal(formatLabel('online'), 'Онлайн');
  assert.equal(formatLabel('offline'), 'На місці');
  assert.equal(formatLabel('hybrid'), 'Онлайн і на місці');
  assert.equal(formatLabel('online', 'en'), 'Online');
  assert.equal(formatLabel('offline', 'en'), 'In person');
});

test('formatLabel мовчить на сміття і порожнє', () => {
  assert.equal(formatLabel(null), null);
  assert.equal(formatLabel(''), null);
  assert.equal(formatLabel('json'), null);
  // «заочна» містить «очн», але означає протилежне наживо — свідомий null.
  assert.equal(formatLabel('заочна форма'), null);
});

// Подію робить відома дата ПРОВЕДЕННЯ — байдуже, початок це чи кінець.
// Дедлайн подачі подією не робить: у сесії ЄМП у Мальме дедлайн 17 вересня,
// а сама вона 6–8 листопада, і плутанина цих двох дат і була причиною
// постів «📅 Коли: <день, коли закривається подача>».
test('isEvent дивиться на дати проведення, а не на дедлайн', () => {
  assert.equal(isEvent({ opportunity_type: 'camp' }), true);
  assert.equal(isEvent({ opportunity_type: 'exchange', event_start_date: '2026-11-06' }), true);
  assert.equal(isEvent({ opportunity_type: 'exchange', event_end_date: '2026-11-08' }), true);
  assert.equal(isEvent({ opportunity_type: 'exchange', deadline: '2026-09-17' }), false);
  assert.equal(isEvent({ opportunity_type: 'competition' }), false);
  assert.equal(isEvent(null), false);
});

// Виплатам формат не показуємо (Марія, 29.09.2026) — ні на картці, ні на
// сторінці можливості, ні в адмінці.
test('itemFormatLabel мовчить для виплат', () => {
  assert.equal(itemFormatLabel({ opportunity_type: 'allowance', format: 'online' }), null);
  assert.equal(itemFormatLabel({ opportunity_type: 'support_payment', format: 'offline' }), null);
  assert.equal(itemFormatLabel({ opportunity_type: 'camp', format: 'offline' }), 'На місці');
  assert.equal(itemFormatLabel({ opportunity_type: 'course', format: 'online' }, 'en'), 'Online');
});

// Той самий перелік виплат, що звільнений від дати в критеріях публікації:
// якщо зʼявиться третій тип виплати, він має з'явитись в обох місцях.
test('PAYMENT_TYPES збігається з виплатами в publish-criteria', () => {
  const crit = JSON.parse(readFileSync(new URL('../lib/publish-criteria.json', import.meta.url)));
  assert.deepEqual([...PAYMENT_TYPES].sort(), [...crit.required.date.except_types].sort());
});
