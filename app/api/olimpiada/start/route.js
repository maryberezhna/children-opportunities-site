// Заявка на онлайн-олімпіаду: створює запис і рахунок WayForPay на 150 грн.
// Відповідь — адреса, куди вести людину: сторінка оплати або одразу тест
// (для адміна й у локальній розробці, де платіжних ключів немає).
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { createOneTimeInvoice, wayforpayConfigured } from '@/lib/wayforpay';
import { OLIMP, OLIMP_OPEN, cleanName, isEmail } from '@/lib/olimpiada';
import { SITE_URL, getStore, markPaid, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  // Приманка для ботів: людина цього поля не бачить.
  if (b.website) return json({ url: '/olimpiada' });

  const name = cleanName(b.name);
  const age = Number(b.age);
  const email = String(b.email || '').trim().toLowerCase();
  if (name.length < 2) return json({ error: 'name' }, 400);
  if (!Number.isInteger(age) || age < OLIMP.ageMin || age > OLIMP.ageMax) return json({ error: 'age' }, 400);
  if (!isEmail(email)) return json({ error: 'email' }, 400);
  if (b.consent !== true) return json({ error: 'consent' }, 400);

  // Марія перевіряє олімпіаду, не платячи: вхід в адмінку = безкоштовний запис.
  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  const devFree = !wayforpayConfigured && process.env.NODE_ENV !== 'production';
  // До запуску записів від сторонніх не створюємо й рахунків не виставляємо.
  if (!OLIMP_OPEN && !admin && !devFree) return json({ error: 'closed' }, 403);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  let entry;
  try {
    entry = await store.create({
      olimp: OLIMP.slug, child_name: name, child_age: age, parent_email: email,
      consent_at: new Date().toISOString(), amount: OLIMP.price,
      source: String(b.source || '').slice(0, 60) || null,
    });
  } catch (e) {
    console.error('[olimpiada/start]', e);
    return json({ error: 'unavailable' }, 503);
  }
  const testPath = `/olimpiada/test?t=${entry.token}`;

  if (admin || devFree) {
    await markPaid(store, entry, { test: true });
    return json({ url: testPath, t: entry.token });
  }
  if (!wayforpayConfigured) return json({ error: 'unavailable' }, 503);

  const orderReference = `olimp-${entry.token}-${Date.now()}`;
  const inv = await createOneTimeInvoice({
    orderReference,
    amount: OLIMP.price,
    product: `Участь в онлайн-олімпіаді з логіки Dityam.com.ua (${OLIMP.groupLabel})`,
    email,
    returnUrl: `${SITE_URL}/api/olimpiada/return?t=${entry.token}`,
    serviceUrl: `${SITE_URL}/api/olimpiada/pay`,
  });
  if (!inv.url) {
    console.error(`[olimpiada/start] invoice failed: ${inv.error || 'no url'}`);
    return json({ error: 'pay' }, 502);
  }
  await store.update(entry.token, { wfp_order_reference: orderReference });
  return json({ url: inv.url, t: entry.token });
}
