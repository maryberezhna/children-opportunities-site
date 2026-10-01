/**
 * «Не підходить» для чернетки — те саме, що кнопка в адмінці, але ззовні.
 *
 * Навіщо. 01.10.2026 Марія переглянула чергу й сказала прибрати школи, у яких
 * немає ні власного сайту, ні сторінки в соцмережі: підтвердити про них нічого
 * й ніколи не вдасться. Кнопка в адмінці на це є, але вимагає куки; скриптом
 * ззовні не було чим.
 *
 * Робить рівно те саме, що app/api/admin/review (дія reject):
 *   status → archived (не closed: closed сайт показує з «подачу закрито», і
 *            lifecycle міг би такий запис відкрити знову),
 *   moderation_notes — причина людською мовою,
 *   moderation_corrections — телеметрія для пошуку,
 *   moderation_actions — хто це зробив.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      IDS (uuid через кому), REASON (код із lib/reject-reasons.json),
 *      COMMENT (пояснення), ACTOR, CONFIRM=REJECT (без нього — лише показати).
 */
import { createClient } from '@supabase/supabase-js';
import { rejectProblem, rejectNoteBody } from '../lib/reject-reasons.js';
import { DECISION_FIELD } from '../lib/corrections.js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IDS = (process.env.IDS || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
const REASON = (process.env.REASON || '').trim();
const COMMENT = (process.env.COMMENT || '').trim();
const ACTOR = (process.env.ACTOR || 'скрипт').trim();
const CONFIRM = process.env.CONFIRM === 'REJECT';

if (!URL_ || !KEY) { console.error('Потрібні ключі Supabase'); process.exit(1); }
if (!IDS.length) { console.error('Потрібен IDS'); process.exit(1); }
const problem = rejectProblem(REASON, COMMENT);
if (problem) { console.error(`Причина не годиться: ${problem}`); process.exit(1); }

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const body = rejectNoteBody(REASON, COMMENT);
let done = 0;

for (const id of IDS) {
  const { data: row } = await sb.from('opportunities')
    .select('id, title, status, source_url').eq('id', id).maybeSingle();
  if (!row) { console.log(`✗ ${id} — немає такого запису`); continue; }
  // Лише чернетки: випадково прибрати живий запис із сайту цим скриптом не можна.
  if (row.status !== 'draft') { console.log(`✗ ${row.title.slice(0, 60)} — статус «${row.status}», не чернетка`); continue; }

  console.log(`${CONFIRM ? '→' : '·'} ${row.title.slice(0, 66)}`);
  console.log(`   ${row.source_url || '—'}`);
  if (!CONFIRM) continue;

  const { error } = await sb.from('opportunities')
    .update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.log(`   ✗ ${error.message}`); continue; }
  await sb.from('moderation_notes').insert({
    opportunity_id: id, body, action: 'skip', resolved_at: new Date().toISOString(),
  });
  try {
    await sb.from('moderation_corrections').insert({
      opportunity_id: id, field: DECISION_FIELD, before: 'draft',
      after: { action: 'reject', reason: REASON, ...(COMMENT ? { comment: COMMENT } : {}) },
      source: 'review',
    });
    await sb.from('moderation_actions').insert({ opportunity_id: id, action: 'reject', actor: ACTOR });
  } catch { /* телеметрія мовчить і нічого не ламає */ }
  done += 1;
}
console.log(CONFIRM ? `\nВідхилено: ${done} із ${IDS.length}` : `\nСУХИЙ ПРОГІН — нічого не змінено. Записів: ${IDS.length}`);
