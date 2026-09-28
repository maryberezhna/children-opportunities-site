// Разова перевірка всіх живих можливостей з цитатами (Марія, 28.09.2026:
// «51 запис із 612 має цитати-докази, решта — на довірі до моделі — оце треба
// виправити», «перевіряй усі можливості»).
//
// Агенти прочитали сторінку-джерело кожного запису, дістали дослівні цитати
// (перевірені тим самим правилом, що й scraper/proof.py quote_in_text) і
// позначили, де сторінка суперечить запису. Тут ці результати пишуться в базу:
// цитати зливаються в evidence, поля виправляються, минуле закривається,
// «не для дітей» іде в чергу. Лише для записів, які досі 'active', і лише
// один раз: слід MARK в admin_comment не дає застосувати двічі.
//
// Живе лише в службовій гілці data/evidence-check-2026-09-28, у main не йде.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'scripts/data/evidence-2026-09-28';
const MARK = '28.09.2026 перевірка з цитатами';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const total = { applied: 0, already: 0, notActive: 0, missing: 0, failed: 0 };
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ops.json')).sort()) {
  const ops = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8'));
  const c = { applied: 0, already: 0, notActive: 0, missing: 0, failed: 0 };
  for (const op of ops) {
    const { data: row, error: readErr } = await sb.from('opportunities')
      .select('id, status, evidence, admin_comment').eq('id', op.id).maybeSingle();
    if (readErr) { c.failed += 1; console.error(op.id, readErr.message); continue; }
    if (!row) { c.missing += 1; continue; }
    if (String(row.admin_comment || '').includes(MARK)) { c.already += 1; continue; }
    if (row.status !== 'active') { c.notActive += 1; continue; }
    const patch = {
      ...(op.set || {}),
      admin_comment: [row.admin_comment, op.trace].filter(Boolean).join(' · '),
      updated_at: new Date().toISOString(),
    };
    if (op.evidence && Object.keys(op.evidence).length) {
      patch.evidence = { ...(row.evidence && typeof row.evidence === 'object' ? row.evidence : {}), ...op.evidence };
    }
    if (op.status) patch.status = op.status;
    const { error } = await sb.from('opportunities').update(patch).eq('id', op.id).eq('status', 'active');
    if (error) { c.failed += 1; console.error(op.id, error.message); } else c.applied += 1;
  }
  console.log(file, JSON.stringify(c));
  for (const k of Object.keys(total)) total[k] += c[k];
}
console.log('РАЗОМ', JSON.stringify(total));
if (total.failed) process.exit(1);
