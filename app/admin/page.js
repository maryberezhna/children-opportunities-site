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
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase
      .from('opportunities')
      .select('id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, created_at')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(200);
    drafts = data || [];
  }

  return (
    <main style={{ maxWidth: 780, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>
        Кандидати на модерацію <span style={{ color: '#8a95a9', fontWeight: 400 }}>({drafts.length})</span>
      </h1>
      <p style={{ color: '#54617a', fontSize: 15, margin: 0 }}>
        Агент-розвідник знайшов ці можливості. Схвали — з'являться на сайті; пропусти — залишаться прихованими.
      </p>
      <AdminList initial={drafts} />
    </main>
  );
}
