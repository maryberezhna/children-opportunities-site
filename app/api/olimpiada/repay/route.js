// «Оплатити ще раз» — новий рахунок для ТІЄЇ САМОЇ заявки, коли попередня
// оплата точно не пройшла. До 07.10.2026 сторінка очікування вела до нової
// заявки вже за 80 секунд, навіть коли оплата ще йшла, — і батьки могли
// заплатити двічі. Тепер спершу питаємо WayForPay: оплачено — відкриваємо
// тест; оплата ще в процесі — нового рахунку не даємо.
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { checkStatus, wayforpayConfigured } from '@/lib/wayforpay';
import { OLIMP_OPEN } from '@/lib/olimpiada';
import { getStore, validToken, markPaid, payFailed, createEntryInvoice, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);
  const entry = await store.get(b.t);
  if (!entry) return json({ error: 'not_found' }, 404);
  const testPath = `/olimpiada/test?t=${entry.token}`;
  if (entry.paid_at) return json({ url: testPath });

  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  if (!OLIMP_OPEN && !admin) return json({ error: 'closed' }, 403);
  if (!wayforpayConfigured) return json({ error: 'unavailable' }, 503);

  if (entry.wfp_order_reference) {
    const r = await checkStatus(entry.wfp_order_reference);
    // Не знаємо, що з попередньою оплатою, — нового рахунку не виставляємо.
    if (r.error) return json({ error: 'unavailable' }, 503);
    if (r.status === 'Approved') {
      await markPaid(store, entry);
      return json({ url: testPath });
    }
    if (r.status && !payFailed(r.status)) return json({ error: 'pending' }, 409);
  }

  const inv = await createEntryInvoice(entry);
  if (!inv.url) {
    console.error(`[olimpiada/repay] invoice failed: ${inv.error || 'no url'}`);
    return json({ error: 'pay' }, 502);
  }
  await store.update(entry.token, { wfp_order_reference: inv.orderReference, wfp_last_status: null, wfp_last_reason: null });
  return json({ url: inv.url });
}
