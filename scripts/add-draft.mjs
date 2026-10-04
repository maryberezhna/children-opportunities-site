// Додати знайдену можливість у чернетки.
//
// Навіщо. Знахідки Марії («крута можливість, шукай і додавай») не мали шляху в
// базу взагалі: форма пропозицій і нічний скрап ведуть через модель, а коли на
// API скінчились кошти, не працює ні те, ні те. Руками в базу теж не записати:
// службовий ключ живе лише в секретах GitHub.
//
// Запис завжди лягає ЧЕРНЕТКОЮ — ніколи одразу на сайт. Рішення про публікацію
// лишається за людиною й за воротами (lib/publish-gate.js): скрипт лише
// показує, що ті ворота скажуть, щоб було видно, чого бракує.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECORD (JSON),
//      CONFIRM=ADD (без нього — лише показати, що буде записано).
import { createClient } from '@supabase/supabase-js';
import { GATE_SELECT, publishBlockers } from '../lib/publish-gate.js';
import { canonicalUrl } from '../lib/canonical.mjs';

// Поля, які можна задати. Решти — наприклад status — скрипт не приймає
// свідомо: він уміє лише «додати чернетку», і нічого більше.
export const FIELDS = new Set([
  'title', 'summary', 'details', 'source_url', 'apply_url', 'source',
  'opportunity_type', 'age_from', 'age_to', 'cost_type', 'price_note',
  'deadline', 'event_start_date', 'event_end_date', 'results_date',
  'format', 'cities', 'countries', 'is_international', 'timing_kind',
  'categories', 'child_needs', 'evidence',
]);

/** Латиниця з назви — slug. Чиста функція, щоб її перевіряв тест. */
export function slugify(title, suffix = '') {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
    и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
    р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', ʼ: '',
  };
  const base = String(title || '').toLowerCase().split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return suffix ? `${base}-${suffix}` : base;
}

/** Що саме піде в базу. Чиста функція — під тести. */
export function buildRecord(input, now = new Date()) {
  const unknown = Object.keys(input).filter((k) => !FIELDS.has(k));
  if (unknown.length) throw new Error(`поля тут не задаються: ${unknown.join(', ')}`);
  if (!input.title) throw new Error('без назви запис не створюємо');
  if (!input.source_url) throw new Error('без джерела запис не створюємо');

  const iso = now.toISOString();
  const suffix = Math.random().toString(16).slice(2, 8);
  return {
    ...input,
    slug: slugify(input.title, suffix),
    canonical_url: canonicalUrl(input.source_url),
    status: 'draft',           // ніколи не 'active': публікує людина
    created_at: iso,
    updated_at: iso,
    admin_comment: 'додано вручну через add-draft',
  };
}

async function main() {
  // Перевірка оточення — тут, а не при завантаженні модуля: інакше тест не
  // може його імпортувати, і чисті функції лишились би без перевірки.
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RECORD = process.env.RECORD;
  const CONFIRM = process.env.CONFIRM;
  if (!SUPABASE_URL || !KEY || !RECORD) {
    console.error('Потрібні NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECORD');
    process.exit(1);
  }
  const input = JSON.parse(RECORD);
  const row = buildRecord(input);
  const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

  // Дубль перевіряємо за канонічною адресою: та сама сторінка — той самий запис.
  const { data: same } = await supabase.from('opportunities')
    .select('id, title, status').eq('canonical_url', row.canonical_url).limit(1);
  if (same && same.length) {
    console.error(`Така сторінка вже в базі: «${same[0].title}» (${same[0].status}) — не дублюю.`);
    process.exit(1);
  }

  console.log(`«${row.title}»`);
  for (const [k, v] of Object.entries(row)) {
    if (k === 'created_at' || k === 'updated_at') continue;
    console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }

  const blocker = publishBlockers(row);
  console.log(blocker
    ? `\n⚠ Публікувати поки не можна — ${blocker.text}`
    : '\n✅ Ворота публікації пройдено: запис готовий до «Опублікувати чернетку».');

  if (CONFIRM !== 'ADD') {
    console.log('\n--- СУХИЙ ПРОГІН: нічого не записано (CONFIRM=ADD, щоб записати) ---');
    return;
  }
  const { data, error } = await supabase.from('opportunities').insert(row)
    .select(`id, slug, ${GATE_SELECT}`).maybeSingle();
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`\n✓ Додано чернеткою: ${data.id}\n  /admin → вкладка чернеток`);
}

if (process.argv[1] && process.argv[1].endsWith('add-draft.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
