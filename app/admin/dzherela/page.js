import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminConfigured } from '@/lib/adminAuth';
import AdminNav from '../AdminNav';
import LoginForm from '../LoginForm';
import SourcesList from './SourcesList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Джерела',
  robots: { index: false, follow: false },
};

// Розвідник джерел працює з 09.2026 і складає кандидатів у source_candidates.
// Побачити їх не було де: 19.10.2026 там лежали 22 сайти зі статусом pending,
// жодного рішення по жодному. Сайти шукались і нікуди не доходили.
//
// Марія того ж дня, відхиляючи запис для дорослих: «інколи буває що
// можливість для дорослих але в цілому джерело непогане як тоді». Ця
// сторінка — відповідь: рішення про ДЖЕРЕЛО відокремлене від рішення про
// запис.

const CAND_FIELDS = [
  'id, domain, url, name, kind, language, countries, score, score_reason',
  'probe_status, scrapable, found_by, status, admin_comment, created_at',
].join(', ');

const SRC_FIELDS = [
  'id, name, pipeline, adapter, enabled, trust_tier, config, notes',
  'last_success_at, consecutive_failures, crawl_interval_days',
].join(', ');

export default async function SourcesPage() {
  const configured = adminConfigured();
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
        <h1 style={{ fontSize: 22 }}>Джерела</h1>
        {configured
          ? <LoginForm />
          : <p style={{ color: '#b4530a' }}>Адмінка не налаштована: задайте змінну середовища <code>ADMIN_TOKEN</code>.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let candidates = [];
  let sources = [];
  let failed = false;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [cand, src] = await Promise.all([
      supabase.from('source_candidates').select(CAND_FIELDS)
        .eq('status', 'pending').order('score', { ascending: false, nullsFirst: false }).limit(200),
      supabase.from('sources').select(SRC_FIELDS)
        .order('enabled', { ascending: false }).order('name').limit(300),
    ]);
    // Збій бази — не «кандидатів немає»: порожній список тут читається як
    // «розвідник нічого не знайшов», а це неправда (та сама пастка, що з
    // порожнім каталогом).
    if (cand.error || src.error) failed = true;
    candidates = cand.data || [];
    sources = src.data || [];
  }

  return (
    <main style={{ maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <AdminNav current="sources" />
      <h1 style={{ fontSize: 26, margin: '0 0 6px' }}>
        Джерела <span style={{ color: '#54617a', fontWeight: 600 }}>({candidates.length} на рішення)</span>
      </h1>
      <p style={{ color: '#54617a', fontSize: 16, margin: '0 0 22px', lineHeight: 1.5 }}>
        Сайти, які знайшов розвідник або додала ти з черги. Унизу — ті, що вже обходяться щотижня.
      </p>
      {failed ? (
        <p style={{ padding: '12px 14px', borderRadius: 10, background: '#fdecec', color: '#a11b1b', fontWeight: 600 }}>
          База не відповіла — список неповний. Онови сторінку за хвилину.
        </p>
      ) : null}
      <SourcesList candidates={candidates} sources={sources} />
    </main>
  );
}
