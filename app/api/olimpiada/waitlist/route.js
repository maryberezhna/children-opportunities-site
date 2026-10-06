// Список очікування олімпіади: поки продаж закритий, батьки лишають email —
// на старті кожному 1 лист (Марія, 06.10.2026: «починай збирати імейли кому
// цікаво»). Адмінка дізнається про кожен новий email і скільки їх уже.
import { OLIMP, isEmail } from '@/lib/olimpiada';
import { getStore, notifyAdmin, esc, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  // Приманка для ботів: людина цього поля не бачить.
  if (b.website) return json({ ok: true });

  const email = String(b.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'email' }, 400);
  if (b.consent !== true) return json({ error: 'consent' }, 400);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  let res;
  try {
    res = await store.addWaitlist({
      olimp: OLIMP.slug, email, consent_at: new Date().toISOString(),
      source: String(b.source || '').slice(0, 60) || null,
    });
  } catch (e) {
    console.error('[olimpiada/waitlist]', e);
    return json({ error: 'unavailable' }, 503);
  }
  if (!res.already) {
    await notifyAdmin(
      `🧩 <b>Олімпіада: чекають старту</b>\n${esc(email)}${b.source ? ` · ${esc(String(b.source).slice(0, 60))}` : ''}`
      + `${res.count ? `\nУсього в списку: ${res.count}` : ''}`,
    );
  }
  return json({ ok: true, already: res.already });
}
