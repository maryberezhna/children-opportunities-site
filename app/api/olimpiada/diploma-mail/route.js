// Лист із дипломом одразу після тесту (Марія, 09.10.2026: «а можеш їх завжди
// відправляти одразу?»). Викликає сторінка результату, щойно відкрилась
// (DiplomaMailer). Повторний виклик нічого не дублює: sendDiploma «бронює»
// diploma_sent_at; не вийшло — лист надішле запасний скрипт.
import { getStore, validToken, json } from '@/lib/olimpiada-server';
import { sendDiploma } from '@/lib/olimpiada-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);
  const entry = await store.get(b.t);
  if (!entry?.finished_at) return json({ error: 'not_finished' }, 409);
  // Заблокований диплом листом теж не надсилаємо (15.10.2026).
  if (entry.blocked_at) return json({ error: 'blocked' }, 409);
  if (entry.diploma_sent_at) return json({ ok: true, already: true });
  const sent = await sendDiploma(store, entry);
  return json({ ok: sent });
}
