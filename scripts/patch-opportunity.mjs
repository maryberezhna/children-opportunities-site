/**
 * Точкова правка однієї картки за slug — коли Марія просить змінити текст.
 *
 * Навіщо. Ключ сервісу Supabase живе лише в секретах GitHub, а конектор
 * Supabase у сесії Claude буває відключений. 22.09.2026 саме так: Марія
 * попросила дописати в картку «9 університетів Великої Британії», що поїздку
 * веде освітня агенція DEC Education, — і записати це не було чим.
 *
 * PATCH — JSON. Значення поля або рядок/число (замінити цілком), або
 * {"replace": [["було", "стало"], ...]} — виправити фрагменти в тексті.
 * Кожен фрагмент мусить знайтися, інакше правка не пишеться зовсім.
 *
 * Змінювати можна лише текст і факти картки (EDITABLE). Статус, slug,
 * джерело — ні: для публікації й приховування є адмінка.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLUG, PATCH,
 *      CONFIRM=PATCH (без нього — лише показати, що зміниться).
 */
const EDITABLE = new Set([
  'title', 'summary', 'details', 'title_en', 'summary_en', 'details_en',
  'price_note', 'apply_url', 'deadline', 'event_start_date', 'event_end_date',
  'age_from', 'age_to', 'cost_type',
]);

export function applyPatch(row, patch) {
  const out = {};
  for (const [field, value] of Object.entries(patch)) {
    if (!EDITABLE.has(field)) throw new Error(`поле «${field}» тут не змінюється`);
    if (value && typeof value === 'object' && Array.isArray(value.replace)) {
      let text = String(row[field] ?? '');
      for (const [from, to] of value.replace) {
        if (!text.includes(from)) throw new Error(`у «${field}» немає фрагмента «${from}»`);
        text = text.split(from).join(to);
      }
      out[field] = text;
    } else {
      out[field] = value;
    }
  }
  return out;
}

async function main() {
  const { SLUG, PATCH, CONFIRM } = process.env;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !SLUG || !PATCH) {
    console.error('Потрібні NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLUG, PATCH');
    process.exit(1);
  }
  const patch = JSON.parse(PATCH);
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await supabase.from('opportunities')
    .select('*').eq('slug', SLUG).maybeSingle();
  if (error) throw error;
  if (!row) {
    console.error(`Картки ${SLUG} немає`);
    process.exit(1);
  }

  const changes = applyPatch(row, patch);
  for (const [field, value] of Object.entries(changes)) {
    console.log(`── ${field}\n   було:  ${JSON.stringify(row[field])}\n   стане: ${JSON.stringify(value)}`);
  }
  if (CONFIRM !== 'PATCH') {
    console.log('\nЛише показ. Щоб записати — запусти з confirm = PATCH.');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const trace = `правка вручну ${today}: ${Object.keys(changes).join(', ')}`;
  const prev = String(row.admin_comment || '').trim();
  const { error: upErr } = await supabase.from('opportunities').update({
    ...changes,
    admin_comment: (prev ? `${prev} · ${trace}` : trace).slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (upErr) throw upErr;
  console.log(`\n✓ Записано: https://dityam.com.ua/o/${row.slug}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
