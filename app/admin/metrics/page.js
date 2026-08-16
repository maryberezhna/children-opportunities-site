import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Метрики',
  robots: { index: false, follow: false },
};

const PRICE_MONTH = 179;
const PRICE_YEAR = 1490;

const wrap = { maxWidth: 860, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, margin: '14px 0 6px' };
const cardS = { border: '1px solid #e3e8f0', borderRadius: 10, padding: '12px 14px', background: '#fff' };
const numS = { fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' };
const labS = { fontSize: 12.5, color: '#54617a', marginTop: 2, lineHeight: 1.35 };
const h2S = { fontSize: 17, margin: '28px 0 2px' };
const noteS = { fontSize: 13, color: '#8a94a6', margin: '4px 0 0' };

function Card({ value, delta, label }) {
  return (
    <div style={cardS}>
      <div style={numS}>
        {value ?? '—'}
        {delta != null && delta !== 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 6, color: delta > 0 ? '#15803d' : '#b3372e' }}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <div style={labS}>{label}</div>
    </div>
  );
}

async function count(supabase, table, filter = (q) => q, col = 'id') {
  const { count: c } = await filter(supabase.from(table).select(col, { count: 'exact', head: true }));
  return c ?? 0;
}

export default async function MetricsPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Метрики</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

  const [
    active, drafts, added7, added30, closed7,
    waitlist, waitlist7, profiles, feedback7, outcomes,
    subsRes, snapshotsRes,
  ] = await Promise.all([
    count(supabase, 'opportunities', (q) => q.eq('status', 'active')),
    count(supabase, 'opportunities', (q) => q.eq('status', 'draft')),
    count(supabase, 'opportunities', (q) => q.gte('created_at', iso(7))),
    count(supabase, 'opportunities', (q) => q.gte('created_at', iso(30))),
    count(supabase, 'opportunities', (q) => q.eq('status', 'closed').gte('updated_at', iso(7))),
    count(supabase, 'plus_waitlist'),
    count(supabase, 'plus_waitlist', (q) => q.gte('created_at', iso(7))),
    count(supabase, 'digest_subscribers'),
    count(supabase, 'opportunity_feedback', (q) => q.gte('created_at', iso(7)), 'opportunity_id'),
    count(supabase, 'opportunity_outcomes'),
    supabase.from('digest_subscribers').select('status, billing_period').eq('status', 'active'),
    supabase.from('metrics_daily').select('*').order('day', { ascending: false }).limit(14),
  ]);

  const subs = subsRes.data || [];
  const yearly = subs.filter((s) => s.billing_period === 'yearly').length;
  const monthly = subs.length - yearly;
  const mrr = Math.round(monthly * PRICE_MONTH + yearly * (PRICE_YEAR / 12));

  const snaps = snapshotsRes.data || [];
  const latest = snaps[0];
  const weekAgo = snaps.find((s) => s.day <= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const tgNow = latest?.telegram_members ?? null;
  const tgDelta = tgNow != null && weekAgo?.telegram_members != null
    ? tgNow - weekAgo.telegram_members : null;

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 24, marginBottom: 2 }}>Метрики</h1>
        <a href="/admin" style={{ fontSize: 14, color: '#54617a' }}>← Модерація</a>
      </div>

      <h2 style={h2S}>🛠 Продукт</h2>
      <div style={grid}>
        <Card value={active} label="активних можливостей у каталозі" />
        <Card value={added7} label={`додано за 7 днів (за 30: ${added30})`} />
        <Card value={closed7} label="закрито за 7 днів (дедлайни, мертві лінки, дублі)" />
        <Card value={drafts} label="чернеток чекають модерації" />
        <Card value={tgNow} delta={tgDelta} label={tgDelta == null && tgNow != null
          ? 'підписників Telegram-каналу (Δ буде за тиждень знімків)'
          : 'підписників Telegram-каналу (Δ за 7 днів)'} />
      </div>

      <h2 style={h2S}>📣 Маркетинг</h2>
      <div style={grid}>
        <Card value={waitlist} delta={waitlist7 || null} label="у списку очікування Dityam+ (Δ за 7 днів)" />
        <Card value={profiles} label="профілів дитини заповнено (digest)" />
        <Card value={feedback7} label="голосів 👍/👎 у каналі за 7 днів" />
        <Card value={outcomes} label="історій «я подався» від батьків" />
      </div>
      <p style={noteS}>
        Сесії, органіка і AI-трафік — у <a href="https://analytics.google.com" target="_blank" rel="noreferrer">GA4</a> та{' '}
        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console</a>. Щоб бачити їх тут — потрібен сервісний ключ GA4 (напишіть Claude «підключи GA4 до метрик»).
      </p>

      <h2 style={h2S}>💰 Dityam+</h2>
      <div style={grid}>
        <Card value={subs.length} label={`активних платних підписок (${monthly} міс · ${yearly} річн)`} />
        <Card value={`${mrr} грн`} label="MRR (місячний еквівалент)" />
        <Card value={waitlist ? `${Math.round((subs.length / waitlist) * 100)}%` : '—'} label="конверсія waitlist → оплата" />
      </div>

      <h2 style={h2S}>📅 Щоденні знімки (останні 14)</h2>
      {snaps.length === 0 ? (
        <p style={noteS}>Ще немає — перший з’явиться після нічного запуску metrics-snapshot.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13.5, width: '100%', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#54617a' }}>
                {['День', 'TG', 'Активні', 'Додано', 'Чернетки', 'Waitlist', 'Платні', 'MRR'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #e3e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.day}>
                  <td style={{ padding: '5px 10px' }}>{s.day}</td>
                  <td style={{ padding: '5px 10px' }}>{s.telegram_members ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.active_opportunities ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.added_today ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.draft_opportunities ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.waitlist_total ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.plus_active ?? '—'}</td>
                  <td style={{ padding: '5px 10px' }}>{s.plus_mrr ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
