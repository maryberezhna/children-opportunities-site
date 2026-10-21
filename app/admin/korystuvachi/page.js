import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { FB_RATINGS, FB_TAGS } from '@/lib/feedback';
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
 * З 21.10.2026 — одна база, «по факту CRM» (Марія): рядок = людина, у ньому
 * діти, Dityam+ (безкоштовний з 21.10, тому статус анкети, не оплати),
 * олімпіада, «Модний код», педагог, відгук; фільтри й пошук. Воронки й журнал
 * оплат згорнуті внизу. Нижче — історія сторінки.
 *
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

// Dityam+ з 21.10.2026 безкоштовний — статус анкети, не оплати.
const PLUS_LABEL = {
  active: ['✅ підписка активна', '#15803d'],
  pending: ['⏳ анкету не завершено', '#8a6d1f'],
  paused: ['⚠️ пауза', '#8a6d1f'],
  unsubscribed: ['відписався', '#6b6b6b'],
  cancelled: ['скасовано', '#6b6b6b'],
};
const FILTERS = [
  ['all', 'Усі'], ['new7', 'Нові за 7 днів'], ['plus', 'Dityam+ активні'], ['pending', 'Не завершили анкету'],
  ['olimp', 'Олімпіада'], ['mk', 'Модний код'], ['teachers', 'Педагоги'], ['fb', 'З відгуком'],
];

export default async function UsersPage({ searchParams } = {}) {
  const filter = FILTERS.some(([k]) => k === searchParams?.f) ? searchParams.f : 'all';
  const q = String(searchParams?.q || '').trim().toLowerCase();
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
  // «Наші можливості» (13.10.2026, «і аналітику там»): скільки відкрили
  // /nashi-mozhlyvosti і на яку картку натиснули (own_click, source = картка).
  const ownCount = async (name, source, from) => {
    let q = sb.from('site_events').select('id', { count: 'exact', head: true }).eq('name', name);
    if (source) q = q.eq('source', source);
    if (from) q = q.gte('created_at', from);
    const { count } = await q;
    return count || 0;
  };
  const OWN_STEPS = [['own_view', null, 'зайшли на сторінку'], ['own_click', 'olimpiada', 'натиснули «Олімпіада з логіки»'], ['own_click', 'modnyi-kod', 'натиснули «Модний код»'], ['own_click', 'plus', 'натиснули «Dityam+»']];
  const ownFunnel = await Promise.all(OWN_STEPS.map(async ([n, src, l]) => ({ n: `${n}:${src || ''}`, l, all: await ownCount(n, src), week: await ownCount(n, src, since7) }))).catch(() => []);
  // Відгуки одним натиском (14.10.2026): оцінка + необовʼязкові теги.
  const { data: fbRows } = await sb.from('product_feedback')
    .select('product, child_name, telegram_chat_id, rating, tags, created_at')
    .order('created_at', { ascending: false }).limit(500);
  const fb = fbRows || [];
  const fbBy = (r) => fb.filter((x) => x.rating === r).length;
  const fbTagCount = Object.keys(FB_TAGS).map((t) => [t, fb.filter((x) => (x.tags || []).includes(t)).length]);

  const [subs, plusWait, entries, olimpWait, payments, mkAll, teachersAll, children] = await Promise.all([
    all(() => sb.from('digest_subscribers').select('id, telegram_chat_id, telegram_handle, email, status, billing_period, source, role, created_at, updated_at')),
    all(() => sb.from('plus_waitlist').select('telegram_chat_id, telegram_username, email, created_at')),
    all(() => sb.from('olimpiada_entries').select('token, child_name, parent_email, created_at, paid_at, started_at, finished_at, level, wfp_last_status, source, print_paid_at, teacher_code')),
    all(() => sb.from('olimpiada_waitlist').select('email, created_at')),
    all(() => sb.from('payments').select('*').order('paid_at', { ascending: false })),
    all(() => sb.from('mk_entries').select('child_name, child_age, parent_email, amount, created_at, paid_at, refunded_at, score, max_score, source')),
    all(() => sb.from('olimpiada_teachers').select('name, email, code, source, created_at, thanks_sent_at')),
    all(() => sb.from('plus_children').select('subscriber_id, position, age_bands, likes')),
  ]);
  const mkRows = notOwn(mkAll);
  const mkPaid = mkRows.filter((r) => r.paid_at && !r.refunded_at);
  const mkRevenue = mkPaid.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  // Власні записи Марії (lib/own.js) — не люди: не показуємо й не рахуємо (08.10.2026).
  const teachers = notOwn(teachersAll);
  const rows = buildPeople({ subs: notOwn(subs), plusWait: notOwn(plusWait), entries: notOwn(entries), olimpWait: notOwn(olimpWait), mk: mkRows, teachers, payments: notOwn(payments), children, feedback: fb });
  const week = Date.now() - 7 * 864e5;
  const isTeacher = (r) => r.notes.some((n) => n.startsWith('👩‍🏫'));
  const match = {
    all: () => true,
    new7: (r) => r.first && new Date(r.first).getTime() >= week,
    plus: (r) => r.plus?.status === 'active',
    pending: (r) => r.plus?.status === 'pending',
    olimp: (r) => r.notes.some((n) => n.startsWith('🧩')),
    mk: (r) => r.notes.some((n) => n.startsWith('👗')),
    teachers: isTeacher,
    fb: (r) => r.fb.length > 0,
  }[filter];
  const shown = rows.filter(match).filter((r) => !q || [r.who, r.email, r.handle, ...r.kids, ...r.notes].join(' ').toLowerCase().includes(q));
  const counts = { all: rows.length, new7: rows.filter(match === match ? (r) => r.first && new Date(r.first).getTime() >= week : () => false).length,
    plus: rows.filter((r) => r.plus?.status === 'active').length, pending: rows.filter((r) => r.plus?.status === 'pending').length,
    olimp: rows.filter((r) => r.notes.some((n) => n.startsWith('🧩'))).length, mk: rows.filter((r) => r.notes.some((n) => n.startsWith('👗'))).length,
    teachers: rows.filter(isTeacher).length, fb: rows.filter((r) => r.fb.length > 0).length };
  const chip = (k, label) => {
    const on = filter === k;
    return <a key={k} href={`/admin/korystuvachi?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 99, border: `1px solid ${on ? C.ink : C.border}`, background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink, fontSize: 13, fontWeight: 600, textDecoration: 'none', marginRight: 6, marginBottom: 6 }}>{label} · {counts[k]}</a>;
  };
  const olimpOf = (r) => r.notes.filter((n) => n.startsWith('🧩')).map((n) => n.replace('🧩 Олімпіада · ', ''));
  const mkOf = (r) => r.notes.filter((n) => n.startsWith('👗')).map((n) => n.replace('👗 Модний код · ', ''));
  const teacherOf = (r) => r.notes.filter((n) => n.startsWith('👩‍🏫')).map((n) => n.replace('👩‍🏫 Педагог олімпіади · ', ''));
  const shownPayments = notOwn(payments);
  const sum = peopleSummary(rows, shownPayments);
  const whoByPayment = (p) => (p.telegram_handle ? `@${String(p.telegram_handle).replace(/^@+/, '')}`
    : p.email ? `📧 ${p.email}` : p.telegram_chat_id ? `Telegram · …${String(p.telegram_chat_id).slice(-4)}` : '—');

  return (
    <main style={wrap}>
      <AdminNav current="people" />
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Користувачі</h1>
      <p style={noteS}>
        Одна база: кожен, хто записався в Dityam+, проходив олімпіаду чи «Модний код», або долучив клас як педагог.
        Людина — Telegram або email: одна мама може бути двома рядками, бо в боті пошти не питаємо. Твої власні записи не рахуються.
      </p>

      <div style={{ ...grid, marginTop: 16 }}>
        <Card value={rows.length} label="людей у базі" />
        <Card value={sum.new24} label="нові за 24 години" tone={sum.new24 ? C.green : undefined} />
        <Card value={counts.plus} label="✅ Dityam+ активних (безкоштовно з 21.10)" tone={counts.plus ? C.green : undefined} />
        <Card value={counts.pending} label="⏳ почали анкету, не завершили" />
        <Card value={counts.olimp} label="🧩 родин олімпіади" />
        <Card value={counts.teachers} label="👩‍🏫 педагогів" />
      </div>

      <form method="get" action="/admin/korystuvachi" style={{ margin: '18px 0 8px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="hidden" name="f" value={filter} />
        <input name="q" defaultValue={q} placeholder="пошук: імʼя дитини, @нік, пошта" style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, minWidth: 260 }} />
        <button type="submit" style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Знайти</button>
        {q ? <a href={`/admin/korystuvachi?f=${filter}`} style={{ ...linkS, fontSize: 13 }}>скинути</a> : null}
      </form>
      <div>{FILTERS.map(([k, l]) => chip(k, l))}</div>

      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr>
              <th style={head}>Хто</th><th style={head}>Звідки · коли</th><th style={head}>Діти</th>
              <th style={head}>Dityam+</th><th style={head}>Олімпіада</th><th style={head}>Модний код</th><th style={head}>Відгук</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const pl = r.plus ? PLUS_LABEL[r.plus.status] || [r.plus.status, C.ink2] : null;
              return (
                <tr key={r.key}>
                  <td style={cell}>
                    {r.handle ? <a href={`https://t.me/${r.handle}`} style={linkS} {...ext}>{r.who}</a>
                      : r.email && r.who.includes(r.email) ? <a href={`mailto:${r.email}`} style={linkS}>{r.who}</a>
                        : r.who}
                    {r.email && !r.who.includes(r.email)
                      ? <div style={{ fontSize: 12 }}><a href={`mailto:${r.email}`} style={{ ...linkS, color: C.ink3 }}>{r.email}</a></div> : null}
                    {r.role ? <div style={{ fontSize: 12, color: C.ink2 }}>{r.role}</div> : null}
                    {teacherOf(r).map((t) => <div key={t} style={{ fontSize: 12, color: C.ink2 }}>👩‍🏫 {t}</div>)}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <div>{sourceHref(r.source)
                      ? <a href={sourceHref(r.source)} style={linkS} {...ext}>{sourceLabel(r.source)}</a>
                      : sourceLabel(r.source)}</div>
                    <div style={{ fontSize: 12, color: C.ink3 }}>{fmtDate(r.first)}{r.last && fmtDate(r.last) !== fmtDate(r.first) ? ` → ${fmtDate(r.last)}` : ''}</div>
                  </td>
                  <td style={cell}>{r.kids.length ? r.kids.map((k) => <div key={k}>{k}</div>) : <span style={{ color: C.ink3 }}>—</span>}</td>
                  <td style={cell}>{pl ? <span style={{ color: pl[1], fontWeight: r.plus.status === 'active' ? 700 : 500 }}>{pl[0]}</span> : <span style={{ color: C.ink3 }}>—</span>}</td>
                  <td style={cell}>
                    {olimpOf(r).length ? olimpOf(r).map((o) => <div key={o}>{o}</div>) : <span style={{ color: C.ink3 }}>—</span>}
                    {r.results.length ? <div style={{ fontSize: 12 }}>{r.results.map((x, i) => <span key={x.href}>{i ? ', ' : ''}<a href={x.href} style={linkS} {...ext}>диплом · {x.name}</a></span>)}</div> : null}
                  </td>
                  <td style={cell}>{mkOf(r).length ? mkOf(r).map((o) => <div key={o}>{o}</div>) : <span style={{ color: C.ink3 }}>—</span>}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.fb.length ? r.fb.map((v, i) => <span key={i} title={FB_RATINGS[v]}>{(FB_RATINGS[v] || '').slice(0, 2)}</span>) : <span style={{ color: C.ink3 }}>—</span>}</td>
                </tr>
              );
            })}
            {shown.length === 0 ? <tr><td style={cell} colSpan={7}>Нікого не знайдено.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h2 style={h2S}>💬 Відгуки після олімпіади · {fb.length}</h2>
      <div style={{ ...grid, marginTop: 8 }}>
        {Object.entries(FB_RATINGS).map(([k, label]) => <Card key={k} value={fbBy(k)} label={label} />)}
      </div>
      <p style={{ ...noteS, marginTop: 8 }}>
        Що саме: {fbTagCount.map(([t, n]) => `${FB_TAGS[t]} ${n}`).join(' · ')}. Кожна оцінка приходить і в адмін-чат «⭐ Відгук» — відповідайте на неї реплаєм, і відповідь піде людині в @DityamPlusBot.
      </p>

      {/* Воронки й журнал оплат — були тут окремими блоками; з 21.10.2026 сторінка
          стала однією базою (Марія: «1 зрозуміла база по факту CRM»), тож вони
          згорнуті внизу, а не прибрані. */}
      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>📈 Воронки: олімпіада через Telegram, «Модний код», «Наші можливості»</summary>
        {[['🧩 Олімпіада з логіки через Telegram', olFunnel, 'Кроки з бота рахуються з 13.10.2026.'],
          ['👗 Модний код', mkFunnel, '«Зайшли» — раз на сесію; браузери з ?noga=1 не рахуються.'],
          ['⭐ Наші можливості · /nashi-mozhlyvosti', ownFunnel, 'Рахується з 13.10.2026; кліки — по картинці, назві чи кнопці картки.']].map(([title, funnel, note]) => (
          <div key={title}>
            <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>{title}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 620 }}>
              <thead><tr><th style={head}>Крок</th><th style={head}>За 7 днів</th><th style={head}>Усього</th></tr></thead>
              <tbody>{funnel.map((s) => <tr key={s.n}><td style={cell}>{s.l}</td><td style={cell}><b>{s.week}</b></td><td style={cell}>{s.all}</td></tr>)}</tbody>
            </table>
            <p style={noteS}>{note}</p>
          </div>
        ))}
      </details>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>💳 Журнал оплат до 21.10.2026 · {shownPayments.length} · Dityam+ {uah(sum.boughtPlus)} · доставка диплома {uah(sum.boughtPrint)} · «Модний код» {uah(mkRevenue)}</summary>
        {shownPayments.length === 0 ? <p style={noteS}>Ще жодної оплати в журналі.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, marginTop: 8 }}>
            <thead><tr><th style={head}>Коли</th><th style={head}>Хто</th><th style={head}>Що</th><th style={{ ...head, textAlign: 'right' }}>Сума</th></tr></thead>
            <tbody>
              {shownPayments.map((p) => (
                <tr key={p.id}><td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(p.paid_at)}</td><td style={cell}>{whoByPayment(p)}</td><td style={cell}>{PRODUCT_LABELS[p.product] || p.product}</td><td style={num}>{uah(p.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </main>
  );
}
