// Заявка на «Модний код»: створюємо запис і рахунок WayForPay на 99 грн.
import { cleanMkEntry, MK } from '@/lib/modnyi-kod';
import { mkDb, recentCount, createEntry, startPayment, serverEvent } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (b.website) return json({ ok: true });
  if (!MK.open) return json({ error: 'closed' }, 403);
  const { entry, error } = cleanMkEntry(b);
  if (error) return json({ error }, 400);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  try {
    if (await recentCount(db, entry.parent_email) >= 5) return json({ error: 'too_many' }, 429);
    const row = await createEntry(db, entry, b.source);
    await serverEvent(db, 'mk_pay_start', row.source || 'page');
    const r = await startPayment(db, row);
    if (r.error) { console.error('[mk/start] invoice', r.error); return json({ error: 'pay', t: row.token }, 502); }
    return json({ url: r.url, t: row.token });
  } catch (e) {
    console.error('[mk/start]', e?.message || e);
    return json({ error: 'unavailable' }, 503);
  }
}
