import { NextResponse } from 'next/server';
import { readsUkrainian, acceptLanguageTags } from '@/lib/lang';

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
 */

// Краулерів не чіпаємо. Google обходить сайт із американських адрес: якби
// редірект діяв і на нього, українська головна поступово випала б з індексу
// на користь англійського лендингу — це коштувало б усього органічного
// трафіку. Тому їм завжди віддається те, що просять, плюс hreflang у layout.
const BOTS = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|skypeuripreview|applebot|yandex|duckduck|baidu|semrush|ahrefs|petalbot|lighthouse|headlesschrome|chrome-lighthouse|google-inspectiontool/i;

const ALLOWED = new Set(['uk', 'en']);

// Ті самі ключі, які читає каталог у app/OpportunitiesList.js.
const CATALOGUE_PARAMS = ['q', 'age', 'type', 'aid', 'theme', 'need', 'cost', 'deadline', 'city', 'sort'];

export function middleware(request) {
  const url = request.nextUrl;

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
    if (readsUkrainian(acceptLanguageTags(accept))) {
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

// Тільки головна. Решта сайту працює як і працювала.
export const config = { matcher: '/' };
