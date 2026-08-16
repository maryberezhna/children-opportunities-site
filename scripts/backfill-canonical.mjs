// Одноразовий бекфіл canonical_url для наявних записів (Фаза 1 конвеєра).
// Використовує ту САМУ функцію canonicalUrl, що й пайплайни — жодної другої
// реалізації правил. Безпечний до повторних запусків: бере лише рядки,
// де canonical_url ще порожній.

import { createClient } from '@supabase/supabase-js';
import { canonicalUrl } from '../scrapers/lib/canonical.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, source_url')
    .not('source_url', 'is', null)
    .is('canonical_url', null)
    .order('id')
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('select failed:', error.message);
    process.exit(1);
  }
  rows.push(...(data || []));
  if (!data || data.length < PAGE) break;
}

console.log(`До бекфілу: ${rows.length} записів без canonical_url`);
let updated = 0;
let unparseable = 0;

for (const row of rows) {
  const cu = canonicalUrl(row.source_url);
  if (!cu) {
    unparseable += 1;
    console.log(`  ⚠ не парситься: ${row.source_url}`);
    continue;
  }
  if (DRY_RUN) {
    updated += 1;
    continue;
  }
  const { error } = await supabase
    .from('opportunities')
    .update({ canonical_url: cu })
    .eq('id', row.id);
  if (error) console.error(`  update failed for ${row.id}: ${error.message}`);
  else updated += 1;
}

console.log(`Оновлено: ${updated}, не розпарсилось: ${unparseable}`);
