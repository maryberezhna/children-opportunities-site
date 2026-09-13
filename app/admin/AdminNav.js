import { createClient } from '@supabase/supabase-js';

/**
 * Спільне меню адмінки.
 *
 * Досі навігація була розсипана по сторінках: на /admin — два посилання в
 * заголовку, на /admin/messages — інші два, на /admin/metrics — одне назад,
 * а на /admin/edit/[id] не було жодного, тож із редагування вийти можна було
 * тільки кнопкою «назад» у браузері. Тепер меню одне на всі сторінки, і
 * воно ще й показує, де саме на тебе чекає робота: число біля «Черги» і
 * «Звернень» видно з будь-якої сторінки.
 *
 * Лічильники рахуються тут, а не передаються пропсами: сторінка не має
 * знати, що потрібно меню, і жодна нова сторінка не забуде їх передати.
 */

// Той самий бот, що веде чергу модерації (webhook у app/api/telegram).
// ?start=queue відкриває бота одразу на наступному кандидаті.
export const BOT_URL = 'https://t.me/DityamComUABot';
export const BOT_QUEUE_URL = `${BOT_URL}?start=queue`;

const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#8a95a9',
  border: '#e2e8f2', bg: '#f7f9fc', accent: '#e85d24', link: '#1e4fd6',
};

const ITEMS = [
  { key: 'queue', href: '/admin', icon: '🗂', label: 'Черга', count: 'drafts' },
  { key: 'messages', href: '/admin/messages', icon: '✉️', label: 'Звернення', count: 'messages' },
  { key: 'metrics', href: '/admin/metrics', icon: '📈', label: 'Метрики' },
];

async function counts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const head = (table, filter) => filter(
    supabase.from(table).select('id', { count: 'exact', head: true }),
  );
  try {
    const [drafts, msgs, sugs] = await Promise.all([
      head('opportunities', (q) => q.eq('status', 'draft')),
      head('contact_messages', (q) => q.eq('status', 'new')),
      head('opportunity_suggestions', (q) => q.neq('status', 'done')),
    ]);
    return {
      drafts: drafts.count ?? 0,
      // Звернення з форми і пропозиції з поп-апа лежать у двох таблицях, але
      // для Марії це одна пошта — на /admin/messages вони вже злиті в один
      // список, тож і цифра має бути одна.
      messages: (msgs.count ?? 0) + (sugs.count ?? 0),
    };
  } catch {
    // Лічильник — не привід впасти всій сторінці: без нього меню лишається
    // меню, просто без чисел.
    return {};
  }
}

function Badge({ n }) {
  if (!n) return null;
  return (
    <span style={{
      marginLeft: 6, padding: '1px 7px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: C.accent, color: '#fff', fontVariantNumeric: 'tabular-nums',
    }}>{n}</span>
  );
}

export default async function AdminNav({ current }) {
  const n = await counts();

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '10px 12px', marginBottom: 18,
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
    }}>
      <a href="/admin" style={{
        fontSize: 13, fontWeight: 800, color: C.ink, textDecoration: 'none',
        letterSpacing: '-0.01em', marginRight: 4,
      }}>Dityam.com.ua</a>

      {ITEMS.map((it) => {
        const on = it.key === current;
        return (
          <a key={it.key} href={it.href} style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '7px 13px', borderRadius: 9, fontSize: 14, fontWeight: 600,
            textDecoration: 'none', border: `1px solid ${on ? C.ink : C.border}`,
            background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink2,
          }}>
            <span style={{ marginRight: 6 }}>{it.icon}</span>{it.label}
            <Badge n={it.count ? n[it.count] : 0} />
          </a>
        );
      })}

      {/* Бот — не «ще одне посилання», а другий вхід у ту саму роботу:
          модерувати з телефона швидше в ньому, ніж у браузері. */}
      <a href={BOT_QUEUE_URL} target="_blank" rel="noopener noreferrer" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 13px', borderRadius: 9, fontSize: 14, fontWeight: 600,
        textDecoration: 'none', border: `1px solid ${C.border}`,
        background: '#fff', color: C.link, marginLeft: 'auto',
      }}>🤖 Модерувати в боті ↗</a>

      <a href="/" target="_blank" rel="noopener noreferrer" style={{
        fontSize: 13, color: C.ink3, textDecoration: 'none', padding: '7px 4px',
      }}>Сайт ↗</a>
    </nav>
  );
}
