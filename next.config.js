const { PHASE_PRODUCTION_BUILD } = require('next/constants');

/** @type {import('next').NextConfig} */
// Захисні заголовки на всіх сторінках (план безпеки, Марія, 08.10.2026). До
// того сайт віддавав лише HSTS від Vercel.
//   • X-Frame-Options + frame-ancestors — сайт не можна вбудувати в чужий фрейм
//     (клікджекінг: прозора наша сторінка поверх чужої кнопки);
//   • nosniff — браузер не вгадує тип файлу (завантажене не стане скриптом);
//   • Referrer-Policy — чужим сайтам іде лише домен, а не повна адреса з ?q=;
//   • Permissions-Policy — камера, мікрофон, геолокація сайту не потрібні;
//   • CSP — базовий: без обмеження скриптів, бо GA4, Hotjar і Amplitude
//     вбудовуються інлайном; обмежує фрейми, <base>, плагіни й http-ресурси.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      // /stem-talant — адреса конкурсу для дітей; до грудня 2026 (поки реєстрація
      // не відкрита) тимчасово веде на сторінку партнерів. redirect() у сторінці
      // віддавав 307 без Location — прев'ю в месенджерах і пошуковики не йшли далі.
      // У грудні прибрати це правило й зробити сторінку для дітей.
      { source: '/stem-talant', destination: '/stem-partnery', permanent: false },
      // www.dityam.com.ua — на основну адресу. До 02.10.2026 піддомен мав DNS,
      // але не був привʼязаний до проєкту у Vercel: браузер показував помилку
      // сертифіката (аудит Semrush). Тепер привʼязаний, а це правило не дає
      // сайту жити під двома адресами.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.dityam.com.ua' }],
        destination: 'https://dityam.com.ua/:path*',
        permanent: true,
      },
      {
        source: '/',
        has: [{ type: 'query', key: 'o', value: '(?<slug>.*)' }],
        destination: '/o/:slug',
        permanent: true,
      },
      // /events сторінкою ніколи не був — це технічний префікс флоу
      // «Додати в календар» (/events/[slug]/add). Але на нього два місяці
      // вів пункт меню, тож адреса встигла розійтись: 5 переходів у 404 за
      // 60 днів. Віддаємо 301 на головну, а не 404, щоб зовнішні посилання
      // й ті, у кого лишилась закладка, потрапляли в каталог.
      // Точний збіг: /events/<slug>/add під це правило не підпадає.
      {
        source: '/events',
        destination: '/',
        permanent: true,
      },
      // Підбірка прожила під адресою /dity-veteraniv менше доби, але встигла
      // потрапити в sitemap і у футер, тож віддаємо 301, а не 404. Адресу
      // змінили слідом за копією: у текстах ми кажемо «захисники», не
      // «ветерани».
      {
        source: '/dity-veteraniv',
        destination: '/dity-zakhysnykiv',
        permanent: true,
      },
      // Сторінка Dityam+ жила під /pidbirka, хоча в меню, в англійській версії
      // (/en/plus) і в самій назві продукту це «plus». Адреса встигла потрапити
      // в sitemap, футер, пости в каналі й повідомлення бота — тож 301, а не 404.
      {
        source: '/pidbirka',
        destination: '/plus',
        permanent: true,
      },
      // Карантин переїхав вкладкою в «Чергу» (22.09.2026): два кроки одного
      // шляху жили двома сторінками, і сирі знахідки лишались нерозібраними.
      // Адреса в закладках у Марії — тож 301 на потрібну вкладку, не 404.
      {
        source: '/admin/quarantine',
        destination: '/admin?tab=raw',
        permanent: true,
      },
      // Календар свят видалено (1 перегляд за 60 днів, у sitemap не було).
      {
        source: '/sviata',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

// Локальна збірка ходить у РОБОЧУ базу: ~1080 сторінок — тисячі запитів за
// кілька хвилин. 14.09.2026 такі збірки (зокрема від паралельних сесій
// Claude) поклали API Supabase, і сайт показував «0 можливостей». Тому поза
// Vercel (він сам виставляє VERCEL=1) збірка зупиняється ще до першого
// запиту. Якщо вона справді потрібна — свідомо: ALLOW_LOCAL_BUILD=1 npm run build.
// dev-сервер і `next start` це не зачіпає.
module.exports = (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.VERCEL && !process.env.ALLOW_LOCAL_BUILD) {
    console.error(
      '\n⛔ Локальну збірку зупинено: вона робить тисячі запитів до робочої бази Supabase.\n'
      + '   Перевіряйте через `npm test`, `npx next dev` і preview-збірку Vercel у PR.\n'
      + '   Якщо збірка справді потрібна: ALLOW_LOCAL_BUILD=1 npm run build\n',
    );
    process.exit(1);
  }
  return nextConfig;
};
