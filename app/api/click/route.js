import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Перехід до організатора (lib/track.js → navigator.sendBeacon). Лише id
// запису й кнопка — ні IP, ні куки не зберігаємо. Відповідь завжди 204:
// маяку вона не потрібна, а збій лічильника людині не показуємо.
const PLACES = new Set(['detail_page', 'detail_page_apply', 'detail_page_bar']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const id = typeof b.id === 'string' ? b.id.trim() : '';
  const place = typeof b.place === 'string' ? b.place : '';
  if (!UUID.test(id) || !PLACES.has(place)) return new Response(null, { status: 204 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    // Неіснуючий id відсіє FK — нічого не пишемо, і добре.
    await supabase.from('opportunity_clicks').insert({ opportunity_id: id, place });
  }
  return new Response(null, { status: 204 });
}
