/**
 * Топ-3 можливості тижня.
 *
 * Навіщо правило, а не смак. Ручна добірка щотижня — це задача, яку легко
 * пропустити, а пропущена вона не зникає: на сайті висить позаминула трійка
 * з підписом «тижня». Тому обирає правило, а перебити його можна руками —
 * поставивши поточний тиждень у featured_week з адмінки.
 *
 * Що вважаємо вартим тижня:
 *   • безкоштовна — трійка тижня не повинна коштувати грошей;
 *   • подавати ще можна: 3–30 днів до дедлайну. Менше трьох — людина не
 *     встигне зібрати документи, більше тридцяти — це не «цього тижня»;
 *   • запис повний: є місто (або онлайн) і людський опис. Порожня картка
 *     нагорі списку виглядає як помилка, а не як рекомендація;
 *   • ширший вік — більшій кількості родин підходить;
 *   • три різні типи, якщо виходить: три олімпіади поспіль — не добірка.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (звіт), DRY_RUN=true.
 */
import { createClient } from '@supabase/supabase-js';
import { isoWeek } from '../lib/week.js';
import { cutTitle } from '../lib/text.js';
import { selectWeeklyTop, topWeekEligible, day, MIN_DAYS, MAX_DAYS } from '../lib/weekly-top.js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!URL_ || !KEY) {
  console.error('Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const tg = async (text) => {
  if (!BOT || !CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML',
                             disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('telegram:', e.message);
  }
};

async function main() {
  const week = isoWeek();
  const today = day(new Date().toISOString());

  const { data, error } = await sb
    .from('opportunities')
    .select('id, slug, title, summary, details, cities, age_from, age_to, deadline, opportunity_type, cost_type, featured_week, admin_comment, status, timing_kind, recurrence, season_months, event_start_date, event_end_date, results_date')
    .eq('status', 'active')
    .is('canonical_slug', null)
    .eq('cost_type', 'free')
    .not('deadline', 'is', null);
  if (error) throw error;

  // Відмічені вручну — окремим запитом і БЕЗ фільтра вартості: вибірка вище
  // бере лише безкоштовні, і платний партнерський запис у неї не потрапляв.
  const { data: pinnedRows, error: pinErr } = await sb
    .from('opportunities')
    .select('id, slug, title, summary, details, cities, age_from, age_to, deadline, opportunity_type, cost_type, featured_week, admin_comment, status, timing_kind, recurrence, season_months, event_start_date, event_end_date, results_date')
    .eq('status', 'active')
    .is('canonical_slug', null)
    .eq('featured_week', week);
  if (pinErr) throw pinErr;

  // Відмічене вручну теж має бути відкритим для подачі: 30.09.2026 у блоці
  // висів закріплений «Щорічно — стежте за новим набором», куди цього сезону
  // вже не подати. Знімаємо позначку, а не просто ховаємо: інакше вона
  // висітиме в базі й повернеться наступного прогону.
  const todayIso = new Date().toISOString().slice(0, 10);
  const all = pinnedRows || [];
  const pinned = all.filter((o) => topWeekEligible(o, todayIso));
  const stalePins = all.filter((o) => !pinned.includes(o));
  console.log(`Тиждень ${week}. Вручну відмічено: ${all.length}`
    + (stalePins.length ? `, з них закрито для подачі: ${stalePins.length}` : ''));
  for (const o of stalePins) console.log(`  ✗ знято: ${o.title.slice(0, 70)}`);

  const picked = selectWeeklyTop({ free: data || [], pinned, today });

  if (!picked.length) {
    console.log('Кандидатів немає — позначку цього тижня не ставимо.');
    await tg(`⭐ <b>Топ тижня ${week}</b>\n\nКандидатів немає: жодної безкоштовної можливості з дедлайном через ${MIN_DAYS}–${MAX_DAYS} днів.`);
    return;
  }

  console.log(`\nТрійка тижня ${week}:`);
  for (const o of picked) {
    const how = o.featured_week === week ? 'вручну' : `правило, ${o.days} дн. до дедлайну`;
    console.log(`  • ${o.title.slice(0, 70)} — ${how}`);
  }

  if (DRY) {
    console.log('\nDRY_RUN — нічого не записано.');
    return;
  }

  // Знімаємо позначку з чужих записів цього тижня (напр. після зміни правила),
  // лишаючи ручні. Минулі тижні не чіпаємо: це історія добірок.
  const keep = picked.map((o) => o.id);
  const { data: stale } = await sb.from('opportunities')
    .select('id').eq('featured_week', week);
  const drop = (stale || []).map((r) => r.id).filter((id) => !keep.includes(id));
  if (drop.length) {
    await sb.from('opportunities').update({ featured_week: null }).in('id', drop);
    console.log(`Знято позначку з ${drop.length} записів минулого прогону.`);
  }

  for (const o of picked) {
    if (o.featured_week === week) continue;  // ручний уже стоїть
    await sb.from('opportunities').update({
      featured_week: week,
      admin_comment: `${o.admin_comment ? `${o.admin_comment} · ` : ''}топ тижня ${week} (правило)`.slice(0, 500),
    }).eq('id', o.id);
  }

  const lines = picked.map((o, i) =>
    `${i + 1}. <a href="https://dityam.com.ua/o/${o.slug}">${cutTitle(o.title, 80)}</a>`
    + (o.featured_week === week ? ' — <i>твій вибір</i>' : ` — ${o.days} дн. до дедлайну`));
  await tg(`⭐ <b>Топ-3 тижня ${week}</b>\n\n${lines.join('\n')}\n\nПеребити можна в адмінці: поле «Топ тижня».`);
  console.log('\nЗаписано.');
}

main().catch((e) => { console.error(e); process.exit(1); });
