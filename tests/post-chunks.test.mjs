// «⏰ Дедлайни цього тижня» — усі записи, кількома повідомленнями (26.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chunkPost } from '../scripts/post-chunks.mjs';

const vis = (ls) => ls.join('\n').replace(/<[^>]+>/g, '').length;
const row = (i) => `📌 <b>Можливість ${i}</b> — ${'опис '.repeat(80)}`;
const footer = ['👉 Усі дедлайни — на dityam.com.ua', '', 'Dityam+'];

test('усі рядки потрапляють у пост, жоден не губиться', () => {
  const rows = Array.from({ length: 15 }, (_, i) => row(i));
  const msgs = chunkPost([{ heading: 'H', contHeading: 'H (продовження)', rows }], footer, 3900);
  const all = msgs.flat();
  for (const r of rows) assert.ok(all.includes(r));
  assert.ok(msgs.length > 1);
  for (const m of msgs) assert.ok(vis(m) <= 3900, `повідомлення ${vis(m)} знаків`);
});

test('перше повідомлення з заголовком, наступні — «(продовження)», футер лише в останньому', () => {
  const rows = Array.from({ length: 15 }, (_, i) => row(i));
  const msgs = chunkPost([{ heading: 'H', contHeading: 'H (продовження)', rows }], footer, 3900);
  assert.equal(msgs[0][0], 'H');
  for (const m of msgs.slice(1)) assert.equal(m[0], 'H (продовження)');
  assert.equal(msgs.at(-1).at(-1), 'Dityam+');
  for (const m of msgs.slice(0, -1)) assert.ok(!m.includes('Dityam+'));
});

test('короткий пост — одне повідомлення з обома розділами', () => {
  const msgs = chunkPost([
    { heading: 'D', contHeading: 'D+', rows: ['a', 'b'] },
    { heading: 'S', contHeading: 'S+', rows: ['c'] },
  ], footer);
  assert.equal(msgs.length, 1);
  assert.deepEqual(msgs[0].slice(0, 7), ['D', '', 'a', '', 'b', '', 'S']);
});

test('порожньо — нічого не шлемо', () => {
  assert.deepEqual(chunkPost([{ heading: 'D', contHeading: 'D+', rows: [] }], footer), []);
});

test('скрипт каналу більше не обрізає дедлайни тижня до 6', () => {
  const src = readFileSync('scripts/check-deadlines.mjs', 'utf8');
  assert.ok(!/WEEK_MAX/.test(src));
  assert.match(src, /pickChecked\(week, week\.length/);
});
