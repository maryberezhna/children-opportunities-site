import { DM_Sans, Caveat, Manrope } from 'next/font/google';
import { Analytics } from './Analytics';
import TelegramFAB from './TelegramFAB';
import ScrollNav from './ScrollNav';
import AccessibilityPanel from './AccessibilityPanel';
import { supabase } from '@/lib/supabase';
import './globals.css';

// DM Sans does not include Cyrillic in next/font's bundled subsets.
// We load it for Latin glyphs and let Manrope (a near-identical
// geometric sans designed for Cyrillic) cover Ukrainian via per-glyph
// browser fallback in font-family.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const manrope = Manrope({
  subsets: ['cyrillic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-cyrillic',
});

const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-caveat',
});

// Round the live active count down to a tidy figure so the title never
// over-promises (429 → "400+"). Falls back to 400 if the DB is unreachable
// at build time — so it can never regress to the old static "80+".
async function getProgramCount() {
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    return error ? null : (count ?? null);
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const count = await getProgramCount();
  const n = count && count >= 50 ? Math.floor(count / 50) * 50 : 400;
  return {
  metadataBase: new URL('https://dityam.com.ua'),
  title: {
    default: `Можливості для дитини — каталог ${n}+ програм для дітей 0-18 років в Україні`,
    template: '%s | Можливості для дитини',
  },
  description: `Єдиний безкоштовний каталог можливостей для дітей 0-18 років: курси, олімпіади, стипендії, FLEX, UPSHIFT, медична допомога, виплати ВПО. ${n}+ перевірених програм в Україні.`,
  keywords: [
    'можливості для дітей', 'стипендії Україна', 'курси для дітей',
    'олімпіади школярам', 'FLEX програма', 'UPSHIFT гранти',
    'виплати ВПО діти', 'МАН конкурси', 'допомога дітям',
    'табір для підлітків', 'обмін навчання США', 'програми підліткам',
  ],
  authors: [{ name: 'Мері Бережна' }],
  alternates: { canonical: 'https://dityam.com.ua' },
  robots: { index: true, follow: true },
  verification: {
    google: 'RvvznKHFJZWAqvC-wcGyakBzZo11cazkLQ6WfGuzRFk',
  },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: 'https://dityam.com.ua',
    siteName: 'Можливості для дитини',
    title: 'Усі можливості для дітей в одному місці',
    description: 'Каталог безкоштовних та доступних програм для дітей 0–18 років в Україні. Зроблено однією людиною, без реклами, для кожної родини.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'dityam.com.ua — каталог можливостей для дітей 0–18 років',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Усі можливості для дітей в одному місці',
    description: 'Каталог безкоштовних та доступних програм для дітей 0–18 років в Україні.',
    images: ['/og-image.png'],
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
      description: 'Каталог можливостей для дітей 0-18 років в Україні.',
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
    <html lang="uk" className={`${dmSans.variable} ${manrope.variable} ${caveat.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <ScrollNav />
        <TelegramFAB />
        <AccessibilityPanel />
        <Analytics />
      </body>
    </html>
  );
}
