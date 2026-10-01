/**
 * Зняти запис із сайту й повернути в чернетки.
 *
 * Навіщо окремо від «Не підходить». Відхилення — це «нам таке не треба», і
 * воно незворотне (archived, рішення 28.09.2026). А тут інше: можливість може
 * бути цілком справжньою, просто показувати її в теперішньому вигляді не
 * можна — наприклад, джерелом стоїть чужий Telegram-канал (правило Марії
 * 27.09.2026). Такий запис має піти в чергу на перевірку, а не зникнути.
 *
 * 01.10.2026: саме так знімали три записи, що пройшли повз правило, бо
 * перевірки в коді не існувало.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IDS (через кому),
 *      COMMENT (чому — обовʼязково), ACTOR, CONFIRM=UNPUBLISH.
 */
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IDS = (process.env.IDS || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
const COMMENT = (process.env.COMMENT || '').trim();
const ACTOR = (process.env.ACTOR || 'скрипт').trim();
const CONFIRM = process.env.CONFIRM === 'UNPUBLISH';

if (!URL_ || !KEY) { console.error('Потрібні ключі Supabase'); process.exit(1); }
if (!IDS.length) { console.error('Потрібен IDS'); process.exit(1); }
// Без причини запис повернеться на сайт тим самим шляхом, яким пішов.
if (COMMENT.length < 10) { console.error('Потрібен COMMENT — чому знімаємо'); process.exit(1); }

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
let done = 0;

for (const id of IDS) {
  const { data: row } = await sb.from('opportunities')
    .select('id, title, status, source_url').eq('id', id).maybeSingle();
  if (!row) { console.log(`✗ ${id} — немає такого запису`); continue; }
  if (row.status !== 'active') { console.log(`✗ ${row.title.slice(0, 60)} — статус «${row.status}», уже не на сайті`); continue; }

  console.log(`${CONFIRM ? '→' : '·'} ${row.title.slice(0, 66)}`);
  console.log(`   ${row.source_url || '—'}`);
  if (!CONFIRM) continue;

  const { error } = await sb.from('opportunities')
    .update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.log(`   ✗ ${error.message}`); continue; }
  await sb.from('moderation_notes').insert({
    opportunity_id: id, body: `Знято з сайту в чернетки: ${COMMENT}`, action: 'skip',
    resolved_at: null,
  });
  try {
    await sb.from('moderation_actions').insert({ opportunity_id: id, action: 'remove', actor: ACTOR });
  } catch { /* журнал мовчить і нічого не ламає */ }
  done += 1;
}
console.log(CONFIRM ? `\nЗнято з сайту: ${done} із ${IDS.length}` : `\nСУХИЙ ПРОГІН — нічого не змінено. Записів: ${IDS.length}`);
