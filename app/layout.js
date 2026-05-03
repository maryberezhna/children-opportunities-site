import { Manrope, Kalam } from 'next/font/google';
import { Analytics } from './Analytics';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});

const kalam = Kalam({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--font-kalam',
});

export const metadata = {
  metadataBase: new URL('https://dityam.com.ua'),
  title: {
    default: 'Можливості для дитини — каталог 80+ програм для дітей 0-18 років в Україні',
    template: '%s | Можливості для дитини',
  },
  description: 'Єдиний безкоштовний каталог можливостей для дітей 0-18 років: курси, олімпіади, стипендії, FLEX, UPSHIFT, медична допомога, виплати ВПО. 80+ перевірених програм в Україні.',
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
    title: 'Можливості для дитини 0-18 років',
    description: 'Каталог 80+ можливостей для дітей: освіта, обміни, стипендії, медична допомога.',
  },
};

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
    <html lang="uk" className={`${manrope.variable} ${kalam.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
