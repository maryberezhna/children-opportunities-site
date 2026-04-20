import { Analytics } from './Analytics';
import './globals.css';

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
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: 'https://dityam.com.ua',
    siteName: 'Можливості для дитини',
    title: 'Можливості для дитини 0-18 років',
    description: 'Каталог 80+ можливостей для дітей: освіта, обміни, стипендії, медична допомога.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
