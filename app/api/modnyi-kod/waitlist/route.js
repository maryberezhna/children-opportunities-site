// Список очікування олімпіади «Модний код» — та сама таблиця, що й в олімпіади
// з логіки (olimpiada_waitlist), з позначкою olimp = 'modnyi-kod'.
import { MK, isEmail } from '@/lib/modnyi-kod';
import { getStore, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (b.website) return json({ ok: true });
  const email = String(b.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'email' }, 400);
  if (b.consent !== true) return json({ error: 'consent' }, 400);
  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);
  try {
    const res = await store.addWaitlist({
      olimp: MK.slug, email, consent_at: new Date().toISOString(),
      source: String(b.source || '').slice(0, 60) || null,
    });
    return json({ ok: true, already: res.already });
  } catch (e) {
    console.error('[modnyi-kod/waitlist]', e);
    return json({ error: 'unavailable' }, 503);
  }
}
