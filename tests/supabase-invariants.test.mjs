import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../lib/supabase.js';

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
