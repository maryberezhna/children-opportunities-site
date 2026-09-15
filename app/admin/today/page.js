import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { missingRequired } from '@/lib/required';
import { planEntryFor, kyivIso, addDays } from '../../../scripts/channel-plan.mjs';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Сьогодні',
  robots: { index: false, follow: false },
};

/**
 * «Сьогодні» — з чого почати день в адмінці (15.09.2026).
 *
 * Марія про стару адмінку: «ти думаєш це норм адмінка?». Меню було розкладене
 * за таблицями бази, і щоб зрозуміти, що горить, треба було обійти чотири
 * сторінки. Тут усе, що вимагає дії, одним списком — від найтерміновішого — і
 * по картці на кожен напрям із переходом туди, де цю дію роблять.
 */

const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b',
  border: '#e2e8f2', bg: '#f7f9fc', green: '#15803d', amber: '#b45309', accent: '#c8501a', link: '#1e4fd6',
};
const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: C.ink };
const h2S = { fontSize: 17, margin: '28px 0 10px' };
const noteS = { fontSize: 13, color: C.ink3, margin: '6px 0 0', lineHeight: 1.5 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 };
const cardS = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', background: '#fff' };
const rowS = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 14 };
const DAY = 86400000;
const PLAN_URL = 'https://app.notion.com/p/3dc7ce5a2e978181be79d3d1d4a766cd';

// Той самий підрахунок, що на /admin/zakhysnyky: конвеєр пише «бракує: …» у
// коментар і там вік рахується чесно (порожній вік у базі зберігається як
// 0–18, тож missingRequired по рядку його не бачить).
function missingOf(o) {
  const m = /бракує: ([^·]+)/.exec(o.admin_comment || '');
  if (m) return m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return missingRequired(o);
}

const FILE_LABEL = {
  'obminy.html': 'готовий пост: програми обміну',
  'dity-zakhysnykiv.html': 'готовий пост: дітям захисників',
  'olimpiady.html': 'готовий пост: олімпіади',
  'onlain.html': 'готовий пост: онлайн',
  'dedlainy-dva-tyzhni.html': 'готовий пост: дедлайни двох тижнів',
  'za-kordonom.html': 'готовий пост: за кордоном',
};

function planLabel(entry) {
  if (entry.heading) return entry.heading.replace(/<[^>]+>/g, '');
  if (entry.kind === 'situation') return 'життєва ситуація';
  if (entry.kind === 'number') return 'цифра дня';
  if (entry.kind === 'file') return FILE_LABEL[entry.file] || `готовий пост: ${entry.file}`;
  return entry.key;
}

function Row({ label, value, tone }) {
  return (
    <div style={rowS}>
      <span style={{ color: C.ink2 }}>{label}</span>
      <b style={{ color: tone || C.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    </div>
  );
}

function Card({ title, href, linkText, children }) {
  return (
    <div style={cardS}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>{title}</h3>
        {href && <a href={href} style={{ fontSize: 13, color: C.link, textDecoration: 'none' }} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{linkText || 'Відкрити'} →</a>}
      </div>
      {children}
    </div>
  );
}

export default async function TodayPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Сьогодні</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const count = (table, filter) => filter(supabase.from(table).select('id', { count: 'exact', head: true }));
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();

  const [draftsRes, msgs, sugs, subsRes, active, added7, snapsRes] = await Promise.all([
    supabase.from('opportunities')
      .select('id, age_from, age_to, deadline, event_end_date, recurrence, cost_type, opportunity_type, format, cities, countries, is_international, admin_comment, child_needs')
      .eq('status', 'draft').limit(500),
    count('contact_messages', (q) => q.eq('status', 'new')),
    count('opportunity_suggestions', (q) => q.in('status', ['new', 'needs_human'])),
    supabase.from('digest_subscribers').select('status, created_at, updated_at').limit(1000),
    count('opportunities', (q) => q.eq('status', 'active')),
    count('opportunities', (q) => q.gte('created_at', since7)),
    supabase.from('metrics_daily').select('day, telegram_members').order('day', { ascending: false }).limit(8),
  ]);

  const drafts = draftsRes.data || [];
  const ready = drafts.filter((o) => missingOf(o).length === 0).length;
  const needData = drafts.length - ready;
  const defenders = drafts.filter((o) => (o.child_needs || []).includes('veteran_family')).length;

  const newMessages = msgs.count ?? 0;
  const waitingSuggestions = sugs.count ?? 0;

  const subs = subsRes.data || [];
  const activeSubs = subs.filter((s) => s.status === 'active').length;
  const paused = subs.filter((s) => s.status === 'paused').length;
  const stuck = subs.filter((s) => s.status === 'pending'
    && new Date(s.updated_at || s.created_at).getTime() < Date.now() - DAY).length;

  const snaps = snapsRes.data || [];
  const tgNow = snaps[0]?.telegram_members ?? null;
  const tgWeekAgo = snaps.find((s) => s.day <= new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10))?.telegram_members;
  const tgDelta = tgNow != null && tgWeekAgo != null ? tgNow - tgWeekAgo : null;

  const today = kyivIso();
  const todayPost = planEntryFor(today);
  const tomorrowPost = planEntryFor(addDays(today, 1));

  // Що зробити — від найтерміновішого: гроші й люди раніше за контент.
  const todo = [
    paused && { text: `${paused} ${paused === 1 ? 'підписка' : 'підписок'} Dityam+ на паузі — оплата не пройшла`, href: '/admin/plus', tone: C.accent },
    (newMessages + waitingSuggestions) && { text: `${newMessages} нових звернень і ${waitingSuggestions} пропозицій чекають на рішення`, href: '/admin/messages', tone: C.accent },
    ready && { text: `${ready} чернеток готові до публікації — усі поля є`, href: '/admin', tone: C.green },
    stuck && { text: `${stuck} людей застрягли в оформленні Dityam+ понад добу`, href: '/admin/plus', tone: C.amber },
    needData && { text: `${needData} чернеток чекають даних${defenders ? ` (з них «Дітям захисників» — ${defenders})` : ''}`, href: '/admin', tone: C.ink2 },
  ].filter(Boolean);

  const dateLabel = new Date().toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv', weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main style={wrap}>
      <AdminNav current="today" />
      <h1 style={{ fontSize: 24, margin: 0 }}>Сьогодні</h1>
      <p style={noteS}>{dateLabel}</p>

      <h2 style={h2S}>Що зробити зараз</h2>
      {todo.length === 0 ? (
        <p style={{ ...cardS, margin: 0, fontSize: 15 }}>Нічого термінового: черга, пошта й Dityam+ спокійні.</p>
      ) : (
        <ol style={{ ...cardS, margin: 0, paddingLeft: 36 }}>
          {todo.map((t) => (
            <li key={t.text} style={{ padding: '6px 0', fontSize: 15 }}>
              <a href={t.href} style={{ color: t.tone, fontWeight: 600, textDecoration: 'none' }}>{t.text} →</a>
            </li>
          ))}
        </ol>
      )}

      <div style={{ ...grid, marginTop: 18 }}>
        <Card title="🗂 Модерація" href="/admin" linkText="Черга">
          <Row label="готові до публікації" value={ready} tone={ready ? C.green : undefined} />
          <Row label="чекають даних" value={needData} />
          <Row label={<a href="/admin/zakhysnyky" style={{ color: C.link, textDecoration: 'none' }}>з них «Дітям захисників» →</a>} value={defenders} />
        </Card>

        <Card title="✉️ Пошта" href="/admin/messages" linkText="Звернення">
          <Row label="нових звернень" value={newMessages} tone={newMessages ? C.accent : undefined} />
          <Row label="пропозицій чекають на рішення" value={waitingSuggestions} tone={waitingSuggestions ? C.accent : undefined} />
        </Card>

        <Card title="💎 Dityam+" href="/admin/plus" linkText="Підписники">
          <Row label="активних підписок" value={activeSubs} tone={activeSubs ? C.green : undefined} />
          <Row label="застрягли в оформленні понад добу" value={stuck} tone={stuck ? C.amber : undefined} />
          <Row label="пауза — оплата не пройшла" value={paused} tone={paused ? C.accent : undefined} />
        </Card>

        <Card title="📣 Telegram-канал" href={PLAN_URL} linkText="План">
          <Row label="сьогодні" value={planLabel(todayPost)} />
          <Row label="завтра" value={planLabel(tomorrowPost)} />
          <p style={noteS}>Окремим постом — «🆕 Нова можливість», якщо є новинка.</p>
        </Card>

        <Card title="📈 Сайт" href="/admin/metrics" linkText="Метрики">
          <Row label="активних можливостей" value={active.count ?? '—'} />
          <Row label="додано за 7 днів" value={added7.count ?? '—'} />
          <Row label="підписників каналу" value={tgNow == null ? '—' : `${tgNow}${tgDelta != null ? ` (${tgDelta >= 0 ? '+' : ''}${tgDelta} за тиждень)` : ''}`} />
        </Card>
      </div>
    </main>
  );
}
