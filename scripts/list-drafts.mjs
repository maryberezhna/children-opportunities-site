/**
 * Показати чернетки — щоб із ними можна було працювати ззовні адмінки.
 *
 * Навіщо. 30.09.2026 у черзі лежало 174 чернетки, і Марія попросила
 * дорозвідати й опублікувати те, що вдасться. Але anon-ключ чернеток не
 * бачить (RLS, 28.09.2026), тож ні прочитати їх, ні зрозуміти, чого саме в
 * них бракує, зі свого боку неможливо. Цей скрипт друкує в лог воркфлоу те,
 * що потрібно для розвідки: що за запис, куди йти по факти й чого бракує до
 * пʼяти обовʼязкових полів.
 *
 * Лише читає. Нічого не змінює й нікому не пише.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      LIMIT (скільки показати, типово 40), ONLY (підрядок у назві чи джерелі).
 */
import { createClient } from '@supabase/supabase-js';
import { missingRequired } from '../lib/required.js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIMIT = Number(process.env.LIMIT || 40);
const ONLY = (process.env.ONLY || '').trim().toLowerCase();

if (!URL_ || !KEY) {
  console.error('Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from('opportunities')
  .select('id, slug, title, summary, source, source_url, opportunity_type, aid_type, '
    + 'age_from, age_to, cost_type, price_note, format, cities, countries, deadline, '
    + 'event_start_date, event_end_date, timing_kind, admin_comment, created_at')
  .eq('status', 'draft')
  .order('created_at', { ascending: false })
  .limit(1000);
if (error) throw error;

const rows = (data || []).filter((o) => !ONLY
  || `${o.title} ${o.source || ''} ${o.source_url || ''}`.toLowerCase().includes(ONLY));

// Спершу ті, у кого горить дедлайн: саме вони згорають, поки лежать.
const today = new Date().toISOString().slice(0, 10);
const rank = (o) => (o.deadline && o.deadline >= today ? 0 : 1);
rows.sort((a, b) => rank(a) - rank(b)
  || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));

console.log(`Чернеток: ${rows.length}${ONLY ? ` (фільтр «${ONLY}»)` : ''}. Показую ${Math.min(LIMIT, rows.length)}.\n`);
for (const o of rows.slice(0, LIMIT)) {
  const miss = missingRequired(o);
  console.log(`— ${o.title}`);
  // id — для publish-draft, slug — для patch-opportunity: вони шукають запис
  // по-різному, і без обох доводиться бігати по колу.
  console.log(`   id: ${o.id}`);
  console.log(`   slug: ${o.slug}`);
  console.log(`   джерело: ${o.source_url || '—'}`);
  console.log(`   тип: ${o.opportunity_type || '—'} | вік: ${o.age_from ?? '—'}–${o.age_to ?? '—'}`
    + ` | вартість: ${o.cost_type || '—'} | формат: ${o.format || '—'}`
    + ` | місце: ${(o.cities || []).join(', ') || '—'}`);
  console.log(`   дедлайн: ${o.deadline || '—'} | подія: ${o.event_start_date || '—'} | вид: ${o.timing_kind || '—'}`);
  console.log(`   БРАКУЄ: ${miss.length ? miss.join(', ') : 'нічого — можна публікувати'}`);
  if (o.admin_comment) console.log(`   нотатка: ${String(o.admin_comment).slice(0, 220)}`);
  console.log('');
}
