import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import AdminList from './AdminList';
import LoginForm from './LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Модерація',
  robots: { index: false, follow: false },
};

const DRAFT_FIELDS =
  'id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, dup_of, dup_score, admin_comment, created_at';
const ACTIVE_FIELDS =
  'id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, verified_at, admin_comment, dup_of, dup_score, created_at';

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
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [d, a] = await Promise.all([
      supabase.from('opportunities').select(DRAFT_FIELDS)
        .eq('status', 'draft').order('created_at', { ascending: false }).limit(300),
      supabase.from('opportunities').select(ACTIVE_FIELDS)
        .eq('status', 'active')
        // unverified first, then newest
        .order('verified_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(600),
    ]);
    drafts = d.data || [];
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
  }

  return (
    <main style={{ maxWidth: 820, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Модерація</h1>
      <p style={{ color: '#54617a', fontSize: 15, margin: 0 }}>
        Кандидати від агента чекають на схвалення. Активні — для ручної перевірки посилань.
      </p>
      <AdminList drafts={drafts} actives={actives} matches={matches} />
    </main>
  );
}
