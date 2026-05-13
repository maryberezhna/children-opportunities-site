import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const PERIOD_DAYS = Number(process.env.PERIOD_DAYS || 7);
const TOP_N = Number(process.env.TOP_N || 5);
const DRY_RUN = process.env.DRY_RUN === 'true';

const required = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_ADMIN_CHAT_ID: ADMIN_CHAT_ID,
};
for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(d) {
  const months = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
    'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sinceDate = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
const sinceIso = sinceDate.toISOString();

const { data: rows, error } = await supabase
  .from('opportunity_feedback')
  .select('value, telegram_user_id, opportunity_id, updated_at, opportunities(title, slug)')
  .gte('updated_at', sinceIso);

if (error) {
  console.error('Supabase error:', error);
  process.exit(1);
}

const byOpp = new Map();
const userSet = new Set();
let totalYes = 0;
let totalNo = 0;

for (const r of rows || []) {
  userSet.add(r.telegram_user_id);
  const key = r.opportunity_id;
  if (!byOpp.has(key)) {
    byOpp.set(key, {
      id: key,
      title: r.opportunities?.title || '(без назви)',
      slug: r.opportunities?.slug || null,
      yes: 0,
      no: 0,
    });
  }
  const agg = byOpp.get(key);
  if (r.value === 'yes') { agg.yes += 1; totalYes += 1; }
  else if (r.value === 'no') { agg.no += 1; totalNo += 1; }
}

const all = [...byOpp.values()];
all.forEach((r) => { r.score = r.yes - r.no; r.total = r.yes + r.no; });

const totalVotes = totalYes + totalNo;
const totalPosts = all.length;

if (totalVotes === 0) {
  const empty = `📊 <b>Звіт за останні ${PERIOD_DAYS} дн.</b> (${formatDate(sinceDate)} – ${formatDate(new Date())})\n\nГолосів немає 🤷`;
  await send(empty);
  console.log('No feedback in window. Sent empty digest.');
  process.exit(0);
}

const topYes = [...all]
  .filter((r) => r.yes > 0)
  .sort((a, b) => b.yes - a.yes || b.score - a.score)
  .slice(0, TOP_N);

const topNo = [...all]
  .filter((r) => r.no > 0)
  .sort((a, b) => b.no - a.no || a.score - b.score)
  .slice(0, TOP_N);

const lines = [];
lines.push(`📊 <b>Звіт за ${PERIOD_DAYS} дн.</b> · ${formatDate(sinceDate)} – ${formatDate(new Date())}`);
lines.push('');
lines.push(`👥 Юзерів: <b>${userSet.size}</b> · 🗳 Голосів: <b>${totalVotes}</b> (👍 ${totalYes} / 👎 ${totalNo})`);
lines.push(`📦 Постів із реакціями: <b>${totalPosts}</b>`);
lines.push('');

const renderRow = (r, kind) => {
  const link = r.slug
    ? `<a href="${SITE_URL}/o/${r.slug}">${escapeHtml(r.title)}</a>`
    : escapeHtml(r.title);
  return `${kind === 'yes' ? '👍' : '👎'} ${r.yes}/${r.no} — ${link}`;
};

if (topYes.length) {
  lines.push(`<b>🔥 Топ "цікаво"</b>`);
  topYes.forEach((r) => lines.push(renderRow(r, 'yes')));
  lines.push('');
}

if (topNo.length) {
  lines.push(`<b>❄️ Топ "не цікаво"</b>`);
  topNo.forEach((r) => lines.push(renderRow(r, 'no')));
}

const message = lines.join('\n');

await send(message);
console.log(`Digest sent: ${totalVotes} votes from ${userSet.size} users on ${totalPosts} posts.`);

async function send(text) {
  if (DRY_RUN) {
    console.log('--- DRY RUN ---');
    console.log(text);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`Telegram API error: ${json.error_code} ${json.description}`);
    process.exit(1);
  }
}
