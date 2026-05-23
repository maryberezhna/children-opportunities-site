import { createClient } from '@supabase/supabase-js';

// Одноразовий endpoint: додає колонку cities та заповнює дані.
// Потрібно: SUPABASE_SERVICE_ROLE_KEY у env + SUPABASE_MGMT_TOKEN (PAT із supabase.com/dashboard/account/tokens)
// Захищений: ?secret=dityam-migrate-2026
// Після виконання — видалити цей файл!

const MIGRATE_SECRET = process.env.MIGRATE_SECRET || 'dityam-migrate-2026';
const PROJECT_REF = 'nhftsdvhtdnkxydmhppf';

const INTERNATIONAL_PATTERNS = [
  'за кордон', 'abroad', 'international', 'europe', 'european',
  'erasmus', 'rotary', 'afs ', 'euroscola', 'study fair',
];
const INTERNATIONAL_TYPES = new Set(['exchange', 'study_abroad']);

const UA_CITIES = [
  ['київ', 'Київ'], ['харків', 'Харків'], ['одес', 'Одеса'],
  ['львів', 'Львів'], ['дніпр', 'Дніпро'], ['запоріж', 'Запоріжжя'],
  ['вінниц', 'Вінниця'], ['полтав', 'Полтава'],
];

function deriveCities(opp) {
  const cities = new Set();
  const fmt = (opp.format || '').toLowerCase();
  const hay = `${opp.title || ''} ${opp.summary || ''}`.toLowerCase();

  if (fmt.includes('онлайн') || fmt.includes('online') || fmt.includes('гібрид') || fmt.includes('дистанційн')) {
    cities.add('Онлайн');
  }
  if (fmt.includes('офлайн') || fmt.includes('регіон') || fmt.includes('школи-партнер') || fmt.includes('україн')) {
    cities.add('Вся Україна');
  }
  for (const [keyword, city] of UA_CITIES) {
    if (`${opp.format || ''} ${opp.title || ''}`.toLowerCase().includes(keyword)) {
      cities.add(city);
      cities.delete('Вся Україна');
    }
  }
  const isIntl = INTERNATIONAL_TYPES.has(opp.opportunity_type);
  const hasIntl = INTERNATIONAL_PATTERNS.some((p) => hay.includes(p));
  if (isIntl || hasIntl) {
    cities.add('Міжнародні');
    if (isIntl) cities.delete('Вся Україна');
  }

  return [...cities];
}

async function runMigrationSQL(mgmtToken) {
  const sql = `
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cities text[] DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS idx_opportunities_cities ON opportunities USING GIN (cities);
  `;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mgmtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Management API: ${res.status} — ${text.slice(0, 200)}`);
  }
  return await res.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== MIGRATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mgmtToken = process.env.SUPABASE_MGMT_TOKEN;

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY in env' }, { status: 500 });
  }

  const results = { migration: 'skipped (no SUPABASE_MGMT_TOKEN)', populated: 0, errors: [] };

  // --- Крок 1: ALTER TABLE через Management API (якщо є PAT) ---
  if (mgmtToken) {
    try {
      await runMigrationSQL(mgmtToken);
      results.migration = 'ok';
    } catch (e) {
      results.migration = `failed: ${e.message}`;
    }
  } else {
    results.migration = 'skipped — додай SUPABASE_MGMT_TOKEN до Vercel env або запусти вручну в Supabase SQL Editor: ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cities text[] DEFAULT \'{}\';';
  }

  // --- Крок 2: Завантажуємо записи ---
  const sb = createClient(supabaseUrl, serviceKey);
  const { data: opps, error: fetchError } = await sb
    .from('opportunities')
    .select('id, title, summary, format, opportunity_type')
    .eq('status', 'active');

  if (fetchError) {
    // Якщо колонка ще не існує — повертаємо зрозуміле повідомлення
    return Response.json({
      ...results,
      error: fetchError.message,
      hint: 'Спочатку виконай міграцію в Supabase SQL Editor, потім виклич цей endpoint знову.',
    }, { status: 500 });
  }

  // --- Крок 3: Оновлюємо cities ---
  for (const opp of opps) {
    const cities = deriveCities(opp);
    const { error } = await sb.from('opportunities').update({ cities }).eq('id', opp.id);
    if (error) results.errors.push({ id: opp.id, e: error.message });
    else results.populated++;
  }

  results.total = opps.length;
  return Response.json(results);
}
