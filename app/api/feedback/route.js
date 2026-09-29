import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// «Щось не так? Повідомити» зі сторінки можливості (app/o/[slug]/ReportButton.js)
// → рядок у opportunity_feedback: value 'report', source 'site', page — slug
// сторінки. Ні IP, ні cookie не зберігаємо. Відповідь завжди 204: маяку вона
// не потрібна, а збій людині не показуємо. Тижневий scripts/feedback-digest.mjs
// показує такі повідомлення поруч із 👍/👎 із каналу.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const id = typeof b.id === 'string' ? b.id.trim() : '';
  const page = typeof b.page === 'string' ? b.page.trim().slice(0, 200) : '';
  if (!UUID.test(id)) return new Response(null, { status: 204 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    // Неіснуючий id відсіє FK — нічого не пишемо, і добре.
    await supabase.from('opportunity_feedback').insert({
      opportunity_id: id, value: 'report', source: 'site', page: page || null,
    });
  }
  return new Response(null, { status: 204 });
}
