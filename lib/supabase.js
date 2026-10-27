import { createClient } from '@supabase/supabase-js';
import { visibleFor } from './audience.js';
import { kyivToday } from './dates.js';

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
  // countries та is_international — для фільтра «Де» і підпису «За кордоном»:
  // без них закордонні AFS/Erasmus нічим не відрізняються від київського гуртка.
  // Поля режиму «Підліткам»: картка «Отримаєш / Треба» і фільтр «Що дає».
  // Обидві дати проведення: без event_start_date картка не може відрізнити
  // «подія 6–8 листопада» від «подача до 17 вересня» і підписує дедлайн як
  // день проведення. apply_url на картку не їде — він потрібен лише на
  // сторінці можливості, де людина вирішує подаватись.
  // timing_kind — вид за часом (одноразова / періодична / постійна): без нього
  // картка знову вгадувала б «🔄 щорічно» за типом.
  // ua_eligibility — «чи можна з України»: без нього група «для кого за
  // місцем» (lib/reach.js) не відрізнить суботню школу в Польщі від табору.
  'event_start_date, event_end_date, results_date, timing_kind, created_at, title_en, featured_week, countries, is_international, ' +
  'teen_benefit, teen_requirement, teen_tags, ua_eligibility';

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
//
// Тимчасові збої (5xx шлюзу Supabase, обрив мережі — status 0) перепитуємо:
// 14.09.2026 між 13:27 і 13:31 UTC Supabase відповідав сайту 502/504, і
// головна, /en і /dedlainy закешувались із «0 можливостей». Помилки 4xx
// (кривий запит) не повторюємо — там повтор нічого не змінить.
const PAGE_SIZE = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPages(buildQuery, { attempts = 4, delayMs = 1000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let res;
    for (let attempt = 1; ; attempt += 1) {
      res = await buildQuery().range(from, from + PAGE_SIZE - 1);
      const transient = res.error && (!res.status || res.status >= 500);
      if (!transient || attempt >= attempts) break;
      await sleep(delayMs * 2 ** (attempt - 1));
    }
    const { data, error } = res;
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

// Одна й та сама вибірка — один запит на процес протягом хвилини. Під час
// збірки ~1080 сторінок тягнули повний каталог кожна окремо: тисячі важких
// запитів за кілька хвилин, і шлюз Supabase відповідав 504 (14.09.2026).
// Одночасні сторінки чекають той самий запит. Кешуються лише успішні
// відповіді; кожен виклик отримає власну копію, щоб сторінка, яка сортує чи
// доповнює записи, не зіпсувала їх сусідній. Ключ — метод і URL запиту до
// .range() (postgrest-js зберігає їх у білдері); без URL кешу немає.
const CACHE_TTL_MS = 60_000;
const cache = new Map();

export async function fetchAllRows(buildQuery, opts) {
  const probe = buildQuery();
  const key = probe && probe.url ? `${probe.method} ${probe.url}` : null;
  if (!key) return fetchPages(buildQuery, opts);

  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at >= CACHE_TTL_MS) {
    hit = {
      at: Date.now(),
      promise: fetchPages(buildQuery, opts).then((res) => {
        if (res.error) cache.delete(key);
        return res;
      }),
    };
    cache.set(key, hit);
  }
  const res = await hit.promise;
  return res.error ? res : { data: structuredClone(res.data), error: null };
}

// Для сторінок каталогу: помилка бази — це НЕ «нуль можливостей». Порожній
// список закешувався б на 5 хвилин і показав би людям «Нічого не знайдено».
// Кинута помилка під час ISR лишає попередню добру версію сторінки, а під час
// збірки валить деплой замість того, щоб опублікувати порожній сайт.
export function rowsOrThrow({ data, error }, where) {
  if (error || !data) {
    throw new Error(`Supabase: не вдалося завантажити каталог (${where}): ${error?.message || 'no data'}`);
  }
  return data;
}

// Скільки можливостей показує сайт — ОДНЕ число для футера, layout, /en,
// /about, /press, /plus, «Як ми перевіряємо» і будь-де ще.
//
// Рахуємо те, що людина справді бачить у каталозі на головній: публічні записи
// без прострочених (visibleFor — той самий предикат, що й список). До
// 05.10.2026 тут був HEAD-запит по status='active', і він рахував ще й записи з
// минулим дедлайном, які нічна перевірка не встигла закрити: головна й /en
// показували 711, а /about, /press, /plus і «Як ми перевіряємо» — 718. Марія:
// «всюди має бути 1 каунтер». Тому всі цифри сайту — лише з liveStats().
//
// Лічильник викликає layout на КОЖНІЙ перебудові кожної сторінки (6280
// HEAD-запитів за 6 хвилин 14.09.2026), тож вибірка йде через fetchAllRows:
// одна відповідь на процес протягом хвилини, помилка не кешується.
const LIVE_STATS_FIELDS = 'id, cost_type, source, opportunity_type, cities, child_needs, '
  + 'last_verified_at, deadline, event_start_date, event_end_date, results_date';

export async function liveStats() {
  if (!supabase) return null;
  const { data, error } = await fetchAllRows(() =>
    publicOpportunities(LIVE_STATS_FIELDS).order('id'));
  if (error || !data) return null;
  return statsOf(visibleFor(data, kyivToday()));
}

/** Цифри з уже відфільтрованих живих записів. Окремо, щоб тестувати без бази. */
export function statsOf(rows, now = Date.now()) {
  const cities = new Set();
  const needs = new Set();
  rows.forEach((o) => {
    (o.cities || []).forEach((c) => cities.add(c));
    (o.child_needs || []).forEach((n) => needs.add(n));
  });
  const fresh = now - 3 * 86400000;
  return {
    total: rows.length,
    free: rows.filter((o) => o.cost_type === 'free').length,
    // «Джерел» — різні source серед живих записів: не скільки сайтів ми
    // обходимо, а скільки дали хоч один запис, який зараз видно.
    sources: new Set(rows.map((o) => o.source).filter(Boolean)).size,
    types: new Set(rows.map((o) => o.opportunity_type).filter(Boolean)).size,
    cities: cities.size,
    needs: needs.size,
    // Посилання перевірене за останні 3 доби — для «Як ми перевіряємо».
    verified: rows.filter((o) => o.last_verified_at && Date.parse(o.last_verified_at) >= fresh).length,
  };
}

export async function countActiveOpportunities() {
  return (await liveStats())?.total ?? null;
}

export async function countActiveSources() {
  return (await liveStats())?.sources ?? null;
}

// Запасні значення на випадок, коли база недоступна. Свідомо ЗАНИЖЕНІ й
// зібрані в одному місці: раніше кожна сторінка мала своє («500+» у футері,
// «400» у layout), і при збої бази сайт обіцяв 500 можливостей, маючи 449.
// Краще пообіцяти менше, ніж збрехати.
export const FALLBACK = {
  opportunities: '400+',
  sources: '200+',
};
