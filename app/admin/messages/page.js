import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import AdminNav from '../AdminNav';
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

  // Що скрипт `process_suggestions.py` зробив із пропозицією. До 13.09.2026
  // тут було лише «нове» або «опрацьоване», і будь-який інший статус тихо
  // показувався як нове — тобто три пропозиції Seniv Studio виглядали б
  // необробленими навіть після того, як їх імпортували й відповіли листом.
  const OUTCOME = {
    imported: 'додано чернеткою, лист відправнику пішов',
    duplicate: 'уже є на сайті, лист відправнику пішов',
    needs_human: 'автоматично не вийшло, чекає на людину',
    rejected: 'відхилено: немає посилання на можливість',
    done: 'опрацьовано вручну',
  };

  const suggestions = (sugRes.data || []).map((s) => ({
    id: s.id,
    type: 'opportunity',
    name: null,
    contact: s.contact,
    message: [s.title, s.comment].filter(Boolean).join('\n\n'),
    url: s.url,
    page: 'поп-ап у каталозі',
    status: s.status === 'new' ? 'new' : 'done',
    outcome: OUTCOME[s.status] || null,
    admin_note: null,
    created_at: s.created_at,
    readOnly: true,
  }));

  const rows = [...(msgRes.data || []), ...suggestions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const newCount = rows.filter((r) => r.status === 'new').length;
  // Скільки можливостей нам принесли люди. Окремо від звернень: це не
  // «питання», а найдешевше джерело даних, що в нас є, і його треба бачити.
  const sugTotal = (sugRes.data || []).length;
  const sugImported = (sugRes.data || []).filter((s) => s.status === 'imported').length;
  const sugWaiting = (sugRes.data || [])
    .filter((s) => s.status === 'new' || s.status === 'needs_human').length;

  return (
    <main style={wrap}>
      <AdminNav current="messages" />
      <h1 style={{ fontSize: 24, margin: 0 }}>
        Звернення {newCount > 0 && <span style={{ color: '#e85d24' }}>· {newCount} нових</span>}
      </h1>

      <p style={{ fontSize: 13.5, color: '#8a94a6', margin: '6px 0 0' }}>
        Форма на <a href="/contacts" target="_blank" rel="noopener noreferrer">/contacts</a> та
        пропозиції з поп-апа каталогу. Про кожне нове звернення бот пише в адмін-чат.
      </p>

      <p style={{ fontSize: 14, margin: '10px 0 0', padding: '9px 12px', borderRadius: 10, background: '#f3f6fb', color: '#54617a' }}>
        💡 Можливостей принесли люди: <b>{sugTotal}</b>
        {sugImported > 0 ? <> · додано {sugImported}</> : null}
        {sugWaiting > 0 ? <> · <b style={{ color: '#b4530a' }}>чекає {sugWaiting}</b></> : null}
      </p>

      <MessageList initial={rows} />
    </main>
  );
}
