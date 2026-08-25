import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Exactly the columns a catalogue card (and the ItemList JSON-LD) renders.
// `select('*')` used to ship every column of every active row to the browser —
// including scraper bookkeeping and moderation fields nobody reads there.
export const CARD_FIELDS =
  'id, slug, title, summary, source, source_url, opportunity_type, aid_type, ' +
  'age_from, age_to, cost_type, child_needs, cities, format, deadline, created_at';

// ЄДИНИЙ вхід для будь-якої публічної вибірки можливостей.
//
// Публічний каталог — це рівно ті записи, у яких status='active' І порожній
// canonical_slug: дублі віддають 301 на оригінал, і показувати чи рахувати їх
// не можна. Коли ці два фільтри писалися руками на кожній сторінці, футер,
// layout, /en і /yak-my-pereviriaiemo показували 462, а каталог і /press — 438.
//
// Пряме supabase.from('opportunities') + eq('status','active') у публічних
// файлах заборонене — це ловить scripts/check-catalogue-queries.mjs на
// prebuild. Одиночний запис за slug — інша історія: там canonical_slug
// потрібен, щоб віддати 301, тож такі місця через цей хелпер не йдуть.
export function publicOpportunities(select = CARD_FIELDS, opts) {
  return supabase
    .from('opportunities')
    .select(select, opts)
    .eq('status', 'active')
    .is('canonical_slug', null);
}

// Скільки можливостей показує сайт — одна відповідь для футера, layout, /en
// і будь-де ще, щоб на двох сторінках поспіль не стояли різні числа.
export async function countActiveOpportunities() {
  if (!supabase) return null;
  const { count, error } = await publicOpportunities('id', { count: 'exact', head: true });
  return error ? null : (count ?? null);
}
