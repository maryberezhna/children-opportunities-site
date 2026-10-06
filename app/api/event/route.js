import { createClient } from '@supabase/supabase-js';
import { SITE_EVENT_NAMES } from '@/lib/site-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Кроки воронки на сайті (lib/site-events.js → navigator.sendBeacon). Приймаємо
// ЛИШЕ назви зі списку: інакше будь-хто перетворив би таблицю на смітник.
// Відповідь завжди 204 — маяку вона не потрібна, а збій лічильника людині не
// показуємо.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name : '';
  if (!SITE_EVENT_NAMES.includes(name)) return new Response(null, { status: 204 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    // source — коротка мітка «звідки» (lib/site-events.js), не більше 60 знаків.
    const source = typeof b.source === 'string' && b.source.trim() ? b.source.trim().slice(0, 60) : null;
    await supabase.from('site_events').insert(source ? { name, source } : { name });
  }
  return new Response(null, { status: 204 });
}
