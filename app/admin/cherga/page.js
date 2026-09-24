import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured, adminName } from '@/lib/adminAuth';
import { missingRequired } from '@/lib/required';
import { TYPE_LABELS, COST_LABELS, ageLabel, formatLabel, cityLabel } from '@/lib/labels';
import LoginForm from '../LoginForm';
import QueueCards from './QueueCards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Черга',
  robots: { index: false, follow: false },
};

/**
 * Проста черга схвалення (24.09.2026).
 *
 * Велика адмінка на /admin показує чернетки, живі записи й карантин разом, з
 * вкладками, пошуком і дублями — це робоче місце Марії. Людині, яка тільки
 * схвалює, потрібні три дії й нічого більше, тож тут лише записи, у яких усі
 * обовʼязкові поля вже є: те, що можна публікувати просто зараз.
 *
 * Чернетки без даних сюди не потрапляють: дописувати поля — окрема робота,
 * і кнопка «схвалити» на них однаково впаде на серверній перевірці.
 */
const C = { ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b', border: '#e2e8f2', green: '#15803d' };
const wrap = {
  maxWidth: 760, margin: '32px auto 80px', padding: '0 18px',
  fontFamily: 'system-ui, sans-serif', color: C.ink,
};
const DAY = 86400000;

// Рядок фактів над назвою: те, за чим людина впізнає запис, не відкриваючи його.
function factsOf(o) {
  const place = o.is_international
    ? 'Міжнародна'
    : [...(o.countries || []), ...(o.cities || []).map((c) => cityLabel(c, 'uk'))].slice(0, 3).join(', ');
  const when = o.deadline
    ? `до ${new Date(o.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`
    : (o.event_start_date
      ? new Date(o.event_start_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
      : null);
  return [
    TYPE_LABELS[o.opportunity_type] || o.opportunity_type,
    Number.isFinite(o.age_from) && Number.isFinite(o.age_to) ? ageLabel(o.age_from, o.age_to) : null,
    COST_LABELS[o.cost_type] || null,
    formatLabel(o.format, 'uk') || null,
    place || null,
    when,
  ].filter(Boolean).join(' · ');
}

export default async function ChergaPage() {
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return (
      <main style={{ ...wrap, maxWidth: 420, marginTop: 80 }}>
        <h1 style={{ fontSize: 22 }}>Черга схвалення</h1>
        {adminConfigured() ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const me = adminName(cookie) || 'невідомий';
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();
  const todayStart = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Kyiv' }));

  const [draftsRes, mineRes] = await Promise.all([
    supabase.from('opportunities')
      .select('id, title, summary, source, source_url, opportunity_type, age_from, age_to, '
        + 'cost_type, format, cities, countries, is_international, deadline, event_start_date, '
        + 'event_end_date, results_date, recurrence')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('moderation_actions')
      .select('action, created_at')
      .eq('actor', me)
      .gte('created_at', since7)
      .limit(1000),
  ]);

  const ready = (draftsRes.data || [])
    .filter((o) => missingRequired(o).length === 0)
    .map((o) => ({
      id: o.id,
      title: o.title,
      summary: o.summary,
      source: o.source,
      source_url: o.source_url,
      facts: factsOf(o),
    }));

  const mine = mineRes.data || [];
  const approvedWeek = mine.filter((a) => a.action === 'approve').length;
  const approvedToday = mine.filter((a) => a.action === 'approve'
    && new Date(a.created_at) >= todayStart).length;

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Черга схвалення</h1>
        <span style={{ fontSize: 13, color: C.ink3 }}>Ви увійшли як «{me}»</span>
      </div>

      <p style={{ fontSize: 14, color: C.ink2, margin: '10px 0 0', lineHeight: 1.55 }}>
        Тут записи, у яких уже є все потрібне: тип, вік, вартість, дата й місце.
        Схвалюйте, якщо це справді можливість для дитини і посилання веде куди треба.
        Сумнів — тисніть «Питання до Марії»: запис лишиться в черзі.
      </p>

      <p style={{ fontSize: 14, color: C.green, margin: '14px 0 22px', fontWeight: 600 }}>
        Сьогодні схвалено: {approvedToday} · за тиждень: {approvedWeek}
      </p>

      <QueueCards items={ready} />
    </main>
  );
}
