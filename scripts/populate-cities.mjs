/**
 * Заповнює поле cities для всіх активних можливостей на основі format, opportunity_type, title, summary.
 * Запуск: node scripts/populate-cities.mjs
 * (з встановленими env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Потрібно задати NEXT_PUBLIC_SUPABASE_URL та SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ключові слова для визначення "Міжнародні"
const INTERNATIONAL_PATTERNS = [
  'за кордон', 'abroad', 'international', 'europe', 'european',
  'erasmus', 'rotary', 'afs ', 'euroscola', 'study fair',
  'у польщ', 'в польщ', 'у німеч', 'в берлін', 'у лондон',
  'в лондон', 'у франц', 'у канад', 'у сша', 'у великобри',
];

// Типи, що завжди є міжнародними
const INTERNATIONAL_TYPES = new Set(['exchange', 'study_abroad']);

// Конкретні українські міста (ключові слова в назві/описі)
const UA_CITIES = [
  { keyword: 'київ', city: 'Київ' },
  { keyword: 'харків', city: 'Харків' },
  { keyword: 'одес', city: 'Одеса' },
  { keyword: 'львів', city: 'Львів' },
  { keyword: 'дніпр', city: 'Дніпро' },
  { keyword: 'запоріж', city: 'Запоріжжя' },
  { keyword: 'вінниц', city: 'Вінниця' },
  { keyword: 'полтав', city: 'Полтава' },
  { keyword: 'черніг', city: 'Чернігів' },
  { keyword: 'суми', city: 'Суми' },
];

function deriveCities(opp) {
  const cities = new Set();
  const fmt = (opp.format || '').toLowerCase();
  const hay = `${opp.title || ''} ${opp.summary || ''}`.toLowerCase();

  // --- Онлайн ---
  if (
    fmt.includes('онлайн') ||
    fmt.includes('online') ||
    fmt.includes('гібрид') ||
    fmt.includes('дистанційн')
  ) {
    cities.add('Онлайн');
  }

  // --- Вся Україна ---
  if (
    fmt.includes('офлайн') ||
    fmt.includes('регіон') ||
    fmt.includes('школи-партнер') ||
    fmt.includes('україн') ||
    fmt.includes('ukraine')
  ) {
    cities.add('Вся Україна');
  }

  // --- Конкретні українські міста ---
  for (const { keyword, city } of UA_CITIES) {
    // Перевіряємо format або title (але не summary — там може бути просто згадка)
    const fmtHay = `${opp.format || ''} ${opp.title || ''}`.toLowerCase();
    if (fmtHay.includes(keyword)) {
      cities.add(city);
      // Якщо вказано конкретне місто — прибираємо "Вся Україна" (якщо вже додали)
      cities.delete('Вся Україна');
    }
  }

  // --- Міжнародні ---
  const isIntlType = INTERNATIONAL_TYPES.has(opp.opportunity_type);
  const hasIntlKeyword = INTERNATIONAL_PATTERNS.some((p) => hay.includes(p));
  if (isIntlType || hasIntlKeyword) {
    cities.add('Міжнародні');
    // Міжнародні обміни зазвичай не "Вся Україна" як місце проведення
    if (isIntlType) cities.delete('Вся Україна');
  }

  return [...cities];
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — зміни не зберігатимуться\n' : '🚀 Запускаємо оновлення cities...\n');

  const { data: opps, error } = await supabase
    .from('opportunities')
    .select('id, title, summary, format, opportunity_type, cities')
    .eq('status', 'active');

  if (error) {
    console.error('Помилка завантаження:', error);
    process.exit(1);
  }

  console.log(`Знайдено ${opps.length} активних записів\n`);

  const updates = [];
  const stats = {};

  for (const opp of opps) {
    const cities = deriveCities(opp);
    cities.forEach((c) => { stats[c] = (stats[c] || 0) + 1; });

    updates.push({ id: opp.id, cities });

    if (DRY_RUN) {
      const prev = JSON.stringify(opp.cities || []);
      const next = JSON.stringify(cities);
      if (prev !== next) {
        console.log(`  ${opp.title?.slice(0, 50)}`);
        console.log(`    ${prev} → ${next}`);
      }
    }
  }

  console.log('\nСтатистика по містах:');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
    console.log(`  ${c}: ${n}`);
  });

  const withoutCity = updates.filter((u) => u.cities.length === 0).length;
  if (withoutCity > 0) {
    console.log(`\n⚠️  ${withoutCity} записів без визначеного міста`);
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN завершено. Запустіть без DRY_RUN=true щоб зберегти.');
    return;
  }

  // Оновлюємо пачками по 50
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const { id, cities } of batch) {
      const { error: upErr } = await supabase
        .from('opportunities')
        .update({ cities })
        .eq('id', id);
      if (upErr) console.error(`  Помилка id=${id}:`, upErr.message);
      else updated++;
    }
    console.log(`  Оновлено ${Math.min(i + BATCH, updates.length)}/${updates.length}...`);
  }

  console.log(`\n✅ Готово! Оновлено ${updated}/${updates.length} записів.`);
}

main().catch(console.error);
