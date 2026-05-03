import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANNUAL_TYPES = new Set([
  'olympiad', 'competition', 'exchange', 'scholarship',
  'festival', 'camp', 'grant', 'study_abroad',
]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const today = new Date();
today.setHours(0, 0, 0, 0);

const soonCutoff = new Date(today);
soonCutoff.setDate(today.getDate() + 14);

const { data, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, opportunity_type, deadline, source_url')
  .not('deadline', 'is', null)
  .lte('deadline', soonCutoff.toISOString().slice(0, 10));

if (error) {
  console.error('Supabase error:', error);
  process.exit(1);
}

const expiredPermanent = [];
const expiredAnnual = [];
const dueSoon = [];

for (const row of data || []) {
  const deadline = new Date(row.deadline);
  deadline.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    if (ANNUAL_TYPES.has(row.opportunity_type)) expiredAnnual.push({ ...row, days });
    else expiredPermanent.push({ ...row, days });
  } else {
    dueSoon.push({ ...row, days });
  }
}

const lines = [];
const stamp = today.toISOString().slice(0, 10);
lines.push(`Deadline check — ${stamp}`);
lines.push('='.repeat(60));
lines.push('');

lines.push(`🔴 EXPIRED, NON-ANNUAL (review/delete): ${expiredPermanent.length}`);
for (const r of expiredPermanent) {
  lines.push(`  ${r.deadline}  [${-r.days}d ago]  ${r.title}`);
  lines.push(`    type=${r.opportunity_type}  slug=${r.slug}`);
}
lines.push('');

lines.push(`🟡 EXPIRED, ANNUAL (UI hides chip; consider deadline refresh): ${expiredAnnual.length}`);
for (const r of expiredAnnual) {
  lines.push(`  ${r.deadline}  [${-r.days}d ago]  ${r.title}  (${r.opportunity_type})`);
}
lines.push('');

lines.push(`🟢 DUE WITHIN 14 DAYS: ${dueSoon.length}`);
for (const r of dueSoon.sort((a, b) => a.days - b.days)) {
  lines.push(`  ${r.deadline}  [in ${r.days}d]  ${r.title}`);
}

const report = lines.join('\n');
console.log(report);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, `deadline-report-${stamp}.txt`), report, 'utf8');

if (expiredPermanent.length > 0) {
  console.warn(`\n⚠️  ${expiredPermanent.length} non-annual expired program(s) need attention.`);
  process.exit(0); // not failing the build — just reporting
}
