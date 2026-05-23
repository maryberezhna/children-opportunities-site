/**
 * Заповнює поле cities для всіх активних можливостей.
 * Запуск: node scripts/populate-cities.mjs
 * (env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY або через .env.local)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

// Підтягуємо .env.local якщо є
function loadEnvLocal() {
  const path = new URL('../.env.local', import.meta.url).pathname;
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const m of content.matchAll(/^([A-Z_][A-Z0-9_]*)="([^"]*)"/gm)) {
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Потрібно: NEXT_PUBLIC_SUPABASE_URL та SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Конфіг ---

const INTERNATIONAL_TYPES = new Set(['exchange', 'study_abroad']);

// Іноземні локації у format полі
const INTL_FORMAT_KEYWORDS = [
  'сша', 'usa', 'america', 'iowa', 'mit', 'nasa',
  'польщ', 'poland', 'польщ',
  'німеч', 'germany', 'deutsch', 'берлін', 'berlin',
  'лондон', 'london', 'uk ', 'uk,', 'uk\n',
  'франц', 'france', 'paris',
  'канад', 'canada',
  'китай', 'china',
  'ташкент', 'tashkent',
  'cern', 'нью-йорк', 'new york',
  'єс', ' eu ', 'europe', 'ес,', 'в єс',
  'різні країни', 'офлайн в єс', 'офлайн, різні',
];

// Ключові слова для "Міжнародні" у title/summary
// Шукаємо тільки в title (не summary) — summaries укр. олімпіад часто згадують "міжнарод"
const INTL_TEXT_PATTERNS = [
  'за кордон', 'abroad', 'erasmus', 'rotary', 'euroscola', 'study fair',
  'international', 'european', 'міжнарод',
];

// Українські міста — шукаємо в format та title
const UA_CITY_MAP = [
  ['київ',           'Київ'],
  ['харків',         'Харків'],
  ['одес',           'Одеса'],
  ['львів',          'Львів'],
  ['дніпр',          'Дніпро'],
  ['запоріж',        'Запоріжжя'],
  ['вінниц',         'Вінниця'],
  ['полтав',         'Полтава'],
  ['черніг',         'Чернігів'],
  ['суми',           'Суми'],
  ['хмельниц',       'Хмельницький'],
  ['черкас',         'Черкаси'],
  ['тернопіл',       'Тернопіль'],
  ['рівн',           'Рівне'],
  ['луцьк',          'Луцьк'],
  ['ужгород',        'Ужгород'],
  ['івано-франків',  'Івано-Франківськ'],
  ['кропивниц',      'Кропивницький'],
  ['кривий ріг',     'Кривий Ріг'],
  ['миколаїв',       'Миколаїв'],
  ['херсон',         'Херсон'],
  ['маріупол',       'Маріуполь'],
];

// Маркери "по всій Україні" (без конкретного міста)
const NATIONWIDE_KEYWORDS = [
  'за регіонами', 'у регіонах', 'у містах', 'школи-партнер',
  'мобільні бригади', 'у школах', '7 центрів', 'вокзали',
  'національний відбір', 'офлайн, україна', 'офлайн, україна',
  'через пфу', 'через дію',
];

export function deriveCities(opp) {
  const cities = new Set();
  const fmtRaw = opp.format || '';
  const fmt = fmtRaw.toLowerCase();
  const titleLow = (opp.title || '').toLowerCase();
  const hay = `${titleLow} ${(opp.summary || '').toLowerCase()}`;

  // 1. Онлайн-компонент
  const isOnline =
    fmt.includes('онлайн') || fmt.includes('online') ||
    fmt.includes('дистанційн') || fmt.includes('через дію') ||
    fmt.includes('заявка онлайн') || fmt.includes('онлайн-подача') ||
    fmt.includes('онлайн (заявка)') || fmt.includes('онлайн/мобільний') ||
    fmt.includes('брошура + онлайн') || fmt.includes('через пфу') ||
    fmt === 'online';
  if (isOnline) cities.add('Онлайн');

  // Гібрид завжди має онлайн-компонент
  const isHybrid = fmt.includes('гібрид') || fmt.includes('онлайн + офлайн') || fmt.includes('онлайн / офлайн') || fmt.includes('онлайн+');
  if (isHybrid) cities.add('Онлайн');

  // 2. Чи є іноземна локація у format?
  const hasIntlFormat = INTL_FORMAT_KEYWORDS.some((k) => fmt.includes(k));
  const isIntlType = INTERNATIONAL_TYPES.has(opp.opportunity_type);
  const hasIntlText = INTL_TEXT_PATTERNS.some((p) => hay.includes(p));

  if (hasIntlFormat || isIntlType || hasIntlText) {
    cities.add('Міжнародні');
  }

  // 3. Конкретні українські міста з format + title (не summary — там може бути просто згадка)
  const searchIn = `${fmtRaw} ${opp.title || ''}`.toLowerCase();
  let foundSpecificCity = false;
  for (const [keyword, city] of UA_CITY_MAP) {
    if (searchIn.includes(keyword)) {
      cities.add(city);
      foundSpecificCity = true;
    }
  }

  // 4. Вся Україна — якщо є офлайн-компонент але без конкретного міста і не за кордоном
  const hasOffline =
    fmt.includes('офлайн') || fmt.includes('offline') ||
    fmt.includes('program') || fmt === 'offline';

  const isNationwide = NATIONWIDE_KEYWORDS.some((k) => fmt.includes(k));

  if (!foundSpecificCity) {
    if (isHybrid && !hasIntlFormat) {
      // Гібрид без конкретного міста → загальнонаціональний офлайн
      cities.add('Вся Україна');
    } else if (hasOffline && !hasIntlFormat && !isIntlType) {
      cities.add('Вся Україна');
    } else if (isNationwide) {
      cities.add('Вся Україна');
    } else if (
      fmt.includes('україн') || fmt.includes('ukraine') ||
      fmt.includes('nationwide') || fmt.includes('регіон')
    ) {
      cities.add('Вся Україна');
    }
  }

  // Якщо нічого не визначили — не додаємо нічого (краще порожньо ніж неправда)
  return [...cities];
}

// ---

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — зміни не зберігатимуться\n' : '🚀 Оновлюємо cities...\n');

  const { data: opps, error } = await supabase
    .from('opportunities')
    .select('id, title, summary, format, opportunity_type, cities')
    .eq('status', 'active');

  if (error) { console.error('Помилка:', error); process.exit(1); }

  console.log(`Знайдено ${opps.length} записів\n`);

  const updates = [];
  const stats = {};
  let changed = 0;

  for (const opp of opps) {
    const cities = deriveCities(opp);
    cities.forEach((c) => { stats[c] = (stats[c] || 0) + 1; });

    const prev = JSON.stringify((opp.cities || []).sort());
    const next = JSON.stringify([...cities].sort());
    if (prev !== next) {
      changed++;
      if (DRY_RUN) {
        console.log(`  ${opp.title?.slice(0, 55)}`);
        console.log(`    ${prev} → ${next}`);
      }
    }
    updates.push({ id: opp.id, cities });
  }

  console.log('\nСтатистика:');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
  console.log(`\nЗмін: ${changed}/${opps.length}`);

  const withoutCity = updates.filter((u) => u.cities.length === 0).length;
  if (withoutCity > 0) console.log(`⚠️  ${withoutCity} без міста`);

  if (DRY_RUN) {
    console.log('\nDRY RUN завершено.'); return;
  }

  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    for (const { id, cities } of updates.slice(i, i + BATCH)) {
      const { error: e } = await supabase.from('opportunities').update({ cities }).eq('id', id);
      if (e) console.error(`  Помилка id=${id}:`, e.message);
      else updated++;
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, updates.length)}/${updates.length}...`);
  }
  console.log(`\n✅ Оновлено ${updated}/${updates.length}`);
}

main().catch(console.error);
