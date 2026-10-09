// Одна таблиця людей Dityam+ (/admin/plus, 08.10.2026): кожна людина — один
// рядок, найсвіжіші зверху, список очікування — рядками тієї ж таблиці.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { peopleRows } = await import('../lib/plusPeople.js');
const NOW = Date.parse('2026-10-08T12:00:00Z');

const subs = [
  { id: 1, status: 'pending', telegram_handle: '@old', telegram_chat_id: 11, created_at: '2026-09-29T10:00:00Z', source: 'plus_uk' },
  { id: 2, status: 'paused', telegram_handle: 'paid', telegram_chat_id: 22, consent_at: 'x', wfp_last_status: 'Declined', wfp_last_reason_code: 1124, updated_at: '2026-10-05T10:00:00Z' },
  { id: 3, status: 'pending', billing_period: 'gift', email: 'mama@example.com', source: 'olimpiada', created_at: '2026-10-06T10:00:00Z' },
  { id: 4, status: 'active', billing_period: 'monthly', telegram_handle: 'happy', telegram_chat_id: 44, created_at: '2026-10-07T10:00:00Z' },
];
const waitlist = [
  { id: 'a', telegram_username: '@happy', telegram_chat_id: 44, source: 'plus_bot:site', created_at: '2026-09-20T10:00:00Z' },
  { id: 'b', telegram_username: '@waiting', telegram_chat_id: 55, source: 'telegram_post', created_at: '2026-08-20T10:00:00Z' },
  { id: 'c', email: 'x@example.com', source: 'catalog_slot_0', created_at: '2026-08-15T10:00:00Z' },
];

test('Найсвіжіші зверху, кожна людина один раз', () => {
  const rows = peopleRows({ subs, waitlist, kidsBySub: { 4: 2 }, now: NOW });
  assert.deepEqual(rows.map((r) => r.who), ['@happy', '📧 mama@example.com', '@paid', '@old', '@waiting', '📧 x@example.com']);
});

test('Статус, що сталося, звідки', () => {
  const rows = Object.fromEntries(peopleRows({ subs, waitlist, kidsBySub: { 4: 2 }, now: NOW }).map((r) => [r.who, r]));
  assert.equal(rows['@happy'].what, 'оплачено · місяць · дітей 2');
  assert.match(rows['@happy'].from, /був у списку очікування/);
  assert.equal(rows['📧 mama@example.com'].status, 'gift');
  assert.equal(rows['📧 mama@example.com'].from, 'Олімпіада');
  assert.equal(rows['@old'].what, 'зупинився на першому повідомленні');
  assert.equal(rows['@waiting'].status, 'waitlist');
  assert.equal(rows['📧 x@example.com'].what, 'лише пошта — без Telegram, написати нема як');
});

test('Потребує уваги: пауза й застряглі понад добу, без подарунків', () => {
  const flagged = peopleRows({ subs, waitlist, now: NOW }).filter((r) => r.attention).map((r) => r.who);
  assert.deepEqual(flagged, ['@paid', '@old']);
});
