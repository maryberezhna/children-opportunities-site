// Повернення з оплати (WayForPay шле POST) → кабінет учасника.
import { validMkToken, mkCabinet, MK } from '@/lib/modnyi-kod';
import { SITE_URL } from '@/lib/modnyi-kod-server';

export const dynamic = 'force-dynamic';
function back(request) {
  const t = new URL(request.url).searchParams.get('t');
  return Response.redirect(validMkToken(t) ? `${SITE_URL}${mkCabinet(t)}` : `${SITE_URL}/${MK.slug}`, 303);
}
export const GET = back;
export const POST = back;
