import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import { PRICE, PRICE_HALF } from '@/lib/wayforpay';

// Річну не продаємо з 27.09.2026; старі річні рядки (їх 0) рахуємо за старою ціною.
const PRICE_YEAR_OLD = 999;
import { reasonLabel } from '@/lib/plusOutcomes';
import { countBySource } from '@/lib/plusSources';
import { peopleRows, who, STATUS, isStalled } from '@/lib/plusPeople';
import { notOwn } from '@/lib/own';
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
 * Телефон свідомо не показуємо: для підтримки досить Telegram, а зайвий
 * номер на екрані — зайвий ризик. Імейл-доставки Dityam+ з 15.09.2026 немає.
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

const TONE = { green: C.green, amber: C.amber, accent: C.accent, muted: C.ink3 };

const DAY = 86400000;
const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '—');

function Card({ value, label, tone }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || C.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 1.35 }}>{label}</div>
    </div>
  );
}

export default async function PlusAdminPage() {
  const configured = adminConfigured();
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = isAdmin(cookie);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Dityam+</h1>
        {configured ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [subsRes, kidsRes, waitRes, remindRes, appsRes] = await Promise.all([
    supabase.from('digest_subscribers')
      .select('id, created_at, updated_at, status, telegram_handle, telegram_chat_id, billing_period, consent_at, flow_step, email, wfp_order_reference, last_sent_at, wfp_last_status, wfp_last_reason, wfp_last_reason_code, source')
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('plus_children').select('subscriber_id'),
    supabase.from('plus_waitlist').select('id, email, telegram_username, telegram_chat_id, source, created_at')
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('digest_reminders_sent').select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(Date.now() - 7 * DAY).toISOString()),
    // «Чим закінчилось» (23.09.2026). select('*') і сортування за updated_at
    // навмисне: до застосування міграції 20260923_plus_outcomes.sql колонок
    // answered_at / reason / note ще немає, і запит із їхніми іменами впав би,
    // забравши з собою всю сторінку.
    supabase.from('plus_applications').select('*')
      .order('updated_at', { ascending: false }).limit(300),
  ]);

  // Власні записи Марії (@maryberezhna, її пошти) — не люди в статистиці (08.10.2026).
  const subs = notOwn(subsRes.data);
  const waitlist = notOwn(waitRes.data);
  const kidsBySub = {};
  for (const k of kidsRes.data || []) kidsBySub[k.subscriber_id] = (kidsBySub[k.subscriber_id] || 0) + 1;

  const active = subs.filter((s) => s.status === 'active');
  const half = active.filter((s) => s.billing_period === 'halfyear').length;
  const yearly = active.filter((s) => s.billing_period === 'yearly').length;
  // Подарунковий місяць за участь в олімпіаді — активна підписка, але не дохід.
  const gift = active.filter((s) => s.billing_period === 'gift').length;
  const monthly = active.length - half - yearly - gift;
  const mrr = Math.round(monthly * PRICE + half * (PRICE_HALF / 6) + yearly * (PRICE_YEAR_OLD / 12));
  const pending = subs.filter((s) => s.status === 'pending');
  // «Оформлює» — лише хто діяв за останню добу; решта вже зупинились
  // (Марія, 08.10.2026: «⏳ Оформлює, якщо людина по факту вже забила болт»).
  const stalled = pending.filter((s) => isStalled(s));
  const filling = pending.length - stalled.length;
  const paused = subs.filter((s) => s.status === 'paused');
  const unsub30 = subs.filter((s) => s.status === 'unsubscribed'
    && new Date(s.updated_at || s.created_at).getTime() >= Date.now() - 30 * DAY);

  const activeChats = new Set(active.map((s) => String(s.telegram_chat_id || '')).filter(Boolean));
  const converted = waitlist.filter((w) => w.telegram_chat_id && activeChats.has(String(w.telegram_chat_id))).length;

  // Одна таблиця замість трьох (Марія, 08.10.2026) — lib/plusPeople.js.
  const people = peopleRows({ subs, waitlist, kidsBySub });
  const attention = people.filter((r) => r.attention).length;

  // «Чим закінчилось»: відповіді на питання «Ви скористалися цією можливістю?»
  // (scraper/ask_outcomes.py + /api/telegram/plus). Тут видно те, чого не
  // видно більше ніде: що з позначеної можливості справді вийшло.
  const outcomes = (appsRes.data || []).filter((a) => a.answered_at)
    .sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at)).slice(0, 30);
  const askedTotal = (appsRes.data || []).filter((a) => a.asked_at).length;
  const subById = Object.fromEntries(subs.map((s) => [s.id, s]));
  const oppIds = [...new Set(outcomes.map((o) => o.opportunity_id))];
  const { data: oppRows } = oppIds.length
    ? await supabase.from('opportunities').select('id, title, slug').in('id', oppIds)
    : { data: [] };
  const oppById = Object.fromEntries((oppRows || []).map((o) => [o.id, o]));

  return (
    <main style={wrap}>
      <AdminNav current="plus" />
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>Dityam+</h1>
      <p style={noteS}>
        Підписка оформлюється в <a href="https://t.me/DityamPlusBot" target="_blank" rel="noopener noreferrer">@DityamPlusBot</a>.
        Питання в підтримку бот пересилає в адмін-чат Telegram — тут вони не зберігаються.
      </p>

      <div style={{ ...grid, marginTop: 16 }}>
        <Card value={active.length} label={`активних підписок (${monthly} міс · ${half} пів року${yearly ? ` · ${yearly} річн` : ''})`} tone={active.length ? C.green : undefined} />
        <Card value={`${mrr} грн`} label="на місяць (пів року — поділено на 6)" />
        <Card value={filling} label="оформлюють зараз (діяли за останню добу)" tone={filling ? C.amber : undefined} />
        <Card value={stalled.length} label="зупинились в оформленні й не повернулись" />
        <Card value={paused.length} label="на паузі — платіж не завершився" tone={paused.length ? C.accent : undefined} />
        <Card value={unsub30.length} label="відписались за 30 днів" />
        <Card value={waitlist.length} label={`у списку очікування · оформили ${converted}`} />
      </div>
      <p style={noteS}>
        Нагадувань про дедлайни за 7 днів: {remindRes.count ?? 0}.
      </p>

      <h2 style={h2S}>Люди · {people.length}{attention ? ` · потребує уваги ${attention}` : ''}</h2>
      <p style={noteS}>
        Кожна людина — один рядок, найсвіжіші зверху. Підсвічені — пауза або застрягли в оформленні
        понад добу: їм, можливо, варто написати. «Чекали запуску» — список очікування; він закритий,
        бо продаж відкрито.
      </p>
      {people.length === 0 ? (
        <p style={noteS}>Ще нікого.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={head}>Статус</th><th style={head}>Хто</th><th style={head}>Що сталося</th>
                <th style={head}>Звідки прийшов</th><th style={head}>Коли</th>
              </tr>
            </thead>
            <tbody>
              {people.map((r) => {
                const st = STATUS[r.status] || { label: r.status, tone: 'muted' };
                return (
                  <tr key={r.key} style={r.attention ? { background: '#fff7ed' } : undefined}>
                    <td style={{ ...cell, color: TONE[st.tone], fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</td>
                    <td style={cell}>{r.who}</td>
                    <td style={cell}>{r.what}</td>
                    <td style={{ ...cell, color: C.ink2 }}>{r.from}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Яке місце на сайті чи в каналі приводить підписників (27.09.2026).
          Мітку `from_<звідки>` бот пише при першому /start (lib/plus.js), тож
          одна людина — один рядок, за першим дотиком. */}
      <h2 style={h2S}>Звідки прийшли</h2>
      {subs.length === 0 ? (
        <p style={noteS}>Ще нікого.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}>Звідки</th><th style={head}>Мітка</th>
                <th style={{ ...head, textAlign: 'right' }}>Почали</th>
                <th style={{ ...head, textAlign: 'right' }}>Активні</th>
              </tr>
            </thead>
            <tbody>
              {countBySource(subs).map((r) => (
                <tr key={r.source || '—'}>
                  <td style={cell}>{r.label}</td>
                  <td style={{ ...cell, color: C.ink2, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{r.source || '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.started}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.active ? C.green : C.ink3, fontWeight: r.active ? 700 : 400 }}>{r.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={noteS}>
        «Почали» — відкрили бот за посиланням (будь-який статус зараз), «Активні» — мають оплачену
        підписку. Мітку ставлять посилання з сайту (з 27.09.2026) і пости каналу (з 25.09.2026).
        «Без мітки» — прийшли раніше, простим /start або за промокодом; звідки промокод — у повідомленні
        «Промокод … ввів» в адмін-чаті.
      </p>

      <h2 style={h2S}>Чим закінчилось · {outcomes.length}</h2>
      {outcomes.length === 0 ? (
        <p style={noteS}>
          Відповідей ще немає. Бот питає «Ви скористалися цією можливістю?» через 3 дні після того,
          як позначена можливість минула{askedTotal ? `; запитано ${askedTotal}` : ''}.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={head}>Можливість</th><th style={head}>Хто</th>
                <th style={head}>Скористались</th><th style={head}>Причина</th>
                <th style={head}>Що написали</th><th style={head}>Коли</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((a) => {
                const opp = oppById[a.opportunity_id];
                const used = a.stage === 'used';
                return (
                  <tr key={`${a.subscriber_id}-${a.opportunity_id}`}>
                    <td style={cell}>
                      {opp ? (
                        <a href={`/o/${opp.slug}`} target="_blank" rel="noopener noreferrer">{opp.title}</a>
                      ) : '—'}
                    </td>
                    <td style={cell}>{who(subById[a.subscriber_id] || {})}</td>
                    <td style={{ ...cell, color: used ? C.green : C.ink3, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {used ? '✅ так' : 'ні'}
                    </td>
                    <td style={{ ...cell, color: C.ink2 }}>{a.reason ? reasonLabel(a.reason) : '—'}</td>
                    <td style={cell}>{a.note || '—'}</td>
                    <td style={cell}>{fmtDate(a.answered_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </main>
  );
}
