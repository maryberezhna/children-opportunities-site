import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { missingRequired } from '@/lib/required';
import { DEFENDERS_WATCH, WATCH_CHECKED } from '@/lib/defendersWatch';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Дітям захисників',
  robots: { index: false, follow: false },
};

/**
 * Робоча сторінка підбірки «Дітям захисників».
 *
 * 14.09.2026 з'ясувалось: відкритих програм саме для цих дітей мало, а ті, що
 * є, фонди й департаменти оголошують у соцмережах за кілька днів до заїзду.
 * Пошук ловить їх запізно або без дат. Тож тут дві речі: чернетки підбірки,
 * яким бракує поля, і організації, чиї канали варто переглядати, щоб
 * встигати до набору.
 */

const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#8a95a9',
  border: '#e2e8f2', bg: '#f7f9fc', accent: '#e85d24', link: '#1e4fd6', warn: '#b4530a',
};
const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: C.ink };
const h2S = { fontSize: 18, margin: '30px 0 4px' };
const noteS = { fontSize: 13.5, color: C.ink3, margin: '4px 0 12px', lineHeight: 1.5, maxWidth: 720 };
const cardS = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' };
const chipS = {
  display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
  fontSize: 13, fontWeight: 600, textDecoration: 'none', border: `1px solid ${C.border}`, color: C.link, background: '#fff',
};

// Конвеєр пише «бракує: …» у коментар, і там вік рахується чесно: у базі
// порожній вік зберігається як 0–18, тож missingRequired по рядку його не
// бачить. Спершу — коментар, запасний варіант — перевірка по рядку.
function missingOf(o) {
  const m = /бракує: ([^·]+)/.exec(o.admin_comment || '');
  if (m) return m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return missingRequired(o);
}

const LINKS = [
  ['site', 'Сайт'],
  ['telegram', 'Telegram'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
];

export default async function DefendersAdminPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Дітям захисників</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let drafts = [];
  let activeCount = null;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [d, a] = await Promise.all([
      supabase.from('opportunities')
        .select('id, title, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, event_start_date, event_end_date, recurrence, format, cities, countries, is_international, admin_comment, created_at')
        .eq('status', 'draft').contains('child_needs', ['veteran_family'])
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('opportunities').select('id', { count: 'exact', head: true })
        .eq('status', 'active').contains('child_needs', ['veteran_family']),
    ]);
    drafts = d.data || [];
    activeCount = a.count ?? null;
  }

  // Найближчі до публікації — нагорі: запис, якому бракує одного поля,
  // дозаповнюється за хвилину, а на три поля потрібен дзвінок.
  drafts = drafts
    .map((o) => ({ ...o, missing: missingOf(o) }))
    .sort((x, y) => x.missing.length - y.missing.length);

  const scraped = DEFENDERS_WATCH.filter((w) => w.scraped).length;

  return (
    <main style={wrap}>
      <AdminNav current="defenders" />
      <h1 style={{ fontSize: 24, margin: 0 }}>Дітям захисників</h1>
      <p style={noteS}>
        На сайті зараз{' '}
        <a href="/dity-zakhysnykiv" target="_blank" rel="noopener noreferrer" style={{ color: C.link }}>
          {activeCount ?? '—'} записів із позначкою «діти захисників»
        </a>
        . Відкритих програм саме для цих дітей мало, і фонди оголошують набори в соцмережах за кілька днів до
        заїзду, тож пошук ловить їх запізно. Нижче — що можна дозаповнити вже зараз і де стежити за новими наборами.
      </p>

      <h2 style={h2S}>Чернетки · {drafts.length}</h2>
      <p style={noteS}>
        Спершу ті, яким бракує одного поля. Нічого не вгадуємо: поле заповнюємо, лише коли воно прямо стоїть
        на сторінці джерела або його підтвердив організатор.
      </p>
      {drafts.length === 0 ? (
        <p style={{ ...cardS, color: C.ink2 }}>Чернеток немає.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {drafts.map((o) => (
            <div key={o.id} style={{ ...cardS, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '6px 14px', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>{o.title}</div>
                <div style={{ fontSize: 13, color: C.ink2, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                  <span style={{ color: o.missing.length ? C.warn : '#15803d', fontWeight: 600 }}>
                    {o.missing.length ? `бракує: ${o.missing.join(', ')}` : 'поля заповнені — перевірте джерело'}
                  </span>
                  {o.source_url && (
                    <a href={o.source_url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink3, overflowWrap: 'anywhere' }}>
                      {o.source || 'джерело'} ↗
                    </a>
                  )}
                </div>
              </div>
              <a href={`/admin/edit/${o.id}`} style={{ ...chipS, color: '#fff', background: C.ink, borderColor: C.ink, whiteSpace: 'nowrap' }}>
                Дозаповнити →
              </a>
            </div>
          ))}
        </div>
      )}

      <h2 style={h2S}>Де оголошують набори · {DEFENDERS_WATCH.length}</h2>
      <p style={noteS}>
        Посилання звірено {WATCH_CHECKED}.{' '}
        {scraped > 0
          ? `«Читає скрапер» — канал уже в списку Telegram-скрапера (${scraped} з ${DEFENDERS_WATCH.length}); решту`
          : 'Скрапер жоден із цих каналів поки не читає, тож їх'}{' '}
        варто переглядати вручну раз на тиждень. Знайшли набір — додайте можливість через форму на сайті або
        відправте посилання в бот.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 10 }}>
        {DEFENDERS_WATCH.map((w) => (
          <div key={w.org} style={{ ...cardS, display: 'grid', gap: 8, alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{w.org}</div>
              {w.scraped && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>читає скрапер</span>
              )}
            </div>
            {w.forChildren && <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.45 }}>{w.forChildren}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LINKS.filter(([k]) => w[k]).map(([k, label]) => (
                <a key={k} href={w[k]} target="_blank" rel="noopener noreferrer" style={chipS}>{label} ↗</a>
              ))}
            </div>
            {w.announces && (
              <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.45 }}>
                <b style={{ color: C.ink2 }}>Набори:</b> {w.announces}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
