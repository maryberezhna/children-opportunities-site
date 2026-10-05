// Повернення зі сторінки оплати. WayForPay веде людину сюди POST-запитом, а
// сторінка Next на POST не відповідає — тож 303 перетворює його на звичайний
// перехід до тесту.
import { SITE_URL, validToken } from '@/lib/olimpiada-server';

export const dynamic = 'force-dynamic';

function back(request) {
  const t = new URL(request.url).searchParams.get('t');
  const target = validToken(t) ? `${SITE_URL}/olimpiada/test?t=${t}` : `${SITE_URL}/olimpiada`;
  return Response.redirect(target, 303);
}

export const GET = back;
export const POST = back;
