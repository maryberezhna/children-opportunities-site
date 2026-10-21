// Англійські сторінки мають мовний сигнал lang="en" (Google: International and
// multilingual sites). Кореневий layout один на весь сайт і каже lang="uk", тож
// /en отримує мову через вкладений layout + клієнтський LangEn (21.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('кореневий layout — українська', () => {
  assert.match(read('app/layout.js'), /<html[^>]*lang="uk"/);
});

test('/en має вкладений layout, що ставить lang="en" і повертає його назад', () => {
  const layout = read('app/en/layout.js');
  assert.match(layout, /import LangEn from '\.\/LangEn'/);
  assert.match(layout, /<LangEn \/>/);
  const lang = read('app/en/LangEn.js');
  assert.match(lang, /^'use client';/);
  assert.match(lang, /el\.lang = 'en'/);
  assert.match(lang, /el\.lang = prev \|\| 'uk'/);
});
