import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { canonicalUrl } from '@/lib/canonical.mjs';
import { safeEqual } from '@/lib/adminAuth';
import { originOf, broughtBy, repliesByEmail } from '@/lib/suggestions';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';
import MessageList from './MessageList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Звернення',
  robots: { index: false, follow: false },
};

const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' };

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
    imported: 'додано чернеткою',
    duplicate: 'уже є на сайті',
    needs_human: 'автоматично не вийшло, чекає на людину',
    rejected: 'відхилено: немає посилання на можливість',
    done: 'опрацьовано вручну',
    added: 'додано вручну — запис у черзі модерації',
    dismissed: 'відхилено вручну',
  };
  // «Лист відправнику пішов» — лише там, куди скрипт справді міг його
  // надіслати: пошта людини з поп-апа. До 21.09.2026 так підписувались і
  // пропозиції з Telegram-каналом чи Facebook у контакті, і внесені вручну.
  const outcomeOf = (s) => {
    const base = OUTCOME[s.status];
    if (!base) return null;
    return ['imported', 'duplicate'].includes(s.status) && repliesByEmail(s)
      ? `${base}, лист відправнику пішов`
      : base;
  };

  // Який запис на сайті вже відповідає пропозиції — за тією самою сторінкою.
  // Так і автоматичний імпорт, і «Додати на сайт» ведуть до правки одним
  // кліком, а повторне «Додати» не кладе поряд другий запис.
  const sugUrls = [...new Set((sugRes.data || []).map((s) => s.url).filter(Boolean))];
  const linked = new Map();
  if (sugUrls.length) {
    const canon = sugUrls.map((u) => [u, canonicalUrl(u)]);
    const opps = [];
    // Порціями: сотня адрес в одному запиті — задовгий рядок URL для PostgREST.
    for (let i = 0; i < canon.length; i += 30) {
      const part = canon.slice(i, i + 30);
      const [bySource, byCanon] = await Promise.all([
        supabase.from('opportunities').select('id, status, source_url, canonical_url')
          .is('canonical_slug', null).in('source_url', part.map(([u]) => u)),
        supabase.from('opportunities').select('id, status, source_url, canonical_url')
          .is('canonical_slug', null).in('canonical_url', part.map(([, c]) => c).filter(Boolean)),
      ]);
      opps.push(...(bySource.data || []), ...(byCanon.data || []));
    }
    for (const [u, c] of canon) {
      const hit = opps.find((o) => o.source_url === u || (c && o.canonical_url === c));
      if (hit) linked.set(u, hit);
    }
  }

  const suggestions = (sugRes.data || []).map((s) => ({
    id: s.id,
    type: 'opportunity',
    name: null,
    contact: s.contact,
    message: [s.title, s.comment].filter(Boolean).join('\n\n'),
    url: s.url,
    page: null,
    origin: originOf(s),
    broughtBy: broughtBy(s),
    // needs_human — теж «нове»: скрипт не впорався, і рішення за людиною. До
    // 15.09.2026 такі пропозиції показувались опрацьованими.
    status: ['new', 'needs_human'].includes(s.status) ? 'new' : 'done',
    outcome: outcomeOf(s),
    admin_note: null,
    created_at: s.created_at,
    kind: 'suggestion',
    opportunityId: linked.get(s.url)?.id || null,
    opportunityStatus: linked.get(s.url)?.status || null,
  }));

  const rows = [...(msgRes.data || []), ...suggestions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const newCount = rows.filter((r) => r.status === 'new').length;
  // Скільки можливостей нам принесли люди. Окремо від звернень: це не
  // «питання», а найдешевше джерело даних, що в нас є, і його треба бачити.
  // Лише поп-ап: до 21.09.2026 тут рахувались і 14 рядків нашого власного
  // дослідження, і те, що Марія вносила сама, — «принесли люди: 21» при
  // шести справжніх.
  const sugAll = sugRes.data || [];
  const fromPeople = sugAll.filter((s) => originOf(s) === 'popup');
  const sugTotal = fromPeople.length;
  // «Додано» — і автоматикою, і кнопкою «Додати на сайт».
  const sugImported = fromPeople.filter((s) => ['imported', 'added'].includes(s.status)).length;
  const byMaria = sugAll.filter((s) => originOf(s) === 'maria').length;
  const byResearch = sugAll.filter((s) => originOf(s) === 'research').length;
  const manual = [byMaria ? `Марія ${byMaria}` : null, byResearch ? `дослідження ${byResearch}` : null]
    .filter(Boolean).join(', ');
  // Чекає — усі, хай хто приніс: рішення за людиною однаково.
  const sugWaiting = sugAll.filter((s) => s.status === 'new' || s.status === 'needs_human').length;

  return (
    <main style={wrap}>
      <AdminNav current="messages" />
      <h1 style={{ fontSize: 24, margin: 0 }}>
        Звернення {newCount > 0 && <span style={{ color: '#c8501a' }}>· {newCount} нових</span>}
      </h1>

      <p style={{ fontSize: 13.5, color: '#6b6b6b', margin: '6px 0 0' }}>
        Форма на <a href="/contacts" target="_blank" rel="noopener noreferrer">/contacts</a> та
        пропозиції з поп-апа каталогу. Про кожне нове звернення бот пише в адмін-чат.
      </p>

      <p style={{ fontSize: 14, margin: '10px 0 0', padding: '9px 12px', borderRadius: 10, background: '#f3f6fb', color: '#54617a' }}>
        💡 Можливостей принесли люди: <b>{sugTotal}</b>
        {sugImported > 0 ? <> · додано {sugImported}</> : null}
        {manual ? <> · ще {byMaria + byResearch} внесли ми самі ({manual})</> : null}
        {sugWaiting > 0 ? <> · <b style={{ color: '#b4530a' }}>чекає {sugWaiting}</b></> : null}
      </p>

      <MessageList initial={rows} />
    </main>
  );
}
