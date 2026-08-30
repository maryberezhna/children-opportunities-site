// Щоденний знімок метрик → metrics_daily (для /admin/metrics).
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (канал @dityam_com_ua) — опційно:
//      без них знімок пишеться просто без числа підписників.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHAT_ID;
const PRICE_MONTH = Number(process.env.WAYFORPAY_AMOUNT || 179);
const PRICE_YEAR = Number(process.env.WAYFORPAY_AMOUNT_YEAR || 1490);

if (!SUPABASE_URL || !KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

async function countRows(table, filter = (q) => q, col = 'id') {
  const { count, error } = await filter(
    supabase.from(table).select(col, { count: 'exact', head: true }),
  );
  if (error) {
    console.error(`${table} count failed: ${error.message}`);
    return null;
  }
  return count ?? 0;
}

// Обвал числа підписників майже завжди означає не втечу людей, а те, що
// метрику підключили не туди. Так і сталось 19.08.2026: у воркфлоу підмінили
// TELEGRAM_CHAT_ID на TELEGRAM_ADMIN_CHAT_ID, і лічильник тиждень показував
// 2 — рівно стільки учасників в адмін-чаті. Тому не просто пишемо число, а
// звіряємо з учорашнім і кричимо в лог, якщо воно завалилось.
const MEMBERS_DROP_ALERT = 0.5;   // падіння більш ніж удвічі — підозріло

async function telegramMembers() {
  if (!BOT || !CHANNEL) return null;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT}/getChatMemberCount?chat_id=${encodeURIComponent(CHANNEL)}`,
    );
    const json = await r.json();
    if (!json.ok) {
      console.error(`getChatMemberCount failed: ${json.description || 'unknown'}`);
      return null;
    }
    const members = json.result;

    const { data: prev } = await supabase
      .from('metrics_daily')
      .select('day, telegram_members')
      .not('telegram_members', 'is', null)
      .order('day', { ascending: false })
      .limit(1);

    const last = prev?.[0];
    if (last && last.telegram_members > 10 && members < last.telegram_members * MEMBERS_DROP_ALERT) {
      console.error(
        `⚠️  Підписників ${members}, а ${last.day} було ${last.telegram_members}. ` +
        'Люди так не йдуть — перевір, чи TELEGRAM_CHAT_ID вказує на канал, ' +
        'а не на адмін-чат.',
      );
    }
    return members;
  } catch (e) {
    console.error(`telegramMembers failed: ${e.message}`);
    return null;
  }
}

const today = new Date().toISOString().slice(0, 10);

const [active, closed, drafts, added, waitlist, profiles, feedback] = await Promise.all([
  countRows('opportunities', (q) => q.eq('status', 'active')
    .is('canonical_slug', null)),
  countRows('opportunities', (q) => q.eq('status', 'closed')),
  countRows('opportunities', (q) => q.eq('status', 'draft')),
  countRows('opportunities', (q) => q.gte('created_at', today)),
  countRows('plus_waitlist'),
  countRows('digest_subscribers'),
  countRows('opportunity_feedback', (q) => q, 'opportunity_id'),
]);

// MRR: місячні × 179 + річні × (1490/12) — та сама формула, що в plus-stats.
const { data: subs } = await supabase
  .from('digest_subscribers')
  .select('status, billing_period')
  .eq('status', 'active')
    .is('canonical_slug', null);
const yearly = (subs || []).filter((s) => s.billing_period === 'yearly').length;
const monthly = (subs || []).length - yearly;
const mrr = Math.round(monthly * PRICE_MONTH + yearly * (PRICE_YEAR / 12));

const row = {
  day: today,
  telegram_members: await telegramMembers(),
  active_opportunities: active,
  closed_opportunities: closed,
  draft_opportunities: drafts,
  added_today: added,
  waitlist_total: waitlist,
  digest_profiles: profiles,
  plus_active: (subs || []).length,
  plus_mrr: mrr,
  feedback_votes_total: feedback,
};

const { error } = await supabase.from('metrics_daily').upsert(row, { onConflict: 'day' });
if (error) {
  console.error('snapshot upsert failed:', error.message);
  process.exit(1);
}
console.log('📸 Знімок метрик за', today, JSON.stringify(row));
