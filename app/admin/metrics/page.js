import { cookies } from 'next/headers';
import { notOwn } from '@/lib/own';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import AdminNav from '../AdminNav';
import { plusFunnel, plusSources } from '@/lib/funnel';
import { allNamed } from '@/lib/allNamed';
import { mediaKit } from '@/lib/mediakit';
import LoginForm from '../LoginForm';
import { olimpStats, olimpTraffic, olimpTeachers } from '@/lib/olimpiada-stats';
import { fetchAllRows } from '@/lib/supabase';
import { OLIMP, OLIMP_OPEN, levelByKey } from '@/lib/olimpiada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Свіжі числа: без цього Data Cache Next.js віддає застарілі відповіді Supabase
// навіть при force-dynamic (див. #723).
export const fetchCache = 'force-no-store';
export const metadata = {
  title: 'Метрики',
  robots: { index: false, follow: false },
};

const PRICE_MONTH = 99; // з 08.10.2026; до того 119
// Пів року замість року з 27.09.2026. Річні рахуємо лише для старих рядків (їх 0).
const PRICE_HALF = 549;
const PRICE_YEAR_OLD = 999;

const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, margin: '14px 0 6px' };
const cardS = { border: '1px solid #e3e8f0', borderRadius: 10, padding: '12px 14px', background: '#fff' };
const numS = { fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' };
const labS = { fontSize: 12.5, color: '#54617a', marginTop: 2, lineHeight: 1.35 };
const h2S = { fontSize: 17, margin: '28px 0 2px' };
const noteS = { fontSize: 13, color: '#8a94a6', margin: '4px 0 0' };
const olTd = { padding: '8px 10px', borderBottom: '1px solid #e2e8f2', textAlign: 'left', verticalAlign: 'top' };
const olTh = { ...olTd, fontSize: 12, fontWeight: 700, color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '.04em' };

// Рядок воронки: смужка завширшки як частка від першого кроку, поруч —
// скільки людей і скільки з них ми втратили на цьому переході.
function FunnelRow({ s, first }) {
  const w = first ? Math.max((s.n / first) * 100, 1.5) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid #f0f3f8' }}>
      <div style={{ width: 190, fontSize: 13.5, flexShrink: 0 }}>
        {s.label}
        {s.hint && <div style={{ fontSize: 11.5, color: '#8a94a6' }}>{s.hint}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 60 }}>
        <div style={{ width: `${w}%`, height: 20, borderRadius: 4, background: s.key === 'paid' ? '#15803d' : '#c8501a' }} />
      </div>
      <div style={{ width: 62, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.n}</div>
      <div style={{ width: 52, textAlign: 'right', fontSize: 12.5, color: '#8a94a6', fontVariantNumeric: 'tabular-nums' }}>{s.share}%</div>
      <div style={{ width: 92, textAlign: 'right', fontSize: 12.5, color: s.drop ? '#b3372e' : '#c3cad6', fontVariantNumeric: 'tabular-nums' }}>
        {s.drop ? `−${s.drop} (−${s.dropShare}%)` : '—'}
      </div>
    </div>
  );
}

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

// Показники для рекламодавця (lib/mediakit.js): відвідувачі → увага → дія,
// за 28 і 90 днів. Лише в адмінці (Марія, 30.09.2026). Без ключа GA4 —
// інструкція, як його дати.
const thS = { textAlign: 'right', fontSize: 12.5, color: '#54617a', fontWeight: 600, padding: '6px 8px' };
const tdS = { textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 };
const fmtSec = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const fmtPct = (v) => (v == null ? '—' : `${v}%`);
const fmtN = (v) => (v == null ? '—' : v.toLocaleString('uk-UA'));

function MediaKit({ kit }) {
  const audience = kit?.audience;
  const audienceBlock = audience?.children ? (
    <p style={{ ...noteS, marginTop: 10 }}>
      Вік дітей у профілях Dityam+ ({audience.children}):{' '}
      {audience.bands.map((b) => `${b.band} — ${b.share}%`).join(' · ')}.
      GA4 не знає віку й статі відвідувачів (Google Signals вимкнено) — це єдині наші дані про аудиторію.
    </p>
  ) : null;

  if (!kit || !kit.configured) {
    return (
      <>
        <p style={noteS}>
          GA4 із сервера ще не підключено. Щоб цифри зʼявились тут: у Google Cloud створити сервісний акаунт і JSON-ключ,
          у GA4 (Адміністратор → Керування доступом до властивості) додати e-mail акаунта як «Переглядача»,
          у Vercel додати змінні <code>GA4_PROPERTY_ID</code> = 533756602 і <code>GA4_SERVICE_ACCOUNT_JSON</code> = увесь JSON ключа одним рядком.
          Показники: відвідувачі, перегляди, час, сторінок за сеанс, повернення, Україна, топ підбірок,
          перегляди сторінок можливостей, переходи до організаторів, CTR карток на головній.
        </p>
        {audienceBlock}
      </>
    );
  }
  if (kit.error) return <p style={{ ...noteS, color: '#b3372e' }}>GA4 не відповів: {kit.error}</p>;

  const rows = [
    ['Унікальні відвідувачі', (r) => fmtN(r.users)],
    ['Сеанси', (r) => fmtN(r.sessions)],
    ['Перегляди сторінок', (r) => fmtN(r.views)],
    ['Середній час взаємодії за сеанс', (r) => fmtSec(r.avgSessionSec)],
    ['Сторінок за сеанс', (r) => (r.pagesPerSession ?? '—')],
    ['Повернулись (частка відвідувачів)', (r) => fmtPct(r.returningShare)],
    ['З України', (r) => fmtPct(r.ukraineShare)],
    ['Перегляди сторінок можливостей', (r) => `${fmtN(r.opportunityViews)} (${fmtPct(r.opportunityShare)} переглядів)`],
    ['Переходи до організаторів', (r) => `${fmtN(r.outbound)} (${fmtPct(r.outboundPerUsers)} від відвідувачів)`],
    ['Перегляди головної', (r) => fmtN(r.homeViews)],
    ['Кліки карток на головній · CTR', (r) => `${fmtN(r.cardClicks)} · ${r.homeCtr == null ? '—' : `${r.homeCtr}%`}`],
  ];
  return (
    <>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720, fontSize: 13.5, marginTop: 8 }}>
        <thead>
          <tr><th style={{ ...thS, textAlign: 'left' }}>Показник</th>{kit.ranges.map((r) => <th key={r.label} style={thS}>{r.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} style={{ borderTop: '1px solid #f0f3f8' }}>
              <td style={{ padding: '6px 8px' }}>{label}</td>
              {kit.ranges.map((r) => <td key={r.label} style={tdS}>{f(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ ...noteS, marginTop: 8 }}>
        Топ підбірок за 28 днів: {kit.ranges[0].topTopics.map((t) => `${t.label} — ${fmtN(t.views)}`).join(' · ') || '—'}.
      </p>
      <p style={noteS}>
        Власний трафік вилучено: без заходів із компʼютера у Варшаві (Марія за роботою й перевірки з її Мака); решта Варшави рахується.
        «Переходи до організаторів» — подія opportunity_click (apply_click іде на тому ж кліку, тож окремо не додається). CTR карток — кліки card_click на перегляди
        головної: показів окремої картки GA4 не рахує, тож для «Топ тижня» це верхня межа. Реєстрації на сайті
        організатора нам не видно — їх може повідомити лише сам організатор.
      </p>
      {audienceBlock}
    </>
  );
}

export default async function MetricsPage() {
  const configured = adminConfigured();
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = isAdmin(cookie);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Метрики</h1>
        {configured ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

  const {
    active, drafts, added7, added30, closed7,
    waitlist, waitlist7, profiles, feedback7, outcomes,
    subsRes, snapshotsRes, promoRes, actionsRes, allSubsRes, kidsRes,
    siteVisit, sitePlusView, sitePlusClick,
    olimpWaitRes, olimpEntriesRes, olimpEventsRes, olimpTeachersRes, olimpTeacherEntriesRes,
  } = await allNamed({
    active: count(supabase, 'opportunities', (q) => q.eq('status', 'active')),
    drafts: count(supabase, 'opportunities', (q) => q.eq('status', 'draft')),
    added7: count(supabase, 'opportunities', (q) => q.gte('created_at', iso(7))),
    added30: count(supabase, 'opportunities', (q) => q.gte('created_at', iso(30))),
    closed7: count(supabase, 'opportunities', (q) => q.eq('status', 'closed').gte('updated_at', iso(7))),
    waitlist: count(supabase, 'plus_waitlist'),
    waitlist7: count(supabase, 'plus_waitlist', (q) => q.gte('created_at', iso(7))),
    profiles: count(supabase, 'digest_subscribers'),
    feedback7: count(supabase, 'opportunity_feedback', (q) => q.gte('created_at', iso(7)), 'opportunity_id'),
    outcomes: count(supabase, 'opportunity_outcomes'),
    subsRes: supabase.from('digest_subscribers').select('status, billing_period, telegram_chat_id, telegram_handle').eq('status', 'active'),
    // Уся воронка, а не лише ті, хто дійшов: саме ті, хто НЕ дійшов,
    // і показують, де ми їх втрачаємо.
    allSubsRes: supabase.from('digest_subscribers')
      .select('id, status, consent_at, flow_step, wfp_order_reference, wfp_last_status, source, telegram_chat_id, telegram_handle, email'),
    kidsRes: supabase.from('plus_children').select('subscriber_id, age_bands'),
    // Верхні кроки воронки — власні лічильники сайту (lib/site-events.js).
    // Лічимо count-запитами, а не вибіркою рядків: PostgREST віддає щонайбільше
    // 1000 рядків, а «visit» пишеться на кожну сесію — список обрізався б.
    // (Таблиці site_events у базі не було до 06.10.2026 — міграцію 20260929
    // не застосували, тож до того тут були нулі.)
    siteVisit: count(supabase, 'site_events', (q) => q.eq('name', 'visit')),
    sitePlusView: count(supabase, 'site_events', (q) => q.eq('name', 'plus_view')),
    sitePlusClick: count(supabase, 'site_events', (q) => q.eq('name', 'plus_click')),
    snapshotsRes: supabase.from('metrics_daily').select('*').order('day', { ascending: false }).limit(14),
    promoRes: supabase.from('plus_promo_uses').select('*').order('created_at', { ascending: false }).limit(200),
    // Хто скільки зробив у черзі: журнал moderation_actions (24.09.2026).
    actionsRes: supabase.from('moderation_actions').select('actor, action, created_at')
      .gte('created_at', iso(30)).limit(5000),
    // Онлайн-олімпіада: список очікування й заявки (06.10.2026).
    olimpWaitRes: supabase.from('olimpiada_waitlist').select('created_at, source, email').limit(10000),
    // Події сторінки олімпіади й попапу (olimp_*) — сторінками, без межі в 1000.
    olimpEventsRes: fetchAllRows(() => supabase.from('site_events').select('name, source, created_at').like('name', 'olimp_%').order('id')),
    olimpEntriesRes: supabase.from('olimpiada_entries')
      .select('token, child_name, created_at, paid_at, started_at, finished_at, score, max_score, level, open_answer, open_answer_at, print_paid_at, print_order, wfp_last_status, amount, source, parent_email')
      .limit(10000),
    // Педагоги (11.10.2026) — окремими запитами: поки міграцію
    // 20261011_olimpiada_teachers не застосовано, падають лише вони, а не
    // весь блок олімпіади (у запиті вище teacher_code ще немає).
    olimpTeachersRes: supabase.from('olimpiada_teachers').select('code, email, created_at').limit(10000),
    olimpTeacherEntriesRes: supabase.from('olimpiada_entries')
      .select('teacher_code, finished_at, wfp_last_status, parent_email').not('teacher_code', 'is', null).limit(10000),
  });
  // Власні записи Марії (lib/own.js) у метрики не йдуть (08.10.2026).
  const olimpWait = notOwn(olimpWaitRes?.data);
  const olimp = olimpStats({ waitlist: olimpWait, entries: notOwn(olimpEntriesRes?.data), now: new Date() });
  const olimpPeople = notOwn(olimpEntriesRes?.data).filter((e) => e.wfp_last_status !== 'Test' && e.paid_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const olimpT = olimpTraffic({ events: olimpEventsRes?.data || [], waitlist: olimpWait, now: new Date() });
  const olimpTeach = olimpTeachers({ teachers: notOwn(olimpTeachersRes?.data), entries: notOwn(olimpTeacherEntriesRes?.data) });

  const subs = notOwn(subsRes.data);
  const allSubs = notOwn(allSubsRes.data);
  const ownSubs = (allSubsRes.data || []).length - allSubs.length;
  const childIds = new Set((kidsRes.data || []).map((k) => k.subscriber_id));
  // Медіакіт: GA4 із сервера (lib/ga4.js). Помилка GA4 не валить сторінку —
  // решта метрик з бази має показуватись і тоді.
  let kit;
  try {
    kit = await mediaKit({ children: kidsRes.data || [] });
  } catch (e) {
    kit = { configured: true, error: String(e.message || e).slice(0, 300) };
  }
  const site = { visit: siteVisit, plus_view: sitePlusView, plus_click: sitePlusClick };
  const funnel = plusFunnel({ subs: allSubs, childIds, site });
  const sources = plusSources(allSubs);
  const funnelFirst = funnel[0]?.n || 0;
  const half = subs.filter((s) => s.billing_period === 'halfyear').length;
  const yearly = subs.filter((s) => s.billing_period === 'yearly').length;
  // Подарунковий місяць за участь в олімпіаді — активна підписка, але не дохід.
  const gift = subs.filter((s) => s.billing_period === 'gift').length;
  const monthly = subs.length - half - yearly - gift;
  const mrr = Math.round(monthly * PRICE_MONTH + half * (PRICE_HALF / 6) + yearly * (PRICE_YEAR_OLD / 12));

  // Промокоди: рахуємо і введення, і оплати. Різниця між ними — головне,
  // що тут видно: код привів людей, але ціна їх не вмовила (або навпаки).
  const promoUses = notOwn(promoRes.data);
  const byCode = new Map();
  for (const u of promoUses) {
    const row = byCode.get(u.code) || { code: u.code, entered: 0, paid: 0, sum: 0, sources: new Map() };
    row.entered += 1;
    if (u.paid_at) { row.paid += 1; row.sum += Number(u.paid_amount || 0); }
    row.sources.set(u.source || '—', (row.sources.get(u.source || '—') || 0) + 1);
    byCode.set(u.code, row);
  }
  const promoCodes = [...byCode.values()].sort((a, b) => b.entered - a.entered);
  const dt = (iso) => (iso ? new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }) : '—');

  // Робота модераторів: хто скільки схвалив, пропустив і поставив питань.
  // До 24.09.2026 імені в базі не було зовсім, тож рядки почнуть зʼявлятись
  // лише з цієї дати — старі рішення в статистику не потраплять.
  const actions = actionsRes?.data || [];
  const byActor = new Map();
  for (const a of actions) {
    const row = byActor.get(a.actor) || { actor: a.actor, approve: 0, skip: 0, comment: 0, other: 0, week: 0 };
    if (a.action in row) row[a.action] += 1; else row.other += 1;
    if (new Date(a.created_at) >= new Date(iso(7))) row.week += 1;
    byActor.set(a.actor, row);
  }
  const moderators = [...byActor.values()].sort((a, b) => b.approve - a.approve);

  const snaps = snapshotsRes.data || [];
  const latest = snaps[0];
  const weekAgo = snaps.find((s) => s.day <= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const tgNow = latest?.telegram_members ?? null;
  const tgDelta = tgNow != null && weekAgo?.telegram_members != null
    ? tgNow - weekAgo.telegram_members : null;

  return (
    <main style={wrap}>
      <AdminNav current="metrics" />
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Метрики</h1>

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

      <h2 style={h2S}>🧑‍⚖️ Робота в черзі, 30 днів</h2>
      {moderators.length ? (
        <table style={{ borderCollapse: 'collapse', fontSize: 14, marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#54617a' }}>
              <th style={{ padding: '6px 18px 6px 0' }}>Хто</th>
              <th style={{ padding: '6px 18px 6px 0' }}>Схвалив</th>
              <th style={{ padding: '6px 18px 6px 0' }}>Пропустив</th>
              <th style={{ padding: '6px 18px 6px 0' }}>Питань</th>
              <th style={{ padding: '6px 0' }}>За 7 днів</th>
            </tr>
          </thead>
          <tbody>
            {moderators.map((m) => (
              <tr key={m.actor} style={{ borderTop: '1px solid #e2e8f2' }}>
                <td style={{ padding: '7px 18px 7px 0', fontWeight: 600 }}>{m.actor}</td>
                <td style={{ padding: '7px 18px 7px 0' }}>{m.approve}</td>
                <td style={{ padding: '7px 18px 7px 0' }}>{m.skip}</td>
                <td style={{ padding: '7px 18px 7px 0' }}>{m.comment}</td>
                <td style={{ padding: '7px 0' }}>{m.week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={noteS}>Журнал порожній: рішення в черзі почали записуватись з іменем 24.09.2026.</p>
      )}

      <h2 style={h2S}>📣 Маркетинг</h2>
      <div style={grid}>
        <Card value={waitlist} delta={waitlist7 || null} label="у списку очікування Dityam+ (Δ за 7 днів)" />
        <Card value={Math.max(0, (profiles || 0) - ownSubs)} label="профілів дитини заповнено (digest)" />
        <Card value={feedback7} label="голосів 👍/👎 у каналі за 7 днів" />
        <Card value={outcomes} label="історій «я подався» від батьків" />
      </div>
      <p style={noteS}>
        Органіка і AI-трафік — у <a href="https://analytics.google.com" target="_blank" rel="noreferrer">GA4</a> та{' '}
        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console</a>.
      </p>

      <h2 style={h2S}>🧩 Онлайн-олімпіада {OLIMP_OPEN ? '' : '· реєстрація ще закрита'}</h2>
      <div style={grid}>
        <Card value={olimp.waitlist} delta={olimp.waitlist7 || null} label="email у списку очікування (Δ за 7 днів)" />
        <Card value={olimp.waitlist1} label="нових email за 24 години" />
        {/* З 08.10.2026 участь безкоштовна: «зареєструвались» = доступ до тесту відкрито. */}
        <Card value={olimp.paid} label="зареєструвались (участь безкоштовна)" />
        <Card value={olimp.finished} label={`пройшли тест (почали: ${olimp.started})`} />
        <Card value={olimp.open} label="відповіли на останнє, відкрите завдання тесту" />
        <Card value={olimp.prints} label={`замовили друкований диплом (${OLIMP.printPrice} грн з доставкою)`} />
        {/* Де губляться замовлення друку (11.10.2026: «чому ніхто не замовляє друк диплому»). */}
        <Card value={`${olimpT.printOpen} / ${olimpT.printSubmit} / ${olimp.prints}`} label={`друк: натиснули «Так, замовити» / відправили форму / оплатили${olimpT.printOpenSources.length ? ` · звідки: ${olimpT.printOpenSources.map(([s, n]) => `${s} — ${n}`).join(', ')}` : ''}`} />
        <Card value={`${olimp.revenue.toLocaleString('uk-UA')} грн`} label="виручка: друковані дипломи" />
        {/* Педагоги (11.10.2026): блок «Для педагогів» на /olimpiada. */}
        <Card value={`${olimpTeach.teachers} / ${olimpTeach.finished}`} label={`педагогів зареєструвалось / учнів пройшли олімпіаду за їхніми посиланнями (заявок: ${olimpTeach.entries}; педагогів з подякою: ${olimpTeach.thanked})`} />
      </div>
      <p style={noteS}>
        {olimp.levels.length ? `Рівні: ${olimp.levels.map(([k, n]) => `${k} — ${n}`).join(', ')}. ` : ''}
        {olimp.avgScore != null ? `Середній бал: ${olimp.avgScore}. ` : ''}
        {olimp.sources.length ? `Звідки email: ${olimp.sources.map(([s, n]) => `${s} — ${n}`).join(', ')}. ` : ''}
        Тестові записи адміна сюди не входять: {olimp.tests}.
      </p>

      {/* Хто саме проходив — з результатом і відповіддю на відкрите завдання
          (Марія, 09.10.2026: «я не зрозуміла, де ці люди… як мені побачити їх
          результати і відповіді»). Найсвіжіші зверху; тести адміна й власні
          записи Марії — ні. Текст відкритого завдання — повністю, для журі. */}
      <h3 style={{ ...h2S, fontSize: 17, marginTop: 18 }}>Учасники · {olimpPeople.length}</h3>
      {olimpPeople.length === 0 ? <p style={noteS}>Ще ніхто не подав заявку.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 14 }}>
            <thead>
              <tr>
                {['Коли', 'Дитина', 'Email', 'Результат', 'Відкрите завдання', 'Друк'].map((h) => (
                  <th key={h} style={olTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {olimpPeople.map((e) => (
                <tr key={e.token}>
                  <td style={{ ...olTd, whiteSpace: 'nowrap' }}>{dt(e.created_at)}</td>
                  <td style={olTd}>
                    {e.finished_at
                      ? <a href={`/olimpiada/test?t=${e.token}`} target="_blank" rel="noopener noreferrer">{e.child_name}</a>
                      : e.child_name}
                  </td>
                  <td style={olTd}>{e.parent_email || '—'}</td>
                  <td style={{ ...olTd, whiteSpace: 'nowrap' }}>
                    {e.finished_at ? `${e.score} з ${e.max_score} · ${levelByKey(e.level).label.toLowerCase()}`
                      : e.started_at ? 'почали тест' : 'ще не починали'}
                  </td>
                  <td style={{ ...olTd, maxWidth: 380, whiteSpace: 'pre-wrap' }}>{e.open_answer || '—'}</td>
                  <td style={olTd}>{e.print_paid_at ? `✅ ${e.print_order?.city || ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ ...h2S, fontSize: 17, marginTop: 18 }}>Сторінка /olimpiada і попап на фільтрі</h3>
      <div style={grid}>
        <Card value={olimpT.views} delta={olimpT.views7 || null} label="відкрили сторінку олімпіади (сесій; Δ за 7 днів)" />
        <Card value={olimpT.views1} label="відкрили за 24 години" />
        <Card value={olimpT.cta} label="натиснули кнопку-заклик на сторінці" />
        <Card value={olimpT.pageEmails} label={`email зі сторінки${olimpT.pageRate != null ? ` · ${olimpT.pageRate}% від тих, хто відкрив` : ''}`} />
        <Card value={olimpT.top} label="клікнули олімпіаду в «Топ 3 цього тижня»" />
        <Card value={olimpT.popupShow} label="попап на фільтрі: показано" />
        <Card value={olimpT.popupEmails} label={`попап: залишили email${olimpT.popupRate != null ? ` · ${olimpT.popupRate}% показів` : ''}`} />
        <Card value={`${olimpT.popupMore} / ${olimpT.popupClose}`} label="попап: «Детальніше» / закрили без дії" />
      </div>
      <p style={noteS}>
        {olimpT.viewSources.length ? `Звідки відкривають: ${olimpT.viewSources.map(([s, n]) => `${s} — ${n}`).join(', ')}. ` : ''}
        {olimpT.ctaSpots.length ? `Які кнопки: ${olimpT.ctaSpots.map(([s, n]) => `${s} — ${n}`).join(', ')}. ` : ''}
        Рахуємо з 06.10.2026, власними лічильниками сайту (site_events): GA4 не бачить тих, хто блокує аналітику.
        Браузери, позначені через ?noga=1 (ваш і модераторів), не рахуються.
      </p>

      <h2 style={h2S}>📊 Медіакіт — показники для рекламодавця</h2>
      <MediaKit kit={kit} />

      <h2 style={h2S}>🪜 Воронка Dityam+</h2>
      {funnelFirst === 0 ? (
        <p style={noteS}>Ще ніхто не відкривав бота.</p>
      ) : (
        <>
          <div style={{ ...cardS, padding: '4px 14px 8px' }}>
            {funnel.map((f) => <FunnelRow key={f.key} s={f} first={funnelFirst} />)}
          </div>
          <p style={noteS}>
            Колонки: скільки людей · частка від першого кроку · скільки втратили саме тут.
            Хто де завис поіменно — на <a href="/admin/plus">сторінці Dityam+</a>.
            {site.visit
              ? 'Кроки сайту рахуємо своїми лічильниками з 29.09.2026 — до того їх ніхто не збирав, тож перші дні числа будуть неповні. Ваші заходи (?noga=1) не рахуються.'
              : 'Кроків сайту ще немає: лічильники ввімкнено 29.09.2026, перші числа з’являться за кілька годин.'}
          </p>
          {sources.length > 1 && (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13.5, width: '100%', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#54617a' }}>
                    {['Звідки прийшли', 'Усього', 'Оплатили'].map((h) => (
                      <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #e3e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map((r) => (
                    <tr key={r.source}>
                      <td style={{ padding: '5px 10px' }}>{r.source}</td>
                      <td style={{ padding: '5px 10px' }}>{r.all}</td>
                      <td style={{ padding: '5px 10px', color: r.paid ? '#15803d' : '#8a94a6' }}>{r.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 style={h2S}>💰 Dityam+</h2>
      <div style={grid}>
        <Card value={subs.length} label={`активних платних підписок (${monthly} міс · ${half} пів року${yearly ? ` · ${yearly} річн` : ''})`} />
        <Card value={`${mrr} грн`} label="MRR (місячний еквівалент)" />
        <Card value={waitlist ? `${Math.round((subs.length / waitlist) * 100)}%` : '—'} label="конверсія waitlist → оплата" />
      </div>

      <h2 style={h2S}>🎁 Промокоди</h2>
      {promoCodes.length === 0 ? (
        <p style={noteS}>Ще ніхто не вводив. Посилання для поста: <code>https://t.me/DityamPlusBot?start=promo_first_kanal</code> — суфікс після коду стає джерелом.</p>
      ) : (
        <>
          <div style={grid}>
            {promoCodes.map((c) => (
              <Card key={c.code} value={`${c.paid} / ${c.entered}`}
                label={`${c.code.toUpperCase()}: оплатили / ввели · ${c.sum} грн · ${[...c.sources.entries()].map(([k, n]) => `${k}: ${n}`).join(', ')}`} />
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13.5, width: '100%', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#54617a' }}>
                  {['Код', 'Хто', 'Звідки', 'Ввів', 'Оплатив'].map((h) => (
                    <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #e3e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promoUses.slice(0, 25).map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: '5px 10px' }}>{u.code.toUpperCase()}</td>
                    <td style={{ padding: '5px 10px' }}>{u.telegram_username ? `@${String(u.telegram_username).replace(/^@/, '')}` : u.telegram_chat_id}</td>
                    <td style={{ padding: '5px 10px' }}>{u.source || '—'}</td>
                    <td style={{ padding: '5px 10px' }}>{dt(u.created_at)}</td>
                    <td style={{ padding: '5px 10px', color: u.paid_at ? '#15803d' : '#8a94a6' }}>
                      {u.paid_at ? `${dt(u.paid_at)} · ${u.paid_amount ?? '—'} грн` : 'ще ні'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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
