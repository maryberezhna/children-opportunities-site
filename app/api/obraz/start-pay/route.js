// «Оплатити 99 грн» на сторінці заявки: рахунок WayForPay → адреса оплати.
import { validToken } from '@/lib/obraz';
import { obrazDb, entryByToken, startPayment } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { t } = await request.json().catch(() => ({}));
  if (!validToken(t)) return Response.json({ error: 'not_found' }, { status: 404 });
  const db = obrazDb();
  if (!db) return Response.json({ error: 'unavailable' }, { status: 503 });
  try {
    const row = await entryByToken(db, t);
    if (!row || row.status === 'removed') return Response.json({ error: 'not_found' }, { status: 404 });
    const r = await startPayment(db, row);
    if (r.paid) return Response.json({ paid: true });
    if (r.error) { console.error('[obraz/start-pay]', r.error); return Response.json({ error: 'unavailable' }, { status: 503 }); }
    return Response.json({ url: r.url });
  } catch (e) {
    console.error('[obraz/start-pay]', e?.message || e);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
