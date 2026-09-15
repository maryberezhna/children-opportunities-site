import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { PRICE, PRICE_YEAR } from '@/lib/wayforpay';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Dityam+',
  robots: { index: false, follow: false },
};

/**
 * Dityam+ в адмінці (15.09.2026).
 *
 * До запуску продажів тут не було видно нічого, крім трьох чисел на
 * «Метриках»: хто оформлює підписку, на якому кроці анкети зупинився, у кого
 * не пройшла оплата, хто зі списку очікування вже став підписником. Усе це
 * лежить у digest_subscribers / plus_children / plus_waitlist — сторінка лише
 * збирає його в одне місце.
 *
 * Телефон свідомо не показуємо: для підтримки досить Telegram чи імейлу, а
 * зайвий номер на екрані — зайвий ризик.
 */

const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b',
  border: '#e2e8f2', bg: '#f7f9fc', green: '#15803d', amber: '#b45309', accent: '#c8501a',
};

const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: C.ink };
const h2S = { fontSize: 17, margin: '28px 0 10px' };
const noteS = { fontSize: 13, color: C.ink3, margin: '8px 0 0', lineHeight: 1.5 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 };
const cell = { padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 14, textAlign: 'left', verticalAlign: 'top' };
const head = { ...cell, fontSize: 12, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' };

const STATUS = {
  active: { label: '✅ Активна', color: C.green },
  pending: { label: '⏳ Оформлює', color: C.amber },
  paused: { label: '⚠️ Пауза', color: C.accent },
  unsubscribed: { label: 'Відписався', color: C.ink3 },
};

// Кроки анкети в @DityamPlusBot (lib/digestFlow.js і /api/telegram/plus).
const STEP = {
  age: 'анкета: вік',
  like: 'анкета: інтереси',
  fmt: 'анкета: формат',
  need: 'анкета: особливі потреби',
  more: 'анкета: ще дитина?',
  place: 'анкета: місто',
  cost: 'анкета: вартість',
  phone: 'телефон для оплати',
  email: 'чекаємо адресу імейлу',
};

const DAY = 86400000;
const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '—');

function whereStuck(s) {
  if (s.status !== 'pending') return null;
  if (s.flow_step) return STEP[s.flow_step] || s.flow_step;
  if (!s.consent_at) return 'не погодився з офертою';
  return 'дійшов до оплати';
}

function who(s) {
  if (s.telegram_handle) return `@${s.telegram_handle}`;
  if (s.email) return s.email;
  return s.telegram_chat_id ? `Telegram · …${String(s.telegram_chat_id).slice(-4)}` : '—';
}

function Card({ value, label, tone }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || C.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 1.35 }}>{label}</div>
    </div>
  );
}

export default async function PlusAdminPage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Dityam+</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [subsRes, kidsRes, waitRes, remindRes] = await Promise.all([
    supabase.from('digest_subscribers')
      .select('id, created_at, updated_at, status, channel, email, telegram_handle, telegram_chat_id, billing_period, consent_at, flow_step, wfp_order_reference, last_sent_at')
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('plus_children').select('subscriber_id'),
    supabase.from('plus_waitlist').select('id, email, telegram_username, telegram_chat_id, source, created_at')
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('digest_reminders_sent').select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(Date.now() - 7 * DAY).toISOString()),
  ]);

  const subs = subsRes.data || [];
  const waitlist = waitRes.data || [];
  const kidsBySub = {};
  for (const k of kidsRes.data || []) kidsBySub[k.subscriber_id] = (kidsBySub[k.subscriber_id] || 0) + 1;

  const active = subs.filter((s) => s.status === 'active');
  const yearly = active.filter((s) => s.billing_period === 'yearly').length;
  const monthly = active.length - yearly;
  const mrr = Math.round(monthly * PRICE + yearly * (PRICE_YEAR / 12));
  const pending = subs.filter((s) => s.status === 'pending');
  const paused = subs.filter((s) => s.status === 'paused');
  const unsub30 = subs.filter((s) => s.status === 'unsubscribed'
    && new Date(s.updated_at || s.created_at).getTime() >= Date.now() - 30 * DAY);
  const emailActive = active.filter((s) => s.channel === 'email').length;

  const activeChats = new Set(active.map((s) => String(s.telegram_chat_id || '')).filter(Boolean));
  const converted = waitlist.filter((w) => w.telegram_chat_id && activeChats.has(String(w.telegram_chat_id))).length;

  // «Потребує уваги»: пауза (оплата не пройшла) і ті, хто застряг в оформленні
  // понад добу — їм, можливо, варто написати.
  const stuck = pending.filter((s) => new Date(s.updated_at || s.created_at).getTime() < Date.now() - DAY);
  const attention = [...paused, ...stuck];

  return (
    <main style={wrap}>
      <AdminNav current="plus" />
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Dityam+</h1>
      <p style={noteS}>
        Підписка оформлюється в <a href="https://t.me/DityamPlusBot" target="_blank" rel="noopener noreferrer">@DityamPlusBot</a>.
        Питання в підтримку бот пересилає в адмін-чат Telegram — тут вони не зберігаються.
      </p>

      <div style={{ ...grid, marginTop: 16 }}>
        <Card value={active.length} label={`активних підписок (${monthly} міс · ${yearly} річн)`} tone={active.length ? C.green : undefined} />
        <Card value={`${mrr} грн`} label="на місяць (річні — поділено на 12)" />
        <Card value={pending.length} label="почали оформлення, ще не оплатили" tone={pending.length ? C.amber : undefined} />
        <Card value={paused.length} label="на паузі — оплата не пройшла" tone={paused.length ? C.accent : undefined} />
        <Card value={unsub30.length} label="відписались за 30 днів" />
        <Card value={waitlist.length} label={`у списку очікування · оформили ${converted}`} />
      </div>
      <p style={noteS}>
        На імейл із активних отримують {emailActive}. Нагадувань про дедлайни за 7 днів: {remindRes.count ?? 0}.
      </p>

      <h2 style={h2S}>Потребує уваги · {attention.length}</h2>
      {attention.length === 0 ? (
        <p style={noteS}>Нікого: немає пауз і тих, хто застряг в оформленні понад добу.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Хто</th><th style={head}>Що сталося</th><th style={head}>З</th></tr></thead>
            <tbody>
              {attention.map((s) => (
                <tr key={s.id}>
                  <td style={cell}>{who(s)}</td>
                  <td style={cell}>{s.status === 'paused' ? '⚠️ оплата не пройшла' : `⏳ зупинився: ${whereStuck(s)}`}</td>
                  <td style={cell}>{fmtDate(s.updated_at || s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={h2S}>Підписники · {subs.length}</h2>
      {subs.length === 0 ? (
        <p style={noteS}>Ще ніхто не почав оформлення.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={head}>Статус</th><th style={head}>Хто</th><th style={head}>Канал</th>
                <th style={head}>Дітей</th><th style={head}>Тариф</th><th style={head}>Почав</th>
                <th style={head}>Остання добірка</th><th style={head}>Де зараз</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const st = STATUS[s.status] || { label: s.status, color: C.ink3 };
                return (
                  <tr key={s.id}>
                    <td style={{ ...cell, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</td>
                    <td style={cell}>{who(s)}</td>
                    <td style={cell}>{s.channel === 'email' ? '📧 імейл' : '✈️ Telegram'}</td>
                    <td style={cell}>{kidsBySub[s.id] || 0}</td>
                    <td style={cell}>{s.status === 'active' ? (s.billing_period === 'yearly' ? 'рік' : 'місяць') : '—'}</td>
                    <td style={cell}>{fmtDate(s.created_at)}</td>
                    <td style={cell}>{fmtDate(s.last_sent_at)}</td>
                    <td style={{ ...cell, color: C.ink2 }}>{whereStuck(s) || (s.wfp_order_reference ? 'оплата підключена' : '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={h2S}>Список очікування · {waitlist.length}</h2>
      {waitlist.length === 0 ? (
        <p style={noteS}>Порожньо.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Контакт</th><th style={head}>Звідки</th><th style={head}>Коли</th><th style={head}>Оформив</th></tr></thead>
            <tbody>
              {waitlist.map((w) => (
                <tr key={w.id}>
                  <td style={cell}>{w.email || (w.telegram_username ? `@${w.telegram_username}` : 'Telegram')}</td>
                  <td style={{ ...cell, color: C.ink2 }}>{w.source || '—'}</td>
                  <td style={cell}>{fmtDate(w.created_at)}</td>
                  <td style={cell}>{w.telegram_chat_id && activeChats.has(String(w.telegram_chat_id)) ? '✅' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
