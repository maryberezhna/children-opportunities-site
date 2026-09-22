import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import { kyivToday } from '@/lib/dates';
import { isOverdue, sortByDeadline } from '@/lib/decision-reason';
import { isStubDraft } from '@/lib/suggestions';
import { mergeDraftDups } from '@/lib/adminDups';
import AdminNav from './AdminNav';
import LoginForm from './LoginForm';
import Queue from './Queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Черга',
  robots: { index: false, follow: false },
};

// Одна черга (Марія, 28.09.2026): «це не нормально, це повний розфокус. Я
// хочу мати 1 лист, який збирає потенційні можливості, якщо вони не дотягують
// до того, щоб бути опублікованими автоматично». Шість розділів — знахідки,
// «чекає машину», неповні, прострочені, «потребує рішення», «на сайті» —
// переїхали на /admin/all і звідти нікуди не зникли; тут лише чернетки, і на
// кожній три дії: опублікувати, коментар машині, не підходить.
//
// Прострочені сюди не потрапляють: вночі їх закриває auto_review («дата в
// минулому»), і рішення людини там не потрібне.
// Поріг тригамної схожості назв — той самий, що в судді дублів: Jeugdfonds
// Sport & Cultuur у черзі й на сайті збігаються лише на 0.35, а це та сама
// програма. Хибний збіг на плашці не страшний: вона каже «порівняй обидва»,
// а не вирішує сама.
const DRAFT_DUP_SIM = 0.35;

const FIELDS = [
  'id, slug, status, title, summary, source, source_url, apply_url, opportunity_type',
  'age_from, age_to, cost_type, price_note, deadline, recurrence, results_date',
  'event_start_date, event_end_date, format, cities, countries, is_international',
  'evidence, child_needs, link_status, dup_of, dup_score, admin_comment, created_at',
].join(', ');

const NOTE_DAYS = 7;

export default async function QueuePage({ searchParams }) {
  // Старі закладки на вкладки (?tab=raw, ?tab=active…) ведуть туди, де ці
  // вкладки тепер живуть.
  if (searchParams?.tab) redirect(`/admin/all?tab=${encodeURIComponent(searchParams.tab)}`);

  const configured = adminConfigured();
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
        <h1 style={{ fontSize: 22 }}>Модерація можливостей</h1>
        {configured
          ? <LoginForm />
          : <p style={{ color: '#b4530a' }}>Адмінка не налаштована: задайте змінну середовища <code>ADMIN_TOKEN</code>.</p>}
      </main>
    );
  }

  const today = kyivToday();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let drafts = [];
  let overdue = 0;
  const notes = {};
  let failed = false;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from('opportunities').select(FIELDS)
      .eq('status', 'draft').order('created_at', { ascending: false }).limit(300);
    // Збій бази — не «черга порожня»: людина має знати, що список не
    // прочитався, а не радіти, що все розібрано.
    if (error) failed = true;
    // stub — чернетка з пропозиції (тип і вік у базі — заглушка). Рахуємо тут:
    // lib/suggestions.js серверний і в браузер не йде.
    const all = (data || []).map((o) => ({ ...o, stub: isStubDraft(o) }));
    overdue = all.filter((o) => isOverdue(o, today)).length;
    drafts = sortByDeadline(all.filter((o) => !isOverdue(o, today)), (o) => o.deadline);

    // Можливі дублікати шукає система, а не людина (Марія, 22.09.2026: «це
    // не має перевіряти людина»). Плашку на картці досі ставив лише
    // discover_agent для СВОЇХ знахідок; кандидати зі скраперів, карантину й
    // пропозицій приходили без жодної перевірки — 22.09 у черзі стояли 23
    // записи без плашки, і серед них EPAS, слово в слово той самий, що вже
    // активний на сайті.
    //
    // Збій цього запиту чергу не валить: без плашок вона працює як раніше.
    const { data: pairs } = await supabase.rpc('find_draft_dups', { sim_threshold: DRAFT_DUP_SIM });
    drafts = mergeDraftDups(drafts, pairs);

    // Коментарі машині: відкриті (ще в роботі) і виконані за останній
    // тиждень — картка каже, що машина зробила з проханням.
    const ids = drafts.map((o) => o.id);
    if (ids.length) {
      const since = new Date(Date.now() - NOTE_DAYS * 864e5).toISOString();
      const { data: n } = await supabase.from('moderation_notes')
        .select('id, opportunity_id, body, created_at, resolved_at, resolution, attempted_at')
        .eq('action', 'comment')
        .in('opportunity_id', ids)
        .or(`resolved_at.is.null,resolved_at.gte.${since}`)
        .order('created_at', { ascending: true })
        .limit(500);
      for (const x of n || []) (notes[x.opportunity_id] ||= []).push(x);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <AdminNav current="queue" />
      <h1 style={{ fontSize: 26, margin: '0 0 6px' }}>
        Черга <span style={{ color: '#54617a', fontWeight: 600 }}>({drafts.length})</span>
      </h1>
      <p style={{ color: '#54617a', fontSize: 16, margin: '0 0 22px', lineHeight: 1.5 }}>
        Можливості, які машина не змогла опублікувати сама. Спершу ті, де дедлайн найближчий.
      </p>
      {failed ? (
        <p style={{ padding: '12px 14px', borderRadius: 10, background: '#fdecec', color: '#a11b1b', fontWeight: 600 }}>
          База не відповіла — список неповний. Онови сторінку за хвилину.
        </p>
      ) : null}
      <Queue drafts={drafts} notes={notes} today={today} />
      <p style={{ marginTop: 36, fontSize: 14, color: '#8a94a6', lineHeight: 1.6 }}>
        {overdue ? <>Ще {overdue} із минулими датами — машина закриє їх сама вночі.<br /></> : null}
        <a href="/admin/all" style={{ color: '#8a94a6' }}>Старий вигляд з усіма розділами →</a>
      </p>
    </main>
  );
}
