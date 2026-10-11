// Службовий колбек WayForPay для оргвнеску челенджу «Твій образ на обкладинці».
import { verifyCallback, acceptResponse } from '@/lib/wayforpay';
import { isObrazOrder } from '@/lib/obraz';
import { handleObrazCallback } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// WayForPay шле JSON — інколи як raw body, інколи як єдиний ключ форми.
async function parseBody(request) {
  const raw = await request.text().catch(() => '');
  try { return JSON.parse(raw); } catch { /* try form */ }
  try {
    const first = [...new URLSearchParams(raw).keys()][0];
    return JSON.parse(first);
  } catch { return null; }
}

export async function POST(request) {
  const b = await parseBody(request);
  if (!b || !b.orderReference) return new Response('bad request', { status: 400 });
  if (!verifyCallback(b)) return new Response('bad signature', { status: 403 });
  if (isObrazOrder(b.orderReference)) {
    try {
      await handleObrazCallback(b);
    } catch (e) {
      // Не відповісти «accept» — WayForPay повторить колбек, тож оплата не загубиться.
      console.error('[obraz/pay]', e);
      return new Response('retry', { status: 500 });
    }
  }
  return Response.json(acceptResponse(b.orderReference));
}
