'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_ID = 'G-KPLE8LGH91';
const HOTJAR_ID = 6704189;

// Ідентифікатор Google Ads (AW-…). Живе в env, бо кампанія може
// зупинитись або змінитись, а перезбирати сайт заради цього не хочеться.
// Порожній — і тег просто не вантажиться: GA4 працює як і працював.
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// Внутрішні маршрути, які не мають потрапляти в статистику. Модерація давала
// ~16 переглядів на місяць — це власна робота, а не аудиторія, і вона псувала
// і кількість сторінок, і показники залученості.
const EXCLUDED = ['/admin'];

export function Analytics() {
  const pathname = usePathname();
  if (pathname && EXCLUDED.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ''}
        `}
      </Script>
      {HOTJAR_ID ? (
        <Script id="hotjar" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-',  '.js?sv=');
          `}
        </Script>
      ) : null}
    </>
  );
}
