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
 * Змінювати можна текст і факти картки (EDITABLE), серед них тип, формат,
 * місто й вид за часом. Статус і slug — ні: для публікації й приховування є
 * адмінка та «Опублікувати чернетку», а slug живе в Telegram і Google.
 *
 * Джерело змінити можна, але ціною цитат — див. checkSourceUrl нижче.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLUG, PATCH,
 *      CONFIRM=PATCH (без нього — лише показати, що зміниться).
 */
import criteria from '../lib/publish-criteria.json' with { type: 'json' };
import { canonicalUrl } from '../lib/canonical.mjs';

const EDITABLE = new Set([
  'title', 'summary', 'details', 'title_en', 'summary_en', 'details_en',
  'price_note', 'apply_url', 'deadline', 'event_start_date', 'event_end_date',
  'age_from', 'age_to', 'cost_type',
  // Цитати зі сторінки. Без них публікація тепер не проходить, тож має бути
  // чим їх вписати: {"evidence": {"date": "…", "cost": "…"}} доповнює наявні
  // ключі, а не затирає весь обʼєкт.
  'evidence',
  // Тип, формат, місце й вид за часом — теж факти картки, і без них чернетка-
  // заглушка не публікується: publish-draft вимагає всі пʼять полів, а
  // вписати формат чи місто не було чим. 02.10.2026 так застрягли мовні
  // школи, які Марія сказала публікувати одразу. Значення звіряються зі
  // словником (CHECKS): тип поза словником сайт мовчки показує як «курс».
  'opportunity_type', 'format', 'cities', 'countries', 'timing_kind', 'is_international',
  // Джерело. Довго було заборонене — і правильно: цитати в evidence узяті саме
  // з тієї сторінки, тож підміна адреси зробила б їх брехнею, не торкнувшись
  // жодного символу. Але 02.10.2026 виявилось, що 121 запис на сайті має
  // джерелом ГОЛОВНУ сторінку домену, і щонайменше у третини з них справжня
  // сторінка можливості існує поруч. Виправити це не було чим зовсім: лишався
  // лише редактор в адмінці, запис за записом руками.
  //
  // Тому правило не «ніколи», а «разом із цитатами»: нова адреса стирає
  // evidence цілком. Запис повертається в стан «цитат немає» — його перечитає
  // scraper/proof_recheck.py уже за новою адресою, і на сайті не лишиться
  // жодного твердження, підписаного сторінкою, якої ми не читали.
  'source_url',
]);

const isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim());
const oneOf = (list) => (v) => list.includes(v);
const CHECKS = {
  opportunity_type: [oneOf(criteria.required.type.allowed), 'тип зі словника lib/publish-criteria.json'],
  format: [oneOf(['online', 'offline', 'hybrid']), 'online, offline або hybrid'],
  timing_kind: [oneOf(['one_time', 'periodic', 'permanent']), 'one_time, periodic або permanent'],
  cities: [isStringList, 'список назв: ["Дніпро"]'],
  countries: [isStringList, 'список кодів країн: ["ua"]'],
  is_international: [(v) => typeof v === 'boolean', 'true або false'],
};

// Прості перевірки адреси — щоб у базу не пішло «htp://» чи порожнє.
// Повні правила джерела (чужий Telegram) живуть у lib/source-rules.js і
// перевіряються воротами публікації; тут — лише форма.
export function checkSourceUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('джерело не може бути порожнім');
  let u;
  try { u = new URL(raw); } catch { throw new Error(`«${raw}» — це не адреса`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`«${raw}» — потрібен http(s)`);
  }
  return u.toString();
}

export function applyPatch(row, patch) {
  const out = {};
  // Нове джерело й нові цитати в одній правці — суперечність: невідомо, з якої
  // сторінки взяті цитати. Відмовляємо, а не вгадуємо.
  if ('source_url' in patch && 'evidence' in patch) {
    throw new Error('джерело і цитати разом не приймаємо: нова адреса стирає цитати, '
      + 'тож спершу правка джерела, потім цитати з нової сторінки');
  }
  for (const [field, value] of Object.entries(patch)) {
    if (!EDITABLE.has(field)) throw new Error(`поле «${field}» тут не змінюється`);
    if (CHECKS[field] && !CHECKS[field][0](value)) {
      throw new Error(`«${field}» має бути: ${CHECKS[field][1]}`);
    }
    if (field === 'source_url') {
      const next = checkSourceUrl(value);
      if (next === String(row.source_url ?? '')) {
        throw new Error('джерело те саме — нічого не міняю');
      }
      out.source_url = next;
      // Цитати належать сторінці, з якої їх прочитали. Нова адреса — і вони
      // більше нічого не доводять.
      out.evidence = {};
      // canonical_url — ключ, яким upsert пізнає «та сама сторінка» (db.py).
      // Лишити стару означало б, що нічний скрап принесе нову адресу як НОВИЙ
      // запис, і на сайті стане дві картки однієї можливості.
      out.canonical_url = canonicalUrl(next);
      continue;
    }
    // evidence доповнюємо по ключах: передали цитату на дату — решта лишається.
    if (field === 'evidence') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('evidence має бути обʼєктом: {"date": "цитата"}');
      }
      const base = (row.evidence && typeof row.evidence === 'object') ? row.evidence : {};
      out.evidence = { ...base, ...value };
      continue;
    }
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
