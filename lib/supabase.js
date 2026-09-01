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
  'age_from, age_to, cost_type, child_needs, cities, format, deadline, ' +
  // title_en їде й на українську сторінку: він короткий, а без нього пошук
  // не знайде табір за англійською назвою, вставленою з листа.
  'event_end_date, created_at, title_en, featured_week';

// Англійський каталог. summary_en окремо, бо це найдовше поле картки: на
// українській сторінці воно подвоїло б обсяг, який їде в браузер, і не
// знадобилось би там жодного разу.
export const CARD_FIELDS_EN = `${CARD_FIELDS}, summary_en`;

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

// PostgREST віддає щонайбільше 1000 рядків на запит — серверний ліміт
// Supabase, який не обходиться .limit() з більшим числом. Поки активних
// записів було менше тисячі, це було невидимо; 1 вересня 2026 база перейшла
// межу, і каталог мовчки показував 1000 із 1026. Тому будь-яка вибірка «всі
// рядки» йде сторінками через цей хелпер. buildQuery має повертати СВІЖИЙ
// запит (builder одноразовий) зі СТАБІЛЬНИМ порядком — додавайте .order('id')
// останнім тай-брейком, інакше записи з однаковим created_at (пакетні вставки
// скраперів) можуть загубитись або задвоїтись на межі сторінок.
// ⚠️ Цей хелпер уже раз зник у мержі (#158 базувався на старій копії файлу і
// затер #153) — прод не деплоївся, поки його не повернули. Не видаляти.
const PAGE_SIZE = 1000;
export async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

// Скільки можливостей показує сайт — одна відповідь для футера, layout, /en
// і будь-де ще, щоб на двох сторінках поспіль не стояли різні числа.
export async function countActiveOpportunities() {
  if (!supabase) return null;
  const { count, error } = await publicOpportunities('id', { count: 'exact', head: true });
  return error ? null : (count ?? null);
}

// Скільки джерел живлять каталог. Рахуємо так само, як лічильник на головній
// і на /press: різні значення source серед АКТИВНИХ записів. Тобто це не
// «скільки сайтів ми обходимо», а «скільки джерел дали хоч один живий запис».
// Одне визначення на весь сайт — інакше «джерел» знову означатиме три різні
// речі в трьох місцях.
export async function countActiveSources() {
  if (!supabase) return null;
  const { data, error } = await fetchAllRows(() =>
    publicOpportunities('source').order('id'));
  if (error || !data) return null;
  return new Set(data.map((r) => r.source).filter(Boolean)).size;
}

// Запасні значення на випадок, коли база недоступна. Свідомо ЗАНИЖЕНІ й
// зібрані в одному місці: раніше кожна сторінка мала своє («500+» у футері,
// «400» у layout), і при збої бази сайт обіцяв 500 можливостей, маючи 449.
// Краще пообіцяти менше, ніж збрехати.
export const FALLBACK = {
  opportunities: '400+',
  sources: '200+',
};
