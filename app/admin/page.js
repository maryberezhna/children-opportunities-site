import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import { quarantineCriteria, quarantineSnippet } from '@/lib/quarantine';
import { kyivToday } from '@/lib/dates';
import AdminList from './AdminList';
import AdminNav from './AdminNav';
import LoginForm from './LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Модерація',
  robots: { index: false, follow: false },
};

// Карантин переїхав сюди з окремої сторінки (Марія, 22.09.2026: «зроби так,
// щоб карантин і черга були 1 сторінкою»; до того — «чим відрізняється
// карантин і черга, я нічого не розумію»). Це не два види записів, а два
// кроки одного шляху: сира знахідка → кандидат із полями → сайт.
//
// 23.09.2026 Марія намалювала на папері, як ця сторінка має виглядати:
// «Потребує рішення» — і показувати, ЧОМУ саме цей запис сюди потрапив,
// сортувати за найближчим дедлайном; «Активні» — те, що зараз на сайті,
// просто продивлятися. Тож замість пʼяти вкладок тут два розділи, а знахідки,
// «чекає машину» й неповні — рядком під заголовком.
const QUARANTINE_LIMIT = 150;

// format/cities/countries/is_international і event_end_date тягнемо не для
// показу, а щоб порахувати обовʼязковий мінімум прямо в черзі: без них
// картка не знала б, що запису бракує «де» або дати (11.09.2026).
// child_needs — щоб черга впізнала вразливу тему (статусні групи дітей)
// і поставила такий запис першим (22.09.2026).
// link_status — щоб причина на картці могла сказати «посилання не
// відкривається»: конвеєр це знав (scraper/auto_review.py), а людина в черзі
// не бачила ніде (23.09.2026).
const REQUIRED_EXTRA = 'event_start_date, event_end_date, format, cities, countries, is_international, evidence, child_needs, link_status';
const DRAFT_FIELDS =
  `id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, recurrence, dup_of, dup_score, admin_comment, created_at, ${REQUIRED_EXTRA}`;
const ACTIVE_FIELDS =
  `id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, recurrence, verified_at, admin_comment, dup_of, dup_score, created_at, ${REQUIRED_EXTRA}`;

export default async function AdminPage({ searchParams }) {
  const configured = adminConfigured();
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = isAdmin(cookie);

  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
        <h1 style={{ fontSize: 22 }}>Модерація можливостей</h1>
        {token
          ? <LoginForm />
          : <p style={{ color: '#b4530a' }}>Адмінка не налаштована: задайте змінну середовища <code>ADMIN_TOKEN</code>.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let drafts = [];
  let actives = [];
  let raw = [];
  let matches = {};
  const notes = {};
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [d, a, rawRes, srcRes] = await Promise.all([
      supabase.from('opportunities').select(DRAFT_FIELDS)
        .eq('status', 'draft').order('created_at', { ascending: false }).limit(300),
      supabase.from('opportunities').select(ACTIVE_FIELDS)
        .eq('status', 'active')
        // unverified first, then newest
        .order('verified_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(600),
      supabase.from('raw_items')
        .select('id, source_name, source_url, canonical_url, raw_title, raw_text, confidence, fetched_at')
        .eq('status', 'review').is('review_verdict', null)
        .order('fetched_at', { ascending: false }).limit(QUARANTINE_LIMIT),
      supabase.from('sources').select('name, trust_tier'),
    ]);
    drafts = d.data || [];
    actives = a.data || [];

    // Порядок сирих знахідок — спершу надійніші джерела (trust_tier 1 —
    // держ/офіційні), усередині від найвпевненішого: рідкісне міжнародне має
    // потрапляти на очі першим, а не тонути серед свіжого шуму з Telegram.
    const tier = new Map((srcRes.data || []).map((x) => [x.name, x.trust_tier]));
    raw = (rawRes.data || [])
      .map((r) => ({
        id: r.id,
        raw_title: r.raw_title,
        source_name: r.source_name,
        trust_tier: tier.get(r.source_name) ?? null,
        confidence: r.confidence,
        url: r.canonical_url || r.source_url,
        raw_text: String(r.raw_text || '').slice(0, 6000),
        snippet: quarantineSnippet(r.raw_text),
        // По весь текст, а не по обрізаних 6000: дедлайн буває й наприкінці.
        criteria: quarantineCriteria(r.raw_title, r.raw_text),
      }))
      .sort((a1, b1) => (a1.trust_tier ?? 9) - (b1.trust_tier ?? 9)
        || (b1.confidence ?? 0) - (a1.confidence ?? 0));

    // Fetch the matched opportunities so the UI can show both side by side.
    const dupSlugs = [...new Set([...drafts, ...actives].map((o) => o.dup_of).filter(Boolean))];
    if (dupSlugs.length) {
      const { data: m } = await supabase
        .from('opportunities')
        .select('slug, title, source, source_url, deadline, opportunity_type, age_from, age_to, cost_type')
        .in('slug', dupSlugs);
      matches = Object.fromEntries((m || []).map((x) => [x.slug, x]));
    }

    // Відкриті коментарі людини — на картку, щоб наступний модератор бачив
    // питання, яке вже поставили. Збій тут не валить чергу: без коментарів
    // картки лишаються робочими.
    const { data: n } = await supabase
      .from('moderation_notes')
      .select('id, opportunity_id, body, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(500);
    for (const x of n || []) (notes[x.opportunity_id] ||= []).push(x);
  }

  return (
    // Ширину задає сітка в AdminList: список лишається на тому ж місці, що
    // й на інших сторінках адмінки, а правила стають у порожнє поле ліворуч.
    <main style={{ margin: '32px 0 80px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <AdminList
        drafts={drafts}
        actives={actives}
        raw={raw}
        matches={matches}
        notes={notes}
        // «Сьогодні» рахуємо на сервері за Києвом і передаємо пропом: інакше
        // сервер і браузер порахують «скільки лишилось» по-різному й React
        // перемалює список заново (див. lib/dates.js).
        today={kyivToday()}
        initialTab={searchParams?.tab}
      >
        <AdminNav current="queue" />
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Модерація</h1>
        <p style={{ color: '#54617a', fontSize: 16, margin: 0, lineHeight: 1.5 }}>
          Два питання: що від тебе хочуть і що вже живе на сайті.
        </p>
      </AdminList>
    </main>
  );
}
