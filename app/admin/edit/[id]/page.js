import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import LoginForm from '../../LoginForm';
import EditForm from './EditForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Редагувати', robots: { index: false, follow: false } };

const wrap = (children) => (
  <main style={{ maxWidth: 640, margin: '40px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
    {children}
  </main>
);

export default async function EditPage({ params }) {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);

  if (!authed) {
    return wrap(
      <>
        <h1 style={{ fontSize: 22 }}>Редагування</h1>
        {token ? <LoginForm /> : <p style={{ color: '#b4530a' }}>Задайте <code>ADMIN_TOKEN</code>.</p>}
      </>,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let opp = null;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase
      .from('opportunities')
      .select('id, title, summary, deadline, age_from, age_to, cost_type, opportunity_type, source, source_url, status')
      .eq('id', params.id)
      .maybeSingle();
    opp = data;
  }

  if (!opp) {
    return wrap(<><h1 style={{ fontSize: 22 }}>Не знайдено</h1><p><a href="/admin" style={{ color: '#1e4fd6' }}>← До черги</a></p></>);
  }

  return wrap(
    <>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Редагувати можливість</h1>
      <p style={{ color: '#54617a', fontSize: 14, marginTop: 0 }}>{opp.source || '—'} · статус: <b>{opp.status}</b></p>
      <EditForm opp={opp} />
    </>,
  );
}
