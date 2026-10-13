// Службовий колбек WayForPay для оргвнеску «Модного коду».
import { verifyCallback, acceptResponse } from '@/lib/wayforpay';
import { isMkOrder } from '@/lib/modnyi-kod';
import { handleMkCallback } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function parseBody(request) {
  const raw = await request.text().catch(() => '');
  try { return JSON.parse(raw); } catch { /* форма */ }
  try { return JSON.parse([...new URLSearchParams(raw).keys()][0]); } catch { return null; }
}

export async function POST(request) {
  const b = await parseBody(request);
  if (!b || !b.orderReference) return new Response('bad request', { status: 400 });
  if (!verifyCallback(b)) return new Response('bad signature', { status: 403 });
  if (isMkOrder(b.orderReference)) {
    try { await handleMkCallback(b); } catch (e) { console.error('[mk/pay]', e); return new Response('retry', { status: 500 }); }
  }
  return Response.json(acceptResponse(b.orderReference));
}
