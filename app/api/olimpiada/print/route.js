// Замовлення друкованого диплома з доставкою Новою поштою — OLIMP.printPrice понад
// внесок. Зберігає, кому й куди надіслати, і виставляє разовий рахунок;
// після оплати адмінка отримує повідомлення з адресою й посиланням на диплом.
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { createOneTimeInvoice, wayforpayConfigured } from '@/lib/wayforpay';
import { OLIMP, cleanPrintOrder } from '@/lib/olimpiada';
import { SITE_URL, getStore, validToken, markPrintPaid, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const { order, error } = cleanPrintOrder(b);
  if (error) return json({ error }, 400);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);
  const entry = await store.get(b.t);
  if (!entry) return json({ error: 'not_found' }, 404);
  // Друкуємо лише готовий диплом — після тесту.
  if (!entry.finished_at) return json({ error: 'not_finished' }, 409);
  if (entry.print_paid_at) return json({ ok: true, already: true, url: `/olimpiada/test?t=${entry.token}` });

  const testPath = `/olimpiada/test?t=${entry.token}`;
  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  const devFree = !wayforpayConfigured && process.env.NODE_ENV !== 'production';
  if (admin || devFree) {
    const saved = await store.update(entry.token, { print_order: order });
    await markPrintPaid(store, saved || { ...entry, print_order: order }, { test: true });
    return json({ url: testPath });
  }
  if (!wayforpayConfigured) return json({ error: 'unavailable' }, 503);

  const orderReference = `olimp-d-${entry.token}-${Date.now()}`;
  const inv = await createOneTimeInvoice({
    orderReference,
    amount: OLIMP.printPrice,
    product: 'Друкований диплом онлайн-олімпіади Dityam.com.ua з доставкою Новою поштою',
    email: entry.parent_email,
    returnUrl: `${SITE_URL}/api/olimpiada/return?t=${entry.token}`,
    serviceUrl: `${SITE_URL}/api/olimpiada/pay`,
  });
  if (!inv.url) {
    console.error(`[olimpiada/print] invoice failed: ${inv.error || 'no url'}`);
    return json({ error: 'pay' }, 502);
  }
  await store.update(entry.token, { print_order: order, print_ref: orderReference });
  return json({ url: inv.url });
}
