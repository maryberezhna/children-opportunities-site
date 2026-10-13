import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import { buildPeople, peopleSummary, sourceLabel, sourceHref } from '@/lib/people';
import { notOwn } from '@/lib/own';
import { PRODUCT_LABELS } from '@/lib/payments';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const metadata = { title: 'Користувачі', robots: { index: false, follow: false } };

/**
 * Користувачі Dityam.com.ua — за ескізом Марії з блокнота (11.10.2026): в
 * адмінці 3 вкладки «Черга · Звернення · Користувачі», і тут «1 місце, де я
 * бачу, що я написала». Зверху 3 картки: нові за останні 24 години; куплено
 * (грн) окремо Dityam+ і замовлена доставка диплома; основні джерела, звідки
 * прийшли. Нижче таблиця «Хто · Коли · Чим скористався · Чи купила»:
 * Олімпіада → безкоштовно / замовив доставку; Dityam+ → пробний місяць / 99 грн/міс.
 * Під нею — журнал усіх оплат (таблиця payments, lib/payments.js).
 *
 * Раніше це була сторінка «Люди» (/admin/lyudy, 08.10.2026) — тепер звідти
 * переадресація сюди. Підписників Telegram-каналу тут немає: Telegram не дає
 * їхнього списку.
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
const linkS = { color: C.accent, textDecoration: 'underline' };
const ext = { target: '_blank', rel: 'noopener noreferrer' };
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

export default async function UsersPage() {
  const authed = isAdmin(cookies().get('dityam_admin')?.value);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Користувачі</h1>
        {adminConfigured() ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) } });

  // «Модний код» (12.10.2026, Марія: «трекай, скільки зайшло на сторінку і
  // скільки купило»): кроки воронки з site_events + оплати з mk_entries.
  const MK_STEPS = [['mk_view', 'зайшли на сторінку'], ['mk_cta', 'почали заповнювати заявку'], ['mk_pay_start', 'перейшли до оплати'], ['mk_paid', 'оплатили 99 грн'], ['mk_test_done', 'пройшли тест'], ['mk_cover_done', 'зробили обкладинку']];
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const mkCount = async (name, from) => {
    let q = sb.from('site_events').select('id', { count: 'exact', head: true }).eq('name', name);
    if (from) q = q.gte('created_at', from);
    const { count } = await q;
    return count || 0;
  };
  const mkFunnel = await Promise.all(MK_STEPS.map(async ([n, l]) => ({ n, l, all: await mkCount(n), week: await mkCount(n, since7) }))).catch(() => []);
  // Олімпіада з логіки через Telegram (13.10.2026, «повісь аналітику тут»):
  // сайт → бот → запис → тест → Dityam+. Кроки — з site_events, підписки — з
  // digest_subscribers (джерело «olimpiada», зараз активні).
  const OL_STEPS = [['olimp_view', 'зайшли на /olimpiada'], ['olimp_tg_click', 'натиснули «Зареєструватися в Telegram»'], ['olimp_bot_start', 'відкрили бот'], ['olimp_bot_reg', 'записали дитину'], ['olimp_bot_done', 'пройшли тест, диплом у Telegram'], ['olimp_plus_start', 'перейшли з диплома в Dityam+']];
  const olFunnel = await Promise.all(OL_STEPS.map(async ([n, l]) => ({ n, l, all: await mkCount(n), week: await mkCount(n, since7) }))).catch(() => []);
  const { count: olPlusActive } = await sb.from('digest_subscribers').select('id', { count: 'exact', head: true }).eq('source', 'olimpiada').eq('status', 'active');
  const { data: mkPaidRows } = await sb.from('mk_entries').select('amount, paid_at, parent_email, refunded_at').not('paid_at', 'is', null);
  const mkPaid = notOwn((mkPaidRows || []).map((r) => ({ ...r, email: r.parent_email }))).filter((r) => !r.refunded_at);
  const mkRevenue = mkPaid.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  const [subs, plusWait, entries, olimpWait, payments] = await Promise.all([
    all(() => sb.from('digest_subscribers').select('id, telegram_chat_id, telegram_handle, email, status, billing_period, source, role, created_at, updated_at')),
    all(() => sb.from('plus_waitlist').select('telegram_chat_id, telegram_username, email, created_at')),
    all(() => sb.from('olimpiada_entries').select('token, child_name, parent_email, created_at, paid_at, started_at, finished_at, level, wfp_last_status, source, print_paid_at')),
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
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Користувачі</h1>
      <p style={noteS}>
        Усі, хто проходив олімпіаду, підписувався на Dityam+ чи купував. Людина — це Telegram (Dityam+) або email
        (олімпіада): одна мама може бути двома рядками, бо в боті пошти ми не питаємо. Твої власні записи тут не рахуються.
      </p>

      <div style={{ ...grid, marginTop: 16 }}>
        <Card value={sum.new24} label="нові за останні 24 години" tone={sum.new24 ? C.green : undefined} />
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
          <div style={{ fontSize: 13, color: C.ink2, marginBottom: 6 }}>Куплено (грн)</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Dityam+: {uah(sum.boughtPlus)}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>Доставка диплома: {uah(sum.boughtPrint)}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
          <div style={{ fontSize: 13, color: C.ink2, marginBottom: 6 }}>Основні джерела, звідки прийшли</div>
          {sum.topSources.length
            ? sum.topSources.map(([s, n]) => <div key={s} style={{ fontSize: 15 }}><b>{n}</b> · {s}</div>)
            : <div style={{ color: C.ink3 }}>—</div>}
        </div>
      </div>

      <h2 style={h2S}>👗 Модний код · {mkPaid.length} оплат · {uah(mkRevenue)}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 620 }}>
          <thead><tr><th style={head}>Крок</th><th style={head}>За 7 днів</th><th style={head}>Усього</th></tr></thead>
          <tbody>
            {mkFunnel.map((s) => (
              <tr key={s.n}><td style={cell}>{s.l}</td><td style={cell}><b>{s.week}</b></td><td style={cell}>{s.all}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={noteS}>«Зайшли» — раз на сесію; браузери з ?noga=1 не рахуються. Сума й кількість оплат — без твоїх власних (lib/own.js), кроки воронки — усі.</p>

      <h2 style={h2S}>🧩 Олімпіада з логіки через Telegram · {olPlusActive || 0} підписок Dityam+</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 620 }}>
          <thead><tr><th style={head}>Крок</th><th style={head}>За 7 днів</th><th style={head}>Усього</th></tr></thead>
          <tbody>
            {olFunnel.map((s) => (
              <tr key={s.n}><td style={cell}>{s.l}</td><td style={cell}><b>{s.week}</b></td><td style={cell}>{s.all}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={noteS}>Кроки з бота рахуються з 13.10.2026. «Підписок» — активні Dityam+ із джерелом «олімпіада» (сюди входять і ті, хто прийшов зі сторінки диплома до 13.10).</p>

      <h2 style={h2S}>Хто · {rows.length}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={head}>Хто</th><th style={head}>Коли</th><th style={head}>Чим скористався</th><th style={head}>Чи купила</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={r.count ? { background: '#f0fdf4' } : undefined}>
                <td style={cell}>
                  {r.handle ? <a href={`https://t.me/${r.handle}`} style={linkS} {...ext}>{r.who}</a>
                    : r.email && r.who.includes(r.email) ? <a href={`mailto:${r.email}`} style={linkS}>{r.who}</a>
                      : r.who}
                  {r.email && !r.who.includes(r.email)
                    ? <div style={{ fontSize: 12 }}><a href={`mailto:${r.email}`} style={{ ...linkS, color: C.ink3 }}>{r.email}</a></div> : null}
                  {r.role ? <div style={{ fontSize: 12, color: C.ink2 }}>{r.role}</div> : null}
                  <div style={{ fontSize: 12, color: C.ink3 }}>
                    звідки: {sourceHref(r.source)
                      ? <a href={sourceHref(r.source)} style={{ ...linkS, color: C.ink3 }} {...ext}>{sourceLabel(r.source)}</a>
                      : sourceLabel(r.source)}
                  </div>
                </td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(r.first)}</td>
                <td style={cell}>
                  {r.used.length ? r.used.map((u) => (
                    <div key={u.what}>
                      {u.what}
                      {u.what === 'Олімпіада' && r.results.length
                        ? <span style={{ fontSize: 12 }}> · {r.results.map((x, i) => (
                          <span key={x.href}>{i ? ', ' : ''}<a href={x.href} style={linkS} {...ext}>{x.name}</a></span>
                        ))}</span> : null}
                    </div>
                  ))
                    : <span style={{ color: C.ink2 }}>{r.notes.join(', ') || '—'}</span>}
                </td>
                <td style={cell}>
                  {r.used.length ? r.used.map((u) => (
                    <div key={u.what} style={{ color: u.bought ? C.green : C.ink2, fontWeight: u.bought ? 700 : 400 }}>{u.what}: {u.paid}</div>
                  )) : <span style={{ color: C.ink3 }}>—</span>}
                </td>
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
