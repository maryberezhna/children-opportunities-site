/**
 * Daily deadline check.
 *
 * For every opportunity with deadline <= today:
 * - If type is "annual" (olympiads, contests, scholarships, camps, festivals,
 *   exchanges, grants, study_abroad) — clear `deadline = NULL`. The next scrape
 *   will repopulate with this year's date when the source publishes it. We do
 *   NOT try to add +1 year ourselves because the actual deadline often shifts.
 * - Otherwise — mark `cost_type = 'closed'` so UI hides the "apply now" CTA.
 *
 * Also prints (and writes to artifact) a report with stats and the items that
 * are due within the next 7 / 30 days.
 *
 * Optionally posts a short summary to Telegram if TELEGRAM_BOT_TOKEN +
 * TELEGRAM_CHAT_ID are set AND --notify flag is passed (or NOTIFY=true env).
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (UPDATE bypasses RLS — anon key won't work)
 * Optional:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NOTIFY=true
 *   DRY_RUN=true   → print actions without writing to DB
 */
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANNUAL_TYPES = new Set([
  'olympiad', 'competition', 'exchange', 'scholarship',
  'festival', 'camp', 'grant', 'study_abroad',
]);

const TYPE_LABELS = {
  course: 'Курс',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  club: 'Гурток',
  exchange: 'Обмін',
  camp: 'Табір',
  study_abroad: 'Навчання за кордоном',
  scholarship: 'Стипендія',
  allowance: 'Виплата',
  grant: 'Грант',
  festival: 'Фестиваль',
  sport_event: 'Спорт',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NOTIFY = process.env.NOTIFY === 'true' || process.argv.includes('--notify');
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const today = new Date();
today.setHours(0, 0, 0, 0);
const stamp = today.toISOString().slice(0, 10);

// Look 30 days ahead so we also produce a "due soon" list for the report.
const lookahead = new Date(today);
lookahead.setDate(today.getDate() + 30);

const { data, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, deadline, cost_type, source_url')
  .not('deadline', 'is', null)
  .lte('deadline', lookahead.toISOString().slice(0, 10));

if (error) {
  console.error('Supabase select error:', error);
  process.exit(1);
}

const expiredAnnual = [];      // → deadline = NULL
const expiredOneShot = [];     // → cost_type = 'closed'
const dueSoon = [];            // 0..30 days, just for report

for (const row of data || []) {
  const dl = new Date(row.deadline);
  dl.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((dl - today) / 86400000);

  if (daysLeft < 0) {
    if (ANNUAL_TYPES.has(row.opportunity_type)) expiredAnnual.push({ ...row, daysLeft });
    else if (row.cost_type !== 'closed') expiredOneShot.push({ ...row, daysLeft });
    // already-closed one-shots: skip silently
  } else {
    dueSoon.push({ ...row, daysLeft });
  }
}

dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);

console.log(`Deadline check — ${stamp}${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log('='.repeat(60));
console.log(`Found: ${expiredAnnual.length} annual to refresh, ${expiredOneShot.length} one-shot to close, ${dueSoon.length} due soon.`);
console.log('');

let archived = 0;
let refreshed = 0;
let failed = 0;

if (expiredOneShot.length > 0) {
  console.log(`🔴 ARCHIVING ${expiredOneShot.length} expired one-shot opportunities (cost_type='closed'):`);
  for (const r of expiredOneShot) {
    console.log(`  ${r.deadline}  [${-r.daysLeft}d ago]  ${r.title}`);
    if (!DRY_RUN) {
      const { error: e } = await supabase
        .from('opportunities')
        .update({ cost_type: 'closed', updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) { failed += 1; console.error(`    ✗ ${e.message}`); }
      else archived += 1;
    }
  }
  console.log('');
}

if (expiredAnnual.length > 0) {
  console.log(`🟡 CLEARING deadlines on ${expiredAnnual.length} annual events (next scrape will refill):`);
  for (const r of expiredAnnual) {
    console.log(`  ${r.deadline}  [${-r.daysLeft}d ago]  ${r.title}  (${r.opportunity_type})`);
    if (!DRY_RUN) {
      const { error: e } = await supabase
        .from('opportunities')
        .update({ deadline: null, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) { failed += 1; console.error(`    ✗ ${e.message}`); }
      else refreshed += 1;
    }
  }
  console.log('');
}

console.log(`🟢 DUE WITHIN 30 DAYS (${dueSoon.length}):`);
for (const r of dueSoon) {
  const tag = r.daysLeft <= 7 ? '⚡' : '  ';
  console.log(` ${tag} ${r.deadline}  [in ${r.daysLeft}d]  ${r.title}`);
}

if (!DRY_RUN) {
  console.log('');
  console.log(`Done: archived=${archived}, deadline-cleared=${refreshed}, failed=${failed}`);
}

// --- Persist artifact for GitHub Actions ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
await mkdir(outDir, { recursive: true });

const reportLines = [
  `Deadline check — ${stamp}`,
  '='.repeat(60),
  `archived=${archived}, deadline-cleared=${refreshed}, failed=${failed}, due-soon=${dueSoon.length}`,
  '',
  `Expired one-shot → archived (cost_type='closed'):`,
  ...expiredOneShot.map((r) => `  ${r.deadline} [${-r.daysLeft}d]  ${r.title}`),
  '',
  `Expired annual → deadline cleared:`,
  ...expiredAnnual.map((r) => `  ${r.deadline} [${-r.daysLeft}d]  ${r.title}`),
  '',
  `Due within 30 days:`,
  ...dueSoon.map((r) => `  ${r.deadline} [in ${r.daysLeft}d]  ${r.title}`),
];
await writeFile(join(outDir, `deadline-report-${stamp}.txt`), reportLines.join('\n'), 'utf8');

// Sun=0, Mon=1, ..., Sat=6 — index matches Date#getDay().
// Declared before sendDailyDigest's invocation so the const is initialized
// (TDZ would throw otherwise — JS hoists `const` declarations but keeps them
// uninitialized until execution reaches the declaration line).
const THEMES = [
  { // Sunday
    heading: '🧸 Сьогодні — для малюків (0-6 років)',
    description: 'Розвивальні заняття, гуртки, медична та соціальна допомога для найменших.',
    filter: (r) => r.age_from <= 6 && r.age_to <= 8,
    link: 'https://dityam.com.ua/?age=0-3,4-6',
  },
  { // Monday
    heading: '📚 Сьогодні — для школярів (7-11 років)',
    description: 'Курси, гуртки, олімпіади та конкурси для дітей молодшої школи.',
    filter: (r) => r.age_from <= 11 && r.age_to >= 7,
    link: 'https://dityam.com.ua/?age=7-11',
  },
  { // Tuesday
    heading: '🎒 Сьогодні — для підлітків (12-17 років)',
    description: 'Стажування, обміни, гранти, конкурси та літні програми для старшокласників.',
    filter: (r) => r.age_to >= 12 && r.age_from <= 17,
    link: 'https://dityam.com.ua/?age=12-14,15-17',
  },
  { // Wednesday
    heading: '🎁 Сьогодні — безкоштовні можливості',
    description: 'Програми без жодних витрат — для всіх дітей від 0 до 18 років.',
    filter: (r) => r.cost_type === 'free',
    link: 'https://dityam.com.ua/?cost=free',
  },
  { // Thursday
    heading: '🌍 Сьогодні — можливості за кордоном',
    description: 'Міжнародні обміни, навчання за кордоном та стипендії для українських дітей.',
    filter: (r) => ['exchange', 'study_abroad', 'scholarship'].includes(r.opportunity_type),
    link: 'https://dityam.com.ua/?type=exchange,study_abroad,scholarship',
  },
  { // Friday
    heading: '🎨 Сьогодні — творчість, STEM та конкурси',
    description: 'Курси, гуртки, олімпіади та конкурси для тих, хто любить творити й досліджувати.',
    filter: (r) => ['course', 'competition', 'club', 'olympiad'].includes(r.opportunity_type),
    link: 'https://dityam.com.ua/?type=course,competition,club,olympiad',
  },
  { // Saturday
    heading: '⭐ Сьогодні — нові на сайті',
    description: 'Свіжі надходження — програми, щойно додані до каталогу.',
    filter: () => true,
    sortBy: 'created_at_desc',
    link: 'https://dityam.com.ua/?sort=recent',
  },
];

// --- Optional: notify Telegram with daily digest ---
if (NOTIFY && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !DRY_RUN) {
  await sendDailyDigest();
}

async function sendDailyDigest() {
  // Section A: truly urgent — deadline 0..3 days. Top 3.
  const urgent = dueSoon
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= 3)
    .slice(0, 3);

  // Section B: themed pool — fetch all active opportunities (not closed),
  // either with no deadline or with deadline in the future.
  const todayIso = today.toISOString().slice(0, 10);
  const { data: poolData, error: poolErr } = await supabase
    .from('opportunities')
    .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, created_at')
    .eq('status', 'active')
    .or(`deadline.is.null,deadline.gte.${todayIso}`);
  if (poolErr) {
    console.error(`Pool fetch failed: ${poolErr.message}`);
    return;
  }
  const pool = (poolData || []).filter((r) => !urgent.some((u) => u.id === r.id));

  const theme = THEMES[today.getDay()];
  let themed = pool.filter(theme.filter);
  if (theme.sortBy === 'created_at_desc') {
    themed.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } else {
    themed = shuffle(themed);
  }
  themed = themed.slice(0, 3);

  if (urgent.length === 0 && themed.length === 0) {
    console.log('Nothing to post — both sections empty.');
    return;
  }

  const lines = [];
  if (urgent.length > 0) {
    lines.push(`⏰ <b>Терміново — дедлайн на днях (${urgent.length})</b>`);
    lines.push('');
    urgent.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < urgent.length - 1) lines.push('');
    });
    lines.push('');
  }
  if (themed.length > 0) {
    lines.push(`<b>${theme.heading}</b>`);
    if (theme.description) lines.push(`<i>${theme.description}</i>`);
    lines.push('');
    themed.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < themed.length - 1) lines.push('');
    });
    lines.push('');
  }
  const moreUrl = theme.link || 'https://dityam.com.ua';
  lines.push(`🔗 Більше — на <a href="${moreUrl}">dityam.com.ua</a>`);

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      console.log(`📨 Daily digest sent — urgent=${urgent.length}, themed=${themed.length} (${theme.heading}).`);
    } else {
      console.error(`Telegram error: ${json.description}`);
    }
  } catch (e) {
    console.error(`Telegram send failed: ${e.message}`);
  }
}

function ageLabel(r) {
  if (r.age_from == null || r.age_to == null) return null;
  if (r.age_from === 0 && r.age_to >= 17) return '0–18 років';
  // age_to=18 = молодіжна програма без реального ліміту до 17 → "від X р."
  if (r.age_to >= 18 && r.age_from > 0) return `від ${r.age_from} р.`;
  if (r.age_from === r.age_to) return `${r.age_from} років`;
  return `${r.age_from}–${r.age_to} років`;
}

function formatDeadlineDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatLine(r, index) {
  const url = `https://dityam.com.ua/o/${r.slug}`;
  const typeLabel = TYPE_LABELS[r.opportunity_type];
  const age = ageLabel(r);

  // Meta line — same emoji format as individual posts
  const meta = [];
  if (typeLabel) meta.push(`📚 ${typeLabel}`);
  if (age) meta.push(`👶 ${age}`);
  if (r.cost_type === 'free') meta.push('✅ Безкоштовно');
  else if (r.cost_type === 'partially_free') meta.push('З фінансуванням');

  const prefix = `${(index ?? 0) + 1}.`;
  const lines = [`${prefix} <a href="${url}"><b>${escapeHtml(r.title)}</b></a>`];
  if (meta.length) lines.push(`   ${meta.join(' · ')}`);

  // Deadline line
  if (r.daysLeft != null && r.daysLeft >= 0) {
    const tag = r.daysLeft === 0 ? 'сьогодні' : r.daysLeft === 1 ? 'завтра' : `за ${r.daysLeft} дн.`;
    lines.push(`   ⏰ Дедлайн: <b>${tag}</b>`);
  } else if (r.deadline) {
    const dl = formatDeadlineDate(r.deadline);
    if (dl) lines.push(`   ⏰ Дедлайн: <b>${dl}</b>`);
  }

  // Full description (up to 500 chars, same as individual post)
  if (r.summary) {
    const s = r.summary.replace(/\s+/g, ' ').trim();
    const sum = s.length > 500 ? `${s.slice(0, 500)}…` : s;
    lines.push(`   <i>${escapeHtml(sum)}</i>`);
  }

  return lines.join('\n');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

process.exit(failed > 0 ? 1 : 0);
