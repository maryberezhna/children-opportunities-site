// Публікує одну чернетку на сайт — те саме, що кнопка «Додати на сайт» в
// адмінці, але з можливістю в тому ж кроці дописати вартість. Запускається
// руками через .github/workflows/publish-draft.yml (workflow_dispatch).
//
// Навіщо окремо від адмінки: запис у базу вміє лише сервер із service-ключем,
// і коли модерацію веде асистент, кнопки під рукою немає. Правила ті самі:
// публікуємо тільки чернетку і тільки якщо є всі пʼять обовʼязкових полів
// (lib/required.js) — інакше скрипт падає й нічого не пише.

import { createClient } from '@supabase/supabase-js';
import { missingRequired } from '../lib/required.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ID = (process.env.OPPORTUNITY_ID || '').trim();
const COST_TYPE = (process.env.COST_TYPE || '').trim();
const PRICE_NOTE = (process.env.PRICE_NOTE || '').trim();
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ID) {
  console.error('Missing OPPORTUNITY_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: row, error } = await supabase
  .from('opportunities')
  .select('id, title, status, slug, age_from, age_to, deadline, event_end_date, recurrence, cost_type, price_note, opportunity_type, format, cities, countries, is_international, admin_comment')
  .eq('id', ID)
  .maybeSingle();

if (error) { console.error(error.message); process.exit(1); }
if (!row) { console.error(`Запис ${ID} не знайдено`); process.exit(1); }

// Лише чернетку: закритий запис закрито з причиною, і воскрешати його мовчки
// не можна.
if (row.status !== 'draft') {
  console.error(`«${row.title}» має статус ${row.status}, а не draft — не публікую.`);
  process.exit(1);
}

const patch = {};
if (COST_TYPE) patch.cost_type = COST_TYPE;
if (PRICE_NOTE) patch.price_note = PRICE_NOTE;

const missing = missingRequired({ ...row, ...patch });
if (missing.length) {
  console.error(`«${row.title}» не можна публікувати — бракує: ${missing.join(', ')}`);
  process.exit(1);
}

const now = new Date().toISOString();
const trace = 'опубліковано через publish-draft';
Object.assign(patch, {
  status: 'active',
  verified_at: now,
  updated_at: now,
  admin_comment: [row.admin_comment, trace].filter(Boolean).join(' · ').slice(0, 500),
});

console.log(`«${row.title}»`);
for (const [k, v] of Object.entries(patch)) {
  if (k === 'updated_at' || k === 'verified_at') continue;
  console.log(`  ${k}: ${JSON.stringify(row[k] ?? null)} → ${JSON.stringify(v)}`);
}

if (DRY_RUN) {
  console.log('--- DRY RUN: нічого не записано ---');
  process.exit(0);
}

const { error: upErr } = await supabase.from('opportunities').update(patch).eq('id', ID);
if (upErr) { console.error(upErr.message); process.exit(1); }
console.log(`✓ Опубліковано: https://dityam.com.ua/o/${row.slug}`);
