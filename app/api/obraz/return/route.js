// Повернення зі сторінки оплати: WayForPay веде сюди POST-запитом, 303 робить
// з нього звичайний перехід на сторінку заявки (там звірка оплати й превʼю).
import { validToken, entryPath } from '@/lib/obraz';
import { SITE_URL } from '@/lib/obraz-server';

export const dynamic = 'force-dynamic';

function back(request) {
  const t = new URL(request.url).searchParams.get('t');
  return Response.redirect(validToken(t) ? `${SITE_URL}${entryPath(t)}` : `${SITE_URL}/obraz`, 303);
}

export const GET = back;
export const POST = back;
