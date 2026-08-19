import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import LoginForm from '../LoginForm';
import MessageList from './MessageList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Звернення',
  robots: { index: false, follow: false },
};

const wrap = { maxWidth: 860, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' };

export default async function MessagesPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Звернення</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Пропозиції з поп-апа каталогу (opportunity_suggestions) показуємо тут же:
  // для власниці це одна пошта, а не два різні місця, куди треба не забути
  // заглянути. Мапимо їх у ту саму форму, що й звернення з форми.
  const [msgRes, sugRes] = await Promise.all([
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('opportunity_suggestions').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  const suggestions = (sugRes.data || []).map((s) => ({
    id: s.id,
    type: 'opportunity',
    name: null,
    contact: s.contact,
    message: [s.title, s.comment].filter(Boolean).join('\n\n'),
    url: s.url,
    page: 'поп-ап у каталозі',
    status: s.status === 'done' ? 'done' : 'new',
    admin_note: null,
    created_at: s.created_at,
    readOnly: true,
  }));

  const rows = [...(msgRes.data || []), ...suggestions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          Звернення {newCount > 0 && <span style={{ color: '#e85d24' }}>· {newCount} нових</span>}
        </h1>
        <nav style={{ display: 'flex', gap: 14, fontSize: 14 }}>
          <a href="/admin" style={{ color: '#54617a' }}>← Модерація</a>
          <a href="/admin/metrics" style={{ color: '#54617a' }}>📈 Метрики</a>
        </nav>
      </div>

      <p style={{ fontSize: 13.5, color: '#8a94a6', margin: '6px 0 0' }}>
        Форма на <a href="/contacts" target="_blank" rel="noopener noreferrer">/contacts</a> та
        пропозиції з поп-апа каталогу. Про кожне нове звернення бот пише в адмін-чат.
      </p>

      <MessageList initial={rows} />
    </main>
  );
}
