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
  .select('id, slug, title, opportunity_type, deadline, cost_type, source_url')
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

// --- Optional: notify Telegram if there are items due within 7 days ---
if (NOTIFY && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !DRY_RUN) {
  const urgent = dueSoon.filter((r) => r.daysLeft <= 7);
  if (urgent.length > 0) {
    const lines = [`⏰ <b>Дедлайни на цьому тижні (${urgent.length})</b>`, ''];
    for (const r of urgent) {
      const url = `https://dityam.com.ua/o/${r.slug}`;
      const tag = r.daysLeft === 0 ? 'сьогодні' : r.daysLeft === 1 ? 'завтра' : `за ${r.daysLeft} дн.`;
      lines.push(`• <a href="${url}">${escapeHtml(r.title)}</a> — <b>${tag}</b>`);
    }
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
      if (json.ok) console.log(`📨 Telegram digest sent (${urgent.length} urgent items).`);
      else console.error(`Telegram error: ${json.description}`);
    } catch (e) {
      console.error(`Telegram send failed: ${e.message}`);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

process.exit(failed > 0 ? 1 : 0);
