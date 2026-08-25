#!/usr/bin/env node
// Вартовий проти розходження лічильників.
//
// 25.08.2026 футер, layout, /en і /yak-my-pereviriaiemo показували 462
// можливості, а каталог і /press — 438: у чотирьох місцях забули
// .is('canonical_slug', null), тож дублі, які віддають 301, потрапляли
// в підрахунок. Полагодити руками мало — забудеться знову.
//
// Публічний каталог тепер має рівно один вхід: publicOpportunities() у
// lib/supabase.js. Цей скрипт падає, якщо хтось знову пише фільтри руками.
// Запускається на prebuild, тож зламаний запит не доїде до продакшену.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = join(ROOT, 'app');

// Одиночний запис за slug: там canonical_slug читається, щоб віддати 301,
// тож фільтр «без дублів» був би прямо шкідливий.
// Адмінка бачить повний набір навмисне — модератор працює і з дублями.
const ALLOW = [
  'app/admin/',
  'app/o/[slug]/page.js',
  'app/api/events/[slug]/ics/route.js',
  'app/events/[slug]/add/page.js',
  'app/api/telegram/webhook/route.js',
  'app/api/telegram/plus/route.js',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(SCAN)) {
  const rel = relative(ROOT, file);
  if (ALLOW.some((a) => rel.startsWith(a))) continue;
  const src = readFileSync(file, 'utf8');
  if (!src.includes("from('opportunities')")) continue;
  if (!src.includes("eq('status', 'active')")) continue;
  offenders.push(rel);
}

if (offenders.length) {
  console.error('\n✗ Публічна вибірка можливостей повз publicOpportunities():\n');
  for (const f of offenders) console.error(`   ${f}`);
  console.error(`
   Ці файли самі складають фільтри замість спільного входу — так і
   розʼїжджаються числа на сусідніх сторінках.

   Треба:  import { publicOpportunities } from '@/lib/supabase';
           const { data } = await publicOpportunities(FIELDS)...

   Для лічильника:  countActiveOpportunities()

   Якщо це навмисно одиночний запис за slug — додайте файл у ALLOW
   у scripts/check-catalogue-queries.mjs і напишіть чому.
`);
  process.exit(1);
}

console.log('✓ Публічні вибірки можливостей ідуть через publicOpportunities()');
