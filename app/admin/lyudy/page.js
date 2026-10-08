import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import { buildPeople, peopleSummary } from '@/lib/people';
import { notOwn } from '@/lib/own';
import { PRODUCT_LABELS } from '@/lib/payments';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const metadata = { title: 'Люди', robots: { index: false, follow: false } };

/**
 * Люди Dityam.com.ua (Марія, 08.10.2026: «мені по факту треба своя сторінка в
 * адмінці, щоб бачити, хто і скільки разів щось купував і підписувався на
 * нас»). Кожна людина — один рядок: що з нами (Dityam+, олімпіада, списки
 * очікування) і що купувала, скільки разів і на яку суму. Під нею — журнал
 * усіх оплат (таблиця payments, lib/payments.js).
 *
 * Підписників Telegram-каналу тут немає: Telegram не дає їхнього списку.
 */

const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b',
  border: '#e2e8f2', green: '#15803d', accent: '#c8501a',
};
const wrap = { maxWidth: 1100, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: C.ink };
const h2S = { fontSize: 17, margin: '28px 0 10px' };
const noteS = { fontSize: 13, color: C.ink3, margin: '8px 0 0', lineHeight: 1.5 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 };
const cell = { padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 14, textAlign: 'left', verticalAlign: 'top' };
const head = { ...cell, fontSize: 12, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' };
const num = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Kyiv' })
  : '—');
const uah = (n) => `${Math.round(Number(n) || 0).toLocaleString('uk-UA')} грн`;

function Card({ value, label, tone }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || C.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 1.35 }}>{label}</div>
    </div>
  );
}

// Усі рядки таблиці, а не перші 1000 (ліміт PostgREST).
async function all(query) {
  const out = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function PeoplePage() {
  const authed = isAdmin(cookies().get('dityam_admin')?.value);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Люди</h1>
        {adminConfigured() ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) } });

  const [subs, plusWait, entries, olimpWait, payments] = await Promise.all([
    all(() => sb.from('digest_subscribers').select('id, telegram_chat_id, telegram_handle, email, status, billing_period, created_at, updated_at')),
    all(() => sb.from('plus_waitlist').select('telegram_chat_id, telegram_username, email, created_at')),
    all(() => sb.from('olimpiada_entries').select('child_name, parent_email, created_at, paid_at, started_at, finished_at, level, wfp_last_status')),
    all(() => sb.from('olimpiada_waitlist').select('email, created_at')),
    all(() => sb.from('payments').select('*').order('paid_at', { ascending: false })),
  ]);

  // Власні записи Марії (lib/own.js) — не люди: не показуємо й не рахуємо (08.10.2026).
  const rows = buildPeople({ subs: notOwn(subs), plusWait: notOwn(plusWait), entries: notOwn(entries), olimpWait: notOwn(olimpWait), payments: notOwn(payments) });
  const shownPayments = notOwn(payments);
  const sum = peopleSummary(rows, shownPayments);
  const whoByPayment = (p) => (p.telegram_handle ? `@${String(p.telegram_handle).replace(/^@+/, '')}`
    : p.email ? `📧 ${p.email}` : p.telegram_chat_id ? `Telegram · …${String(p.telegram_chat_id).slice(-4)}` : '—');

  return (
    <main style={wrap}>
      <AdminNav current="people" />
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Люди</h1>
      <p style={noteS}>
        Усі, хто купував, підписувався чи проходив олімпіаду. Людина — це Telegram (Dityam+) або email
        (олімпіада, списки очікування): одна мама може бути двома рядками, бо в боті пошти ми не питаємо.
        Підписників Telegram-каналу тут немає — Telegram не дає їхнього списку.
      </p>

      <div style={{ ...grid, marginTop: 16 }}>
        <Card value={sum.people} label="людей" />
        <Card value={sum.buyers} label="купили хоч раз" tone={sum.buyers ? C.green : undefined} />
        <Card value={sum.repeat} label="купили 2 рази й більше" />
        <Card value={uah(sum.total)} label="оплат усього" />
        <Card value={uah(sum.total30)} label="оплат за 30 днів" />
      </div>
      <p style={noteS}>Журнал оплат веде сайт з 08.10.2026; ранні оплати Dityam+ додано з кабінету WayForPay. Твої власні записи (@maryberezhna і твої пошти) тут не показуються й не рахуються.</p>

      <h2 style={h2S}>Хто · {rows.length}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={head}>Хто</th><th style={head}>Що з нами</th><th style={head}>Купівлі</th>
              <th style={{ ...head, textAlign: 'right' }}>Разом</th>
              <th style={head}>Вперше</th><th style={head}>Востаннє</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={r.count ? { background: '#f0fdf4' } : undefined}>
                <td style={cell}>
                  {r.who}{r.me ? <span style={{ color: C.ink3 }}> · це ти</span> : null}
                  {r.email && !r.who.includes(r.email) ? <div style={{ fontSize: 12, color: C.ink3 }}>{r.email}</div> : null}
                </td>
                <td style={{ ...cell, color: C.ink2 }}>{r.notes.length ? r.notes.map((n) => <div key={n}>{n}</div>) : '—'}</td>
                <td style={cell}>
                  {r.bought.length ? r.bought.map((b) => <div key={b.product}>{b.label} × {b.count}</div>) : <span style={{ color: C.ink3 }}>—</span>}
                </td>
                <td style={{ ...num, fontWeight: r.total ? 700 : 400, color: r.total ? C.green : C.ink3 }}>{r.total ? uah(r.total) : '—'}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(r.first)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(r.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={h2S}>Усі оплати · {shownPayments.length}</h2>
      {shownPayments.length === 0 ? (
        <p style={noteS}>Ще жодної оплати в журналі.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr><th style={head}>Коли</th><th style={head}>Хто</th><th style={head}>Що</th><th style={{ ...head, textAlign: 'right' }}>Сума</th></tr>
            </thead>
            <tbody>
              {shownPayments.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(p.paid_at)}</td>
                  <td style={cell}>{whoByPayment(p)}</td>
                  <td style={cell}>{PRODUCT_LABELS[p.product] || p.product}</td>
                  <td style={num}>{uah(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
