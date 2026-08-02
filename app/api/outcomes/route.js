import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES = ['applied', 'accepted'];

export async function POST(request) {
  const b = await request.json().catch(() => ({}));

  // Ханіпот: справжня форма лишає це поле порожнім, боти зазвичай заповнюють усе.
  // Відповідаємо ok, щоб спамер не підбирав обхід за кодом помилки.
  if (typeof b.website === 'string' && b.website.trim()) {
    return Response.json({ ok: true });
  }

  const stage = STAGES.includes(b.stage) ? b.stage : null;
  if (!stage) return Response.json({ ok: false, error: 'bad_stage' }, { status: 400 });

  const opportunityId = typeof b.opportunity_id === 'string' ? b.opportunity_id.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(opportunityId)) {
    return Response.json({ ok: false, error: 'bad_opportunity' }, { status: 400 });
  }

  const story = typeof b.story === 'string' ? b.story.trim().slice(0, 1200) : '';
  const city = typeof b.city === 'string' ? b.city.trim().slice(0, 80) : '';
  const contactConsent = b.contact_consent === true;
  // Контакт зберігаємо ТІЛЬКИ разом зі згодою — інакше це просто зайві персональні дані.
  const contact = contactConsent && typeof b.contact === 'string'
    ? b.contact.trim().slice(0, 160)
    : '';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase.from('opportunity_outcomes').insert({
    opportunity_id: opportunityId,
    stage,
    story: story || null,
    city: city || null,
    contact: contact || null,
    contact_consent: contactConsent && Boolean(contact),
  });

  // Неіснуючий opportunity_id ловить FK — назовні це та сама «погана можливість».
  if (error) {
    const bad = error.code === '23503';
    return Response.json(
      { ok: false, error: bad ? 'bad_opportunity' : 'server' },
      { status: bad ? 400 : 500 },
    );
  }

  return Response.json({ ok: true });
}
