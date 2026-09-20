// Ранкове зведення в адмін-чат: одне повідомлення про те, що чекає РІШЕННЯ.
//
// Привід (20.09.2026). Двічі за день проблема спливла лише тому, що Марія
// випадково спитала: чернетка «Діалог із Радою Європи» горіла дедлайном 20.09
// і про неї ніхто не знав, а NASA Space Apps тихо зник із каталогу через
// мертвий лінк. Дані були в базі — бракувало того, хто щоранку гляне.
//
// Принцип: НЕ звіт про здоровʼя (для цього є /admin/metrics), а список того,
// що без людини не зрушить. Якщо таких пунктів немає — повідомлення не
// надсилається взагалі: тиша теж інформація.
import { createClient } from '@supabase/supabase-js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.env.DRY_RUN === 'true';
const SITE = process.env.SITE_URL || 'https://dityam.com.ua';

if (!SB_URL || !SB_KEY || (!DRY && (!TOKEN || !CHAT))) {
  console.error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_KEY / TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const today = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n = 58) => (String(s).length > n ? `${String(s).slice(0, n - 1).trimEnd()}…` : String(s));

async function rows(build) {
  const { data, error } = await build;
  if (error) throw new Error(error.message);
  return data || [];
}
async function count(build) {
  const { count: c, error } = await build;
  if (error) throw new Error(error.message);
  return c || 0;
}

const base = () => supabase.from('opportunities');

const [
  draftsTotal, draftsHot, deadLinkLive, overdueChecks, dueToday, closedYesterday, needsHuman,
] = await Promise.all([
  count(base().select('id', { count: 'exact', head: true }).eq('status', 'draft')),
  // Чернетка з дедлайном на цьому тижні — найдорожча втрата: поки вона лежить,
  // подача закривається.
  rows(base().select('title, slug, deadline').eq('status', 'draft')
    .not('deadline', 'is', null).gte('deadline', today).lte('deadline', inDays(7))
    .order('deadline', { ascending: true }).limit(5)),
  // Лінк не відповідає, але подача ще попереду: найімовірніше, сайт блокує
  // саме IP GitHub Actions (verify-links лишає такий запис активним).
  rows(base().select('title, source_url').eq('status', 'active').eq('link_status', 'dead').limit(5)),
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'active').lt('recheck_at', today)),
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'active').eq('recheck_at', today)),
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'closed').gte('updated_at', `${inDays(-1)}T00:00:00Z`)),
  count(supabase.from('opportunity_suggestions').select('id', { count: 'exact', head: true })
    .eq('status', 'needs_human')),
]);

const blocks = [];

if (draftsHot.length) {
  blocks.push([
    `🔥 <b>Чернетки, у яких горить дедлайн</b> (${draftsHot.length})`,
    ...draftsHot.map((d) => `• ${esc(cut(d.title))} — до ${d.deadline}`),
    'Опублікувати або закрити — інакше подача мине, поки картка лежить.',
  ].join('\n'));
}

if (deadLinkLive.length) {
  blocks.push([
    `🔗 <b>Лінк не відповідає, але подача попереду</b> (${deadLinkLive.length})`,
    ...deadLinkLive.map((d) => `• ${esc(cut(d.title))}\n  ${esc(d.source_url || '')}`),
    'Перевір адресу руками: сайти часто блокують саме IP GitHub.',
  ].join('\n'));
}

if (overdueChecks) {
  blocks.push(`⏳ <b>Планові перевірки протерміновані:</b> ${overdueChecks}. `
    + 'Це означає, що нічний прогін не встигає або впав.');
}

if (needsHuman) {
  blocks.push(`✉️ <b>Пропозиції від людей без відповіді:</b> ${needsHuman}.`);
}

// Тихий рядок унизу: він не вимагає дій, але показує, що система жива.
const tail = `Чернеток усього: ${draftsTotal} · перевірок сьогодні: ${dueToday} · закрито вчора: ${closedYesterday}`;

if (!blocks.length) {
  console.log(`Нічого не потребує рішення. ${tail}`);
  process.exit(0);
}

const text = ['☀️ <b>Що потребує рішення</b>', '', ...blocks, '', tail].join('\n\n');

if (DRY) {
  console.log(text);
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: '📋 Відкрити адмінку', url: `${SITE}/admin` }]] },
  }),
});
const json = await res.json();
console.log(json.ok ? `Зведення надіслано ✅ (${blocks.length} пунктів)` : `Failed: ${JSON.stringify(json)}`);
process.exit(json.ok ? 0 : 1);
