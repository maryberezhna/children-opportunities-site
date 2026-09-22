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

// Дублі (заповнений canonical_slug) у зведення не беремо: вони віддають 301
// на оригінал, тож у переліку роботи це зайвий рядок і зайва одиниця в
// лічильнику. Той самий фільтр, що й на сайті — його стереже prebuild
// (scripts/check-catalogue-queries.mjs).
const [
  draftsTotal, draftsHot, deadLinkLive, overdueChecks, dueToday, closedYesterday, needsHuman,
  inReview, reviewTop, notesOpen, notesTop,
] = await Promise.all([
  count(base().select('id', { count: 'exact', head: true }).eq('status', 'draft')),
  // Чернетка з дедлайном на цьому тижні — найдорожча втрата: поки вона лежить,
  // подача закривається.
  rows(base().select('title, slug, deadline').eq('status', 'draft')
    .not('deadline', 'is', null).gte('deadline', today).lte('deadline', inDays(7))
    .order('deadline', { ascending: true }).limit(5)),
  // Лінк не відповідає, але подача ще попереду: найімовірніше, сайт блокує
  // саме IP GitHub Actions (verify-links лишає такий запис активним).
  rows(base().select('title, source_url').eq('status', 'active').is('canonical_slug', null)
    .eq('link_status', 'dead').limit(5)),
  // Протермінованою вважаємо перевірку, що чекає ДОВШЕ за добу. 21.09.2026
  // зведення кричало «прогін впав» через 12 літніх програм, яким інша сесія
  // поставила перевірку на 20.09 — уже після того, як прогін того дня
  // відбіг. Вони просто чекали сьогоднішнього. Зведення приходить раніше
  // за прогін (розклад GitHub), тож учорашні дати — норма, а не збій.
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'active').is('canonical_slug', null).lt('recheck_at', inDays(-1))),
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'active').is('canonical_slug', null).eq('recheck_at', today)),
  count(base().select('id', { count: 'exact', head: true })
    .eq('status', 'closed').gte('updated_at', `${inDays(-1)}T00:00:00Z`)),
  count(supabase.from('opportunity_suggestions').select('id', { count: 'exact', head: true })
    .eq('status', 'needs_human')),
  // Карантин: класифікатор вагався (0.25–0.55). Саме там губилось рідкісне
  // закордонне, описане скупо. Без цього рядка черга росла б мовчки.
  count(supabase.from('raw_items').select('id', { count: 'exact', head: true })
    .eq('status', 'review').is('reviewed_at', null)),
  // Верх черги — СВІЖЕ за тиждень, від найвпевненішого. Вʼюха v_raw_review
  // сортує за trust_tier джерела, і 21.09 нагорі стояли курси Дія.Освіти й
  // гурток вимкненого Харківського палацу. Свіже приходить лише з увімкнених
  // джерел і ще має живий дедлайн — тобто саме це варто розібрати першим.
  rows(supabase.from('raw_items').select('raw_title, source_url, canonical_url, confidence, source_name')
    .eq('status', 'review').is('reviewed_at', null)
    .gte('fetched_at', `${inDays(-7)}T00:00:00Z`)
    .order('confidence', { ascending: false }).order('fetched_at', { ascending: false })
    .limit(3)),
  // Коментарі модератора без відповіді: людина спитала й чекає. Кнопка
  // «Залишити коментар» у черзі (22.09.2026) — без цього рядка питання
  // лежало б у базі, і ніхто б його не прочитав.
  count(supabase.from('moderation_notes').select('id', { count: 'exact', head: true })
    .eq('action', 'comment').is('resolved_at', null)),
  rows(supabase.from('moderation_notes').select('body, created_at, opportunities(title)')
    .eq('action', 'comment').is('resolved_at', null)
    .order('created_at', { ascending: true }).limit(5)),
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
  blocks.push(`⏳ <b>Перевірки запізнюються довше за добу:</b> ${overdueChecks}. `
    + 'Прогін або впав, або не встигає — глянь останній запуск «Планових перевірок».');
}

if (inReview) {
  blocks.push([
    `🔍 <b>Класифікатор вагається</b> — ${inReview} у карантині`,
    ...(reviewTop.length
      ? reviewTop.map((r) => `• ${esc(cut(r.raw_title || r.source_name))} — ${r.confidence ?? '?'}\n  ${esc(r.canonical_url || r.source_url || '')}`)
      : ['За тиждень нового немає — у черзі лише старе.']),
    'Кожне «так» звідси — можливість, яку ми інакше втратили б мовчки.',
  ].join('\n'));
}

if (notesOpen) {
  blocks.push([
    `💬 <b>Коментарі модератора без відповіді</b> (${notesOpen})`,
    ...notesTop.map((n) => `• ${esc(cut(n.opportunities?.title || '—', 48))}: ${esc(cut(n.body, 90))}`),
    'Обробити: попросити Claude «обробити коментарі модератора» — див. CLAUDE.md.',
  ].join('\n'));
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
