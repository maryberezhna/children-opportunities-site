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

async function countRows(table, filter = (q) => q) {
  const { count, error } = await filter(
    supabase.from(table).select('id', { count: 'exact', head: true }),
  );
  if (error) {
    console.error(`${table} count failed: ${error.message}`);
    return null;
  }
  return count ?? 0;
}

async function telegramMembers() {
  if (!BOT || !CHANNEL) return null;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT}/getChatMemberCount?chat_id=${encodeURIComponent(CHANNEL)}`,
    );
    const json = await r.json();
    return json.ok ? json.result : null;
  } catch {
    return null;
  }
}

const today = new Date().toISOString().slice(0, 10);

const [active, closed, drafts, added, waitlist, profiles, feedback] = await Promise.all([
  countRows('opportunities', (q) => q.eq('status', 'active')),
  countRows('opportunities', (q) => q.eq('status', 'closed')),
  countRows('opportunities', (q) => q.eq('status', 'draft')),
  countRows('opportunities', (q) => q.gte('created_at', today)),
  countRows('plus_waitlist'),
  countRows('digest_subscribers'),
  countRows('opportunity_feedback'),
]);

// MRR: місячні × 179 + річні × (1490/12) — та сама формула, що в plus-stats.
const { data: subs } = await supabase
  .from('digest_subscribers')
  .select('status, billing_period')
  .eq('status', 'active');
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
