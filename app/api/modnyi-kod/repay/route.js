// Ще раз відкрити оплату для тієї самої заявки (з кабінету).
import { validMkToken } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, startPayment } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const { t } = await request.json().catch(() => ({}));
  if (!validMkToken(t)) return json({ error: 'not_found' }, 404);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  const row = await entryByToken(db, t).catch(() => null);
  if (!row) return json({ error: 'not_found' }, 404);
  const r = await startPayment(db, row);
  if (r.paid) return json({ paid: true });
  if (r.error) return json({ error: 'pay' }, 502);
  return json({ url: r.url });
}
