// Заявка на онлайн-олімпіаду. З 08.10.2026 участь безкоштовна (Марія:
// «робимо її безкоштовною, але диплом можна надрукувати за 199 грн»): запис
// одразу отримує доступ, запрошення йде на пошту, а людину ведемо прямо на
// тест. Оплата лишилась лише за друкований диплом — /api/olimpiada/print.
// До того тут виставлявся рахунок WayForPay на 150 або 249 грн.
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { OLIMP, OLIMP_OPEN, cleanName, isEmail } from '@/lib/olimpiada';
import { getStore, markPaid, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const sameName = (a, b) => String(a || '').toLocaleLowerCase('uk') === String(b || '').toLocaleLowerCase('uk');

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  // Приманка для ботів: людина цього поля не бачить.
  if (b.website) return json({ url: '/olimpiada' });

  const name = cleanName(b.name);
  const email = String(b.email || '').trim().toLowerCase();
  if (name.length < 2) return json({ error: 'name' }, 400);
  if (!isEmail(email)) return json({ error: 'email' }, 400);
  if (b.consent !== true) return json({ error: 'consent' }, 400);

  // Марія перевіряє олімпіаду до запуску: вхід в адмінку = тестовий запис
  // (у статистику не йде). Локально, без бази, — так само.
  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  const devFree = process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!OLIMP_OPEN && !admin && !devFree) return json({ error: 'closed' }, 403);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  try {
    // Безкоштовна форма не має ставати способом засипати чужу скриньку:
    // повторна заявка на ту саму дитину, поки тест не пройдено, веде до вже
    // виданого посилання без нового листа; понад OLIMP.maxEntriesPerEmailDay
    // заявок за добу на одну пошту — відмова.
    const recent = await store.recentByEmail(email, new Date(Date.now() - DAY_MS).toISOString());
    const again = recent.find((r) => sameName(r.child_name, name) && !r.finished_at);
    if (again) return json({ url: `/olimpiada/test?t=${again.token}`, t: again.token, again: true });
    if (!admin && recent.length >= OLIMP.maxEntriesPerEmailDay) return json({ error: 'too_many' }, 429);

    const entry = await store.create({
      olimp: OLIMP.slug, child_name: name, parent_email: email,
      consent_at: new Date().toISOString(), amount: 0,
      source: String(b.source || '').slice(0, 60) || null,
    });
    await markPaid(store, entry, { free: true, test: admin || devFree });
    return json({ url: `/olimpiada/test?t=${entry.token}`, t: entry.token });
  } catch (e) {
    console.error('[olimpiada/start]', e);
    return json({ error: 'unavailable' }, 503);
  }
}
