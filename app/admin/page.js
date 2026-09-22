import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { mergeDraftDups } from '@/lib/adminDups';
import AdminList from './AdminList';
import AdminNav from './AdminNav';
import LoginForm from './LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Модерація',
  robots: { index: false, follow: false },
};

// format/cities/countries/is_international і event_end_date тягнемо не для
// показу, а щоб порахувати обовʼязковий мінімум прямо в черзі: без них
// картка не знала б, що запису бракує «де» або дати (11.09.2026).
const REQUIRED_EXTRA = 'event_start_date, event_end_date, format, cities, countries, is_international';
// Дублі для кандидатів шукає система при кожному відкритті черги (Марія,
// 22.09.2026: «це не має перевіряти людина»). Поріг тригамної схожості назв
// той самий, що в судді дублів: Jeugdfonds у черзі й на сайті — 0.35, а це
// та сама програма. Хибний збіг на плашці не страшний: вона каже «порівняй».
const DRAFT_DUP_SIM = 0.35;
const DRAFT_FIELDS =
  `id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, recurrence, dup_of, dup_score, admin_comment, created_at, ${REQUIRED_EXTRA}`;
const ACTIVE_FIELDS =
  `id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, recurrence, verified_at, admin_comment, dup_of, dup_score, created_at, ${REQUIRED_EXTRA}`;

export default async function AdminPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);

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
  let matches = {};
  const notes = {};
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [d, a, dd] = await Promise.all([
      supabase.from('opportunities').select(DRAFT_FIELDS)
        .eq('status', 'draft').order('created_at', { ascending: false }).limit(300),
      supabase.from('opportunities').select(ACTIVE_FIELDS)
        .eq('status', 'active')
        // unverified first, then newest
        .order('verified_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(600),
      // Збій цього запиту не валить чергу: без нього лишаються плашки агента.
      supabase.rpc('find_draft_dups', { sim_threshold: DRAFT_DUP_SIM }),
    ]);
    drafts = mergeDraftDups(d.data || [], dd.data || []);
    actives = a.data || [];

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
      <AdminList drafts={drafts} actives={actives} matches={matches} notes={notes}>
        <AdminNav current="queue" />
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Модерація</h1>
        <p style={{ color: '#54617a', fontSize: 16, margin: 0 }}>
          Кандидати від агента чекають на схвалення. Активні — для ручної перевірки посилань.
        </p>
      </AdminList>
    </main>
  );
}
