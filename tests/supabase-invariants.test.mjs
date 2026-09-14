import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows, rowsOrThrow } from '../lib/supabase.js';

// Регресійний тест на інцидент 01.09.2026: мерж #158 затер fetchAllRows —
// прод пів дня не збирався. Якщо цей тест червоний, хтось знову закомітив
// стару копію lib/supabase.js.
test('fetchAllRows існує і є функцією', () => {
  assert.equal(typeof fetchAllRows, 'function');
});

test('fetchAllRows гортає сторінки і склеює всі рядки', async () => {
  // 1000 — це серверний ліміт PostgREST: перша «сторінка» повна, друга ні.
  const pages = [
    Array.from({ length: 1000 }, (_, i) => ({ id: i })),
    Array.from({ length: 300 }, (_, i) => ({ id: 1000 + i })),
  ];
  let call = 0;
  const buildQuery = () => ({
    range: () => Promise.resolve({ data: pages[call++] ?? [], error: null }),
  });
  const { data, error } = await fetchAllRows(buildQuery);
  assert.equal(error, null);
  assert.equal(data.length, 1300);
  assert.equal(data[1299].id, 1299);
});

test('fetchAllRows пробрасывает помилку, не ковтає', async () => {
  const boom = { message: 'boom' };
  const { data, error } = await fetchAllRows(() => ({
    range: () => Promise.resolve({ data: null, error: boom }),
  }));
  assert.equal(data, null);
  assert.equal(error, boom);
});

// Інцидент 14.09.2026: шлюз Supabase кілька хвилин відповідав 502/504, і
// головна закешувалась із «0 можливостей».
const reply = (status, data) => (status >= 400
  ? { data: null, error: { message: `HTTP ${status}` }, status }
  : { data, error: null, status });

test('fetchAllRows перепитує тимчасовий 502 і віддає дані', async () => {
  let call = 0;
  const { data, error } = await fetchAllRows(() => ({
    range: () => Promise.resolve(call++ === 0 ? reply(502) : reply(200, [{ id: 1 }])),
  }), { delayMs: 0 });
  assert.equal(error, null);
  assert.equal(data.length, 1);
  assert.equal(call, 2);
});

test('fetchAllRows після вичерпаних спроб віддає помилку', async () => {
  let call = 0;
  const { data, error } = await fetchAllRows(() => ({
    range: () => { call += 1; return Promise.resolve(reply(504)); },
  }), { delayMs: 0, attempts: 3 });
  assert.equal(data, null);
  assert.equal(error.message, 'HTTP 504');
  assert.equal(call, 3);
});

test('fetchAllRows не повторює 4xx — кривий запит повтор не виправить', async () => {
  let call = 0;
  const { error } = await fetchAllRows(() => ({
    range: () => { call += 1; return Promise.resolve(reply(400)); },
  }), { delayMs: 0 });
  assert.equal(error.message, 'HTTP 400');
  assert.equal(call, 1);
});

test('rowsOrThrow кидає помилку замість порожнього каталогу', () => {
  assert.throws(() => rowsOrThrow({ data: null, error: { message: 'HTTP 502' } }, 'home'), /home.*HTTP 502/);
  assert.deepEqual(rowsOrThrow({ data: [{ id: 1 }], error: null }, 'home'), [{ id: 1 }]);
});
