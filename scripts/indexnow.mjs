// Повідомити Bing про сторінки, що зʼявились або змінились за добу.
//
// Навіщо саме Bing: на його індекс спирається пошук ChatGPT, а звідти до нас
// приходить 96% усього AI-трафіку. Можливість із дедлайном за два тижні не має
// сенсу, якщо її проіндексують через місяць.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (або анонімний —
//      читаємо лише опубліковане), SINCE_HOURS (типово 26), CONFIRM=SEND.
import { createClient } from '@supabase/supabase-js';
import { INDEXNOW_ENDPOINT, SITE, indexNowBody } from '../lib/indexnow.js';
import { TOPIC_LIST } from '../lib/topics.js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const HOURS = Number(process.env.SINCE_HOURS || 26);
const CONFIRM = process.env.CONFIRM;

/** Адреси, які варто надіслати: свіжі можливості + усі підбірки. */
export function urlsToSubmit(rows, topics) {
  const opportunities = rows.map((r) => `${SITE}/o/${r.slug}`);
  // Підбірки — завжди: їхній вміст міняється щодня разом із записами, а
  // окремого сигналу «сторінка оновилась» у них немає.
  const hubs = topics.flatMap((t) => [
    `${SITE}/${t.slug}`,
    ...(t.en?.slug ? [`${SITE}/en/${t.en.slug}`] : []),
  ]);
  return [...new Set([SITE, ...hubs, ...opportunities])];
}

async function main() {
  if (!URL_ || !KEY) {
    console.error('Потрібні NEXT_PUBLIC_SUPABASE_URL і ключ Supabase');
    process.exit(1);
  }
  const since = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();
  const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('opportunities')
    .select('slug, updated_at')
    .eq('status', 'active')
    // Дублі не надсилаємо: вони віддають 301 на оригінал, і Bing отримав би
    // адресу-перенаправлення замість сторінки (перевірка prebuild це й ловить).
    .is('canonical_slug', null)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(2000);
  if (error) { console.error(error.message); process.exit(1); }

  const urls = urlsToSubmit(data || [], TOPIC_LIST);
  console.log(`Змінених можливостей за ${HOURS} год: ${(data || []).length}`);
  console.log(`Надсилаю адрес усього: ${urls.length} (сторінки можливостей + усі підбірки + головна)`);

  if (CONFIRM !== 'SEND') {
    console.log('\n--- СУХИЙ ПРОГІН: нічого не надіслано (CONFIRM=SEND, щоб надіслати) ---');
    for (const u of urls.slice(0, 8)) console.log('  ·', u);
    return;
  }

  const body = indexNowBody(urls);
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200 — прийнято, 202 — прийнято, ключ ще перевіряється. Обидва нормальні.
  if (res.status === 200 || res.status === 202) {
    console.log(`\n✓ Bing прийняв ${urls.length} адрес (HTTP ${res.status})`);
    return;
  }
  console.error(`\n✗ Bing відповів ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('indexnow.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
