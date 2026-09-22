import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { quarantineCriteria, quarantineSnippet } from '@/lib/quarantine';
import AdminNav from '../AdminNav';
import ModerationRules from '../ModerationRules';
import { QUEUE_LAYOUT_CSS } from '../queueLayout';
import LoginForm from '../LoginForm';
import QuarantineList from './QuarantineList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Карантин',
  robots: { index: false, follow: false },
};

const wrap = { maxWidth: 980, margin: '32px auto 80px', padding: '0 18px', fontFamily: 'system-ui, sans-serif', color: '#131b28' };

/**
 * Карантин: сирі записи, де модель не впевнена, чи це можливість для дитини.
 *
 * Порядок — як у вʼюсі v_raw_review: спершу надійніші джерела (trust_tier 1 —
 * держ/офіційні), усередині — від найвпевненішого. Рідкісне міжнародне має
 * потрапляти на очі першим, а не тонути серед свіжого шуму з Telegram.
 */
export default async function QuarantinePage() {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  const authed = Boolean(token) && Boolean(cookie) && safeEqual(cookie, token);
  if (!authed) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Карантин</h1>
        {token ? <LoginForm /> : <p>Задайте ADMIN_TOKEN.</p>}
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main style={wrap}><p>Supabase не налаштований.</p></main>;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [rawRes, srcRes] = await Promise.all([
    supabase.from('raw_items')
      .select('id, source_name, source_url, canonical_url, raw_title, raw_text, confidence, fetched_at')
      .eq('status', 'review').is('review_verdict', null)
      .order('fetched_at', { ascending: false }).limit(300),
    supabase.from('sources').select('name, trust_tier'),
  ]);
  const tier = new Map((srcRes.data || []).map((s) => [s.name, s.trust_tier]));

  const rows = (rawRes.data || [])
    .map((r) => ({
      id: r.id,
      raw_title: r.raw_title,
      source_name: r.source_name,
      trust_tier: tier.get(r.source_name) ?? null,
      confidence: r.confidence,
      url: r.canonical_url || r.source_url,
      raw_text: String(r.raw_text || '').slice(0, 6000),
      snippet: quarantineSnippet(r.raw_text),
      // По весь текст, а не по обрізаних 6000: дедлайн буває й наприкінці.
      criteria: quarantineCriteria(r.raw_title, r.raw_text),
    }))
    .sort((a, b) => (a.trust_tier ?? 9) - (b.trust_tier ?? 9)
      || (b.confidence ?? 0) - (a.confidence ?? 0));

  return (
    // Ширину задає сітка з «Черги»: список на тому ж місці, що й на інших
    // сторінках адмінки, правила — у порожньому полі ліворуч.
    <main style={{ margin: '32px 0 80px', fontFamily: 'system-ui, sans-serif', color: '#131b28' }}>
      <div className="adm-queue">
        <style dangerouslySetInnerHTML={{ __html: QUEUE_LAYOUT_CSS }} />
        <div className="adm-queue-head">
          <AdminNav current="quarantine" />
          <h1 style={{ fontSize: 24, margin: 0 }}>
            Карантин {rows.length > 0 && <span style={{ color: '#c8501a' }}>· {rows.length}</span>}
          </h1>
          <p style={{ fontSize: 16, color: '#54617a', margin: '6px 0 0', lineHeight: 1.5 }}>
            Знахідки скраперів, де модель не певна, що це можливість для дитини. «Завести можливість»
            повертає запис у нічний розбір: модель заповнить поля сама, а без чогось із пʼяти
            обовʼязкових він прийде в чергу чернеткою. «Відхилити» — назавжди.
          </p>
        </div>
        <aside className="adm-queue-rules" aria-label="Правила модерації">
          <ModerationRules tab="quarantine" />
        </aside>
        <div className="adm-queue-body" style={{ marginTop: 22 }}>
          <QuarantineList rows={rows} />
        </div>
      </div>
    </main>
  );
}
