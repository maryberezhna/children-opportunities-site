import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import AdminNav from '../../AdminNav';
import LoginForm from '../../LoginForm';
import EditForm from './EditForm';
import { isoWeek } from '@/lib/week';
import { isStubDraft } from '@/lib/suggestions';

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
      .select('id, title, summary, deadline, event_start_date, event_end_date, results_date, recurrence, age_from, age_to, cost_type, opportunity_type, format, cities, countries, is_international, source, source_url, apply_url, status, price_note, details, featured_week, admin_comment')
      .eq('id', params.id)
      .maybeSingle();
    opp = data;
  }

  if (!opp) {
    return wrap(<><h1 style={{ fontSize: 22 }}>Не знайдено</h1><p><a href="/admin" style={{ color: '#1e4fd6' }}>← До черги</a></p></>);
  }

  return wrap(
    <>
      {/* Меню тут потрібне найбільше: з редагування раніше не було виходу
          взагалі, крім кнопки «назад» у браузері. */}
      <AdminNav current="queue" />
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Редагувати можливість</h1>
      <p style={{ color: '#54617a', fontSize: 14, marginTop: 0 }}>{opp.source || '—'} · статус: <b>{opp.status}</b></p>
      {/* Чернетка з пропозиції: тип і вік у базі — заглушка, форма показує їх
          порожніми, доки їх не обере людина. */}
      <EditForm opp={{ ...opp, currentWeek: isoWeek() }} stub={isStubDraft(opp)} />
    </>,
  );
}
