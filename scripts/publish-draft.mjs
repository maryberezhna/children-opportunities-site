// Публікує одну чернетку на сайт — те саме, що кнопка «Додати на сайт» в
// адмінці, але з можливістю в тому ж кроці дописати вартість. Запускається
// руками через .github/workflows/publish-draft.yml (workflow_dispatch).
//
// Навіщо окремо від адмінки: запис у базу вміє лише сервер із service-ключем,
// і коли модерацію веде асистент, кнопки під рукою немає. Правила ті самі:
// публікуємо тільки чернетку і тільки якщо є всі пʼять обовʼязкових полів
// (lib/required.js) — інакше скрипт падає й нічого не пише.

import { createClient } from '@supabase/supabase-js';
import { GATE_SELECT, publishBlockers } from '../lib/publish-gate.js';

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
  .select(`id, status, slug, price_note, admin_comment, ${GATE_SELECT}`)
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

// Поля, джерело й цитати — одними воротами (lib/publish-gate.js), тими самими,
// що в /admin, редакторі й боті. Цитати обовʼязкові так само, як самі поля
// («світлофор», 22.09.2026): поле, заповнене без цитати, — це твердження, яке
// ніхто не підтверджував, а на сайті воно виглядає як перевірене.
const blocker = publishBlockers({ ...row, ...patch });
if (blocker) {
  console.error(`«${row.title}» не можна публікувати — ${blocker.text}`);
  if (blocker.error === 'missing_proof') {
    console.error('Додайте цитати в evidence через «Картка — точкова правка»:');
    console.error('  {"evidence": {"date": "…", "cost": "…", "age": "…", "type": "…", "place": "…"}}');
  }
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
