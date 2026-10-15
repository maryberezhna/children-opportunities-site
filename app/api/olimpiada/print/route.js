// Замовлення друкованого диплома з доставкою у відділення або поштомат Нової
// пошти — OLIMP.printPrice (з 08.10.2026 199 грн; участь безкоштовна). Зберігає, кому й куди надіслати, і виставляє разовий рахунок;
// після оплати адмінка отримує повідомлення з адресою й посиланням на диплом.
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { createOneTimeInvoice, checkStatus, wayforpayConfigured } from '@/lib/wayforpay';
import { OLIMP, cleanPrintOrder } from '@/lib/olimpiada';
import { SITE_URL, getStore, validToken, markPrintPaid, savePrintAddress, payFailed, json } from '@/lib/olimpiada-server';

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
  // Заблокований диплом не друкуємо й оплату за нього не приймаємо (15.10.2026).
  if (entry.blocked_at) return json({ error: 'blocked' }, 409);
  const testPath = `/olimpiada/test?t=${entry.token}`;
  // Оплачено разом з участю (249 грн, до 08.10.2026), адреси ще немає — лише зберігаємо.
  if (entry.print_paid_at && !entry.print_order) {
    await savePrintAddress(store, entry, order);
    return json({ url: testPath });
  }
  if (entry.print_paid_at) return json({ ok: true, already: true, url: testPath });

  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  const devFree = !wayforpayConfigured && process.env.NODE_ENV !== 'production';
  if ((admin && b.realPay !== true) || devFree) {
    const saved = await store.update(entry.token, { print_order: order });
    await markPrintPaid(store, saved || { ...entry, print_order: order }, { test: true });
    return json({ url: testPath });
  }
  if (!wayforpayConfigured) return json({ error: 'unavailable' }, 503);

  // Попередній рахунок за доставку: оплачено — лише позначаємо; оплата ще йде —
  // другого рахунку не даємо, щоб не заплатили двічі (07.10.2026).
  if (entry.print_ref) {
    const r = await checkStatus(entry.print_ref);
    if (r.error) return json({ error: 'unavailable' }, 503);
    if (r.status === 'Approved') {
      await markPrintPaid(store, entry);
      return json({ url: testPath });
    }
    if (r.status && !payFailed(r.status)) return json({ error: 'pending' }, 409);
  }

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
