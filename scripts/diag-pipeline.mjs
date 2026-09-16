/**
 * Звіт про здоров'я конвеєра — те, чого не видно анонімним ключем.
 *
 * Навіщо. Таблиці `raw_items` і `sources` мають RLS без жодної політики
 * читання, тож із локального оточення (NEXT_PUBLIC_SUPABASE_ANON_KEY) вони
 * ЗАВЖДИ віддають нуль рядків — і це неможливо відрізнити від справді
 * порожнього шару. 16.09.2026 через це мало не народився хибний висновок
 * «шар сирих даних не наповнюється». Скрипт ходить службовим ключем і
 * показує, що там насправді.
 *
 * Нічого не пише. Запуск: workflow «Діагностика конвеєра» (workflow_dispatch).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Прямо через PostgREST: службовий ключ обходить RLS, а count=exact дає
// кількість без вивантаження рядків.
async function q(path, { count = false, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(count ? { Prefer: 'count=exact' } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  const total = res.headers.get('content-range')?.split('/')?.[1];
  return { rows: await res.json(), total: total ? Number(total) : null };
}

const section = (title) => console.log(`\n${'='.repeat(64)}\n${title}\n${'='.repeat(64)}`);

section('RAW_ITEMS — шар сирих знахідок');
const raw = await q('raw_items?select=id&limit=1', { count: true });
console.log(`усього рядків: ${raw.total}`);

if (raw.total > 0) {
  for (const status of ['pending', 'processed', 'rejected', 'failed']) {
    const r = await q(`raw_items?select=id&status=eq.${status}&limit=1`, { count: true });
    console.log(`  ${status}: ${r.total}`);
  }
  const { rows: recent } = await q(
    'raw_items?select=source_name,fetched_at,status&order=fetched_at.desc&limit=5',
  );
  console.log('\nостанні 5 знахідок:');
  for (const r of recent) console.log(`  ${r.fetched_at} · ${r.source_name} · ${r.status}`);

  // Чи лежить у сирці текст, якого немає в самому записі: якщо так, перерозмітку
  // можна зробити без повторного походу на чужі сайти.
  const { rows: sized } = await q(
    'raw_items?select=id,source_name,raw_text&order=fetched_at.desc&limit=200',
  );
  const lens = sized.map((r) => (r.raw_text || '').length).sort((a, b) => a - b);
  if (lens.length) {
    console.log(`\nдовжина raw_text (останні 200): медіана ${lens[Math.floor(lens.length / 2)]}, `
      + `мін ${lens[0]}, макс ${lens[lens.length - 1]}`);
  }
}

section('SOURCES — реєстр джерел');
const src = await q('sources?select=id&limit=1', { count: true });
console.log(`усього джерел: ${src.total}`);
if (src.total > 0) {
  const { rows } = await q(
    'sources?select=name,enabled,adapter,last_success_at,consecutive_failures&order=name',
  );
  const dead = rows.filter((r) => r.consecutive_failures > 0);
  console.log(`увімкнених: ${rows.filter((r) => r.enabled).length} з ${rows.length}`);
  console.log(`з поспіль-збоями: ${dead.length}`);
  for (const r of dead) {
    console.log(`  ⚠️  ${r.name} · ${r.adapter} · збоїв ${r.consecutive_failures} · `
      + `останній успіх ${r.last_success_at || '—'}`);
  }
}

section('ЧИ Є СИРЕЦЬ ДЛЯ АКТИВНИХ ЗАПИСІВ');
// Скільки активних записів мають у raw_items свій вихідний текст. Це визначає,
// чи можна перерозмітити каталог із того, що вже збережено, чи доведеться
// заново стягувати 1100+ чужих сторінок.
const { rows: opps } = await q(
  'opportunities?select=id,source_url&status=eq.active&canonical_slug=is.null&limit=1000',
);
let withRaw = 0;
const sample = opps.slice(0, 300);
for (const o of sample) {
  if (!o.source_url) continue;
  const enc = encodeURIComponent(o.source_url);
  const r = await q(`raw_items?select=id&source_url=eq.${enc}&limit=1`, { count: true });
  if (r.total > 0) withRaw += 1;
}
console.log(`перевірено ${sample.length} активних записів (вибірка)`);
console.log(`мають збережений сирий текст: ${withRaw} (${(withRaw / sample.length * 100).toFixed(1)}%)`);
console.log(`\nвисновок: ${withRaw / sample.length > 0.8
  ? 'перерозмітку можна робити з raw_items, без повторного скрапінгу'
  : 'сирцю для більшості записів немає — перерозмітка потребує повторного читання сторінок'}`);
