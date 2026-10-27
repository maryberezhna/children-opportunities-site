import { NextResponse } from 'next/server';
import { readsUkrainian, acceptLanguageTags } from '@/lib/lang';
import { shouldBlock } from '@/lib/bot-guard';
import { isRuSearchBot } from '@/lib/ru-search';
import { AB_CARD_COOKIE, AB_CARD_MAX_AGE, abCardForRequest } from '@/lib/ab-card';
import { aiFetcherFrom, aiLabel } from '@/lib/ai-visibility';
import { needsConsent, analyticsBlocked, REGION_COOKIE, REGION_EU, REGION_MAX_AGE } from '@/lib/consent';

/**
 * Хто заходить не з України — бачить англійську сторінку.
 *
 * Працює лише на головній. Глибокі посилання (сторінка можливості, підбірка,
 * місто) не чіпаємо навмисно: мама у Варшаві приходить із Google на «табори
 * для дітей» українською, і викидати її з тієї самої сторінки, яку вона
 * шукала, — гірше, ніж не перекласти сайт узагалі.
 *
 * Вибір людини сильніший за геолокацію: перемикач у шапці ставить cookie
 * dityam_lang, і після одного кліку редірект більше не спрацьовує ніколи.
 *
 * Мову вирішує браузер, а не адреса. Найбільша частина закордонного трафіку —
 * українська діаспора: країна каже «Польща», а людині потрібен український
 * каталог. Тож країна лише окреслює, кого взагалі питати, а відповідає
 * Accept-Language: є в списку українська чи російська — нікуди не ведемо.
 * Решту з-за кордону ведемо на /en, навіть якщо англійської в браузері немає
 * (Марія, 27.10.2026: «телефон лише польською = англійська»). 12.10 таких
 * лишали на українській; тепер англійська — спільна мова для неукраїнського
 * браузера, а українська завжди за одним кліком у шапці (перемикач UA / EN).
 */

// Краулерів не чіпаємо. Google обходить сайт із американських адрес: якби
// редірект діяв і на нього, українська головна поступово випала б з індексу
// на користь англійського лендингу — це коштувало б усього органічного
// трафіку. Тому їм завжди віддається те, що просять, плюс hreflang у layout.
const BOTS = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|skypeuripreview|applebot|yandex|duckduck|baidu|semrush|ahrefs|petalbot|lighthouse|headlesschrome|chrome-lighthouse|google-inspectiontool/i;

const ALLOWED = new Set(['uk', 'en']);

// Ті самі ключі, які читає каталог у app/OpportunitiesList.js.
const CATALOGUE_PARAMS = ['q', 'age', 'type', 'aid', 'theme', 'need', 'cost', 'deadline', 'city', 'sort'];

/**
 * A/B-тест картки можливості (lib/ab-card.js, 29.09.2026): новому відвідувачу
 * ставимо cookie ab_card = A або B, 50/50, на 90 днів. Без персональних
 * даних — лише літера. Далі варіант читає inline-скрипт у layout і застосовує
 * CSS, тож HTML для обох однаковий і кеш ISR не роздвоюється. Cookie
 * приходить у відповідь разом зі сторінкою, тому вже перший екран малюється
 * потрібним варіантом. Боти cookie не отримують і бачать A.
 *
 * Обгортка над route(): cookie треба додати до будь-якої відповіді —
 * і до next(), і до редіректу мови, — а точок повернення там кілька.
 */
// ШІ-асистент читає сторінку для відповіді людині (ChatGPT-User,
// Perplexity-User, Claude-User) — пишемо в site_events як ai_fetch
// (lib/ai-visibility.js). Через waitUntil: відповідь не чекає на запис, а збій
// запису сторінку не ламає. Лише бойовий домен.
async function logAiFetch(name, path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/site_events`, {
      method: 'POST',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name: 'ai_fetch', source: aiLabel(name, path) }),
    });
  } catch { /* лічильник — не привід ламати відповідь */ }
}

export function middleware(request, event) {
  const res = route(request);
  if (res.status === 403) return res;
  const live = /(^|\.)dityam\.com\.ua$/i.test(request.headers.get('host') || '');
  const ai = live ? aiFetcherFrom(request.headers.get('user-agent')) : null;
  if (ai && event?.waitUntil) event.waitUntil(logAiFetch(ai, request.nextUrl.pathname));
  const cookie = request.headers.get('cookie') || '';
  const isBot = BOTS.test(request.headers.get('user-agent') || '');
  // Згода на cookie (lib/consent.js, 27.10.2026): для ЄС/ЄЕЗ, Британії й
  // Швейцарії — службова позначка регіону без країни, щоб сторінка знала,
  // що треба спитати згоди. Ставимо лише коли її ще немає, і знімаємо, коли
  // людина вже не там. Країна невідома (dev-сервер) — нічого не робимо.
  const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || '';
  const eu = needsConsent(country);
  const hadRegion = new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=${REGION_EU}(?:;|$)`).test(cookie);
  if (!isBot && eu && !hadRegion) {
    res.cookies.set(REGION_COOKIE, REGION_EU, { path: '/', maxAge: REGION_MAX_AGE, sameSite: 'lax' });
  } else if (!isBot && country && !eu && hadRegion) {
    res.cookies.set(REGION_COOKIE, '', { path: '/', maxAge: 0, sameSite: 'lax' });
  }
  const { variant, set } = abCardForRequest({ cookie, search: request.nextUrl.search, isBot });
  // A/B-cookie — теж не необхідна: у регіоні згоди без «Прийняти» не ставимо
  // (людина бачить варіант A).
  const abAllowed = !(eu || hadRegion) || !analyticsBlocked(`${cookie}; ${REGION_COOKIE}=${REGION_EU}`);
  if (set && abAllowed) {
    res.cookies.set(AB_CARD_COOKIE, variant, { path: '/', maxAge: AB_CARD_MAX_AGE, sameSite: 'lax' });
  }
  return res;
}

function route(request) {
  const url = request.nextUrl;

  const host = request.headers.get('host') || '';
  const live = /(^|\.)dityam\.com\.ua$/i.test(host);

  // Пошук рф і білорусі (Марія, 02.10.2026). robots.txt просить їх піти й
  // прибрати сторінки з індексу; це — щоб правило діяло й тоді, коли
  // robots.txt зігнорували. Сам robots.txt лишається відкритим (його немає в
  // matcher нижче): інакше робот не прочитає заборону й не знатиме, що йому йти.
  if (live && isRuSearchBot(request.headers.get('user-agent'))) {
    return new NextResponse('Not available.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  // Захист від масового копіювання (lib/bot-guard.js) — на всіх сторінках.
  // Лише на бойовому домені: dev-сервер і превʼю Vercel працюють як були.
  if (live && shouldBlock(request.headers.get('user-agent'))) {
    return new NextResponse('Automated copying of Dityam.com.ua is not allowed.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  // Далі — лише мова головної; решта сторінок іде як є.
  if (url.pathname !== '/') return NextResponse.next();

  // ?lang=uk / ?lang=en — явна вказівка з листа чи пресматеріалу.
  // Запамʼятовуємо і прибираємо параметр, щоб він не тягнувся в шер.
  const asked = url.searchParams.get('lang');
  if (ALLOWED.has(asked)) {
    const clean = url.clone();
    clean.searchParams.delete('lang');
    if (asked === 'en') clean.pathname = '/en';
    const res = NextResponse.redirect(clean, 307);
    res.cookies.set('dityam_lang', asked, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return res;
  }

  // Посилання з фільтром чи пошуком — це вже вибір конкретної добірки в
  // каталозі: людина ввела запит у шапці, або їй скинули готову підбірку в
  // чат. Відправити її замість цього на англійський лендинг означає мовчки
  // з'їсти і запит, і фільтри. Такі адреси лишаємо як є.
  if (CATALOGUE_PARAMS.some((k) => url.searchParams.has(k))) return NextResponse.next();

  const chosen = request.cookies.get('dityam_lang')?.value;
  if (chosen === 'uk') return NextResponse.next();

  // Явно обрана англійська б'є все інше — навіть український браузер.
  if (chosen !== 'en') {
    if (BOTS.test(request.headers.get('user-agent') || '')) return NextResponse.next();

    // Заголовка мови немає взагалі — це не браузер. Так ходять монітори,
    // health-check'и й прев'ю-боти: uptime-перевірка отримувала 307 і щогодини
    // повідомляла, що сайт лежить. Живий відвідувач Accept-Language надсилає
    // завжди, тож на людей це правило не поширюється.
    const accept = request.headers.get('accept-language');
    if (!accept) return NextResponse.next();

    // Читає українською — лишається на українській, хоч би де він був.
    const tags = acceptLanguageTags(accept);
    if (readsUkrainian(tags)) {
      return NextResponse.next();
    }

    // Vercel віддає країну в заголовку; локально його немає — тоді нічого
    // не робимо, щоб dev-сервер поводився передбачувано.
    const country =
      request.geo?.country || request.headers.get('x-vercel-ip-country') || '';
    if (!country || country === 'UA') return NextResponse.next();
  }

  const to = url.clone();
  to.pathname = '/en';
  // 307, а не 301: країна відвідувача — не властивість адреси, і кешувати
  // цей перехід у браузері чи в CDN не можна.
  return NextResponse.redirect(to, 307);
}

// Мова — лише на головній (перевірка на початку middleware). Захист від
// копіювання — на всіх сторінках, окрім API (вебхуки Telegram і WayForPay),
// статики Next.js, картинок і службових файлів, які читають роботи
// (robots.txt, карта сайту, llms.txt).
export const config = {
  matcher: [
    '/((?!api/|_next/|favicon|icon|apple-icon|robots\\.txt|sitemap|llms\\.txt|press/|fonts/|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|map|txt|xml|json|woff2?|ttf|mp4|pdf)$).*)',
  ],
};
