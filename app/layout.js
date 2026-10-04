import localFont from 'next/font/local';
import Header from './Header';
import LangSuggest from './LangSuggest';
import { Analytics } from './Analytics';
import TelegramFAB from './TelegramFAB';
import ScrollNav from './ScrollNav';
import AccessibilityPanel from './AccessibilityPanel';
import ServiceWorker from './ServiceWorker';
import { countActiveOpportunities } from '@/lib/supabase';
import { AB_CARD_BOOT_SCRIPT } from '@/lib/ab-card';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

// Шрифти вендорнуті локально, а не через next/font/google.
//
// Чому: next/font/google качає їх із fonts.gstatic.com ПІД ЧАС ЗБІРКИ, і
// збірка на Vercel впала саме на цьому — «TypeError: Cannot read properties
// of null» у @next/font/google/loader. Локально те саме проходило, бо шрифти
// лежали в кеші. Мережевий запит у білді — це відмова, яку неможливо
// відтворити й від якої нічого не залежить у нашому коді.
//
// Один шрифт на весь текст — Manrope, латиниця й кирилиця в одному файлі на
// кожну вагу (04.10.2026). До того кирилицю малював Manrope, а латиницю,
// цифри й розділові знаки — DM Sans, і в рядку «5–18 років» чи «Лейпцигу
// (oseredok-leipzig.de)» стояли два шрифти з різною висотою літер. Марія:
// «шрифти не консистентні».
//
// Файли зібрано зі змінного Manrope 4.505 (github.com/google/fonts, ofl/manrope)
// у ваги 400/500/700, підмножина latin + cyrillic Google Fonts, стрілки й ₴.
// У Manrope немає українського апострофа ʼ (U+02BC) — у файлах він веде на
// гліф ’, інакше «Здоровʼя» брало б апостроф із системного шрифту.
// Caveat — окремо, для рукописних акцентів.
const manrope = localFont({
  src: [
    { path: './fonts/Manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Manrope-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
});

const caveat = localFont({
  src: [
    // Один файл на латиницю й кирилицю разом (30.09.2026). Два файли з
    // однаковими weight/style next/font/local видає як два @font-face без
    // unicode-range — браузер бере останній і латиницю в Caveat не показує.
    // Вага 400 знята: усі стилі сайту беруть 700 (.v2-script просить 600 →
    // теж 700). Було 4 файли на 190 КБ, стало один на 84 КБ.
    { path: './fonts/Caveat-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-caveat',
});

// Round the live active count down to a tidy figure so the title never
// over-promises (429 → "400+"). Falls back to 400 if the DB is unreachable
// at build time — so it can never regress to the old static "80+".
async function getProgramCount() {
  try {
    return await countActiveOpportunities();
  } catch {
    return null;
  }
}

// viewport-fit=cover: інакше env(safe-area-inset-bottom) на iPhone дорівнює
// нулю, і прибита знизу панель «Подати заявку» лягала б під смужку жестів.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata() {
  const count = await getProgramCount();
  const n = count && count >= 50 ? Math.floor(count / 50) * 50 : 400;
  return {
  metadataBase: new URL('https://dityam.com.ua'),
  title: {
    default: `Можливості для дитини — платформа ${n}+ програм для українських дітей 0-18 років`,
    template: '%s | Можливості для дитини',
  },
  description: `Платформа можливостей для українських дітей 0-18 років — в Україні та за кордоном. Курси, олімпіади, стипендії, FLEX, UPSHIFT, медична допомога, виплати ВПО. ${n}+ перевірених програм, безкоштовно.`,
  keywords: [
    'можливості для дітей', 'стипендії Україна', 'курси для дітей',
    'олімпіади школярам', 'FLEX програма', 'UPSHIFT гранти',
    'виплати ВПО діти', 'МАН конкурси', 'допомога дітям',
    'табір для підлітків', 'обмін навчання США', 'програми підліткам',
  ],
  authors: [{ name: 'Марія Шутяк' }],
  alternates: {
    canonical: 'https://dityam.com.ua',
    languages: {
      uk: 'https://dityam.com.ua',
      en: 'https://dityam.com.ua/en',
    },
  },
  robots: { index: true, follow: true },
  verification: {
    google: 'RvvznKHFJZWAqvC-wcGyakBzZo11cazkLQ6WfGuzRFk',
  },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: 'https://dityam.com.ua',
    siteName: 'Можливості для дитини',
    title: 'Усі можливості для дитини — в одному місці',
    description: 'Платформа можливостей для українських дітей 0–18 років — в Україні та за кордоном. Безкоштовно для кожної родини, без реєстрації.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Усі можливості для дітей в одному місці',
    description: 'Платформа можливостей для українських дітей 0–18 років — в Україні та за кордоном.',
  },
  };
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://dityam.com.ua/#website',
      url: 'https://dityam.com.ua',
      name: 'Можливості для дитини',
      description: 'Платформа можливостей для українських дітей 0-18 років — в Україні та за кордоном.',
      inLanguage: 'uk',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://dityam.com.ua/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://dityam.com.ua/#org',
      name: 'dityam.com.ua',
      url: 'https://dityam.com.ua',
      logo: 'https://dityam.com.ua/icon.svg',
      sameAs: ['https://www.instagram.com/dityam.com.ua'],
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: варіант картки (data-ab-card) ставить на
    // <html> inline-скрипт нижче ще до гідратації, і без прапорця React у dev
    // скаржився б на «зайвий» атрибут на кожній сторінці.
    <html
      lang="uk"
      className={`${manrope.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Перший скрипт у <body>: варіант картки з cookie ab_card — до того,
            як браузер розбере решту сторінки (lib/ab-card.js). */}
        <script dangerouslySetInnerHTML={{ __html: AB_CARD_BOOT_SCRIPT }} />
        {/* Тема — теж до першої промальовки, інакше темний сайт блимає білим.
            Другим, а не першим: завантажувач варіанта картки мусить лишатись
            першим у <body> (tests/ab-card.test.mjs), а на блимання порядок не
            впливає — обидва виконуються до того, як браузер щось намалює. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <LangSuggest />
        <Header />
        {children}
        <ScrollNav />
        <TelegramFAB />
        <AccessibilityPanel />
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
