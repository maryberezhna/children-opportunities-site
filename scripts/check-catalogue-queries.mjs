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
// Скрипти бота теж рахують і публікують можливості, але під вартового не
// потрапляли: він дивився лише в app/. Через це 29.08 у канал пішли три
// чернетки з битими посиланнями, а щоденна метрика роками рахувала разом
// із дублями й не збігалася з сайтом.
const SCAN_DIRS = [join(ROOT, 'app'), join(ROOT, 'scripts')];

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
  // Ці скрипти працюють із повним набором свідомо:
  // verify-links перевіряє посилання й у дублів — вони теж мають бути живі;
  // populate-cities дозаповнює міста скрізь, бо дубль може стати оригіналом.
  'scripts/verify-links.mjs',
  'scripts/populate-cities.mjs',
  // Сам вартовий містить приклади заборонених рядків у коментарях.
  'scripts/check-catalogue-queries.mjs',
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
// Скрипти бота не можуть узяти publicOpportunities(): у них власний клієнт
// зі службовим ключем, а не браузерний. Тож правило для них інше — не «йди
// через спільний вхід», а «якщо фільтруєш за активністю, фільтруй і дублі».
// Саме ця пара й розходилась: без неї в канал ішли дублі, а метрика
// рахувала більше, ніж показує сайт.
const missingPair = [];

for (const file of SCAN_DIRS.flatMap((d) => walk(d))) {
  const rel = relative(ROOT, file);
  if (ALLOW.some((a) => rel.startsWith(a))) continue;
  const src = readFileSync(file, 'utf8');
  if (!src.includes("from('opportunities')")) continue;
  if (!src.includes("eq('status', 'active')")) continue;

  if (rel.startsWith('scripts/')) {
    if (!src.includes("is('canonical_slug', null)")) missingPair.push(rel);
    continue;
  }
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

if (missingPair.length) {
  console.error('\n✗ Скрипт фільтрує активні, але не відсіює дублі:\n');
  for (const f of missingPair) console.error(`   ${f}`);
  console.error(`
   Дубль віддає 301 на оригінал: у пості це зайве посилання, у лічильнику —
   зайва одиниця. Сайт показує рівно .eq('status','active') І
   .is('canonical_slug', null) — скрипт має рахувати так само.

   Додайте:  .is('canonical_slug', null)

   Якщо повний набір потрібен навмисно — додайте файл у ALLOW
   у scripts/check-catalogue-queries.mjs і напишіть чому.
`);
  process.exit(1);
}

console.log('✓ Публічні вибірки можливостей ідуть через publicOpportunities()');
console.log('✓ Скрипти, що фільтрують активні, відсіюють дублі');
