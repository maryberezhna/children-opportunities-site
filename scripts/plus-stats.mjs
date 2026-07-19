// Статистика платного бота Dityam+ → в адмін-чат (через головний бот).
// Env: NEXT_PUBLIC_SUPABASE_URL(→SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//      TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, WAYFORPAY_AMOUNT.
// Прапорець: --dry-run — надрукувати, нічого не слати.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PRICE = Number(process.env.WAYFORPAY_AMOUNT || 79);
const DRY = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !KEY) { console.error('Missing Supabase env'); process.exit(1); }

async function fetchRows() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/digest_subscribers?select=status,channel,age_bands,created_at`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) { console.error('Supabase error', r.status, await r.text()); process.exit(1); }
  return r.json();
}

const rows = await fetchRows();
const now = Date.now();
const DAY = 86400000;
const cnt = (f) => rows.filter(f).length;

const active = cnt((r) => r.status === 'active');
const pending = cnt((r) => r.status === 'pending');
const paused = cnt((r) => r.status === 'paused');
const unsub = cnt((r) => r.status === 'unsubscribed');
const filled = cnt((r) => (r.age_bands || []).length > 0);
const new7 = cnt((r) => now - new Date(r.created_at).getTime() <= 7 * DAY);
const newActive7 = cnt((r) => r.status === 'active' && now - new Date(r.created_at).getTime() <= 7 * DAY);
const mrr = active * PRICE;

const msg = [
  '📊 <b>Dityam+ — статистика за тиждень</b>',
  '',
  `👥 Усього профілів: <b>${rows.length}</b>`,
  `✅ Активні (платні): <b>${active}</b>`,
  `⏳ Очікують оплату: <b>${pending}</b>`,
  `⏸ Призупинені: <b>${paused}</b>`,
  `🚫 Відписались: <b>${unsub}</b>`,
  '',
  `🆕 За 7 днів: <b>${new7}</b> нових (з них оплатили: <b>${newActive7}</b>)`,
  `📋 Заповнили профіль дитини: <b>${filled}</b>`,
  '',
  `💰 Орієнтовний дохід/міс: <b>~${mrr} грн</b> <i>(${active} × ${PRICE})</i>`,
].join('\n');

if (DRY || !TOKEN || !ADMIN) {
  console.log(msg.replace(/<\/?[bi]>/g, ''));
  if (!TOKEN || !ADMIN) console.log('\n(не надіслано: TELEGRAM_BOT_TOKEN або TELEGRAM_ADMIN_CHAT_ID не задано)');
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: ADMIN, text: msg, parse_mode: 'HTML', disable_web_page_preview: true }),
});
const j = await res.json();
console.log(j.ok ? 'Sent ✅' : `Failed: ${JSON.stringify(j)}`);
