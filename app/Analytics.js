'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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

// Власні заходи псували статистику: середня сесія на головній була 11 хвилин
// при 16% відмов — так поводиться не відвідувач, а людина, яка робить сайт.
// Фільтр за IP у GA4 тут не годиться (домашня адреса динамічна), тож вимикач
// живе в браузері: відкрити dityam.com.ua/?noga=1 — і на цьому пристрої
// аналітика більше не вантажиться. Повернути: /?noga=0
const OPT_OUT_KEY = 'dityam_no_analytics';

export function Analytics() {
  const pathname = usePathname();
  // null — ще не знаємо: localStorage читається лише після монтування, інакше
  // сервер і клієнт відрендерять різне.
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    try {
      const flag = new URLSearchParams(window.location.search).get('noga');
      if (flag === '1') localStorage.setItem(OPT_OUT_KEY, '1');
      if (flag === '0') localStorage.removeItem(OPT_OUT_KEY);
      setAllowed(!localStorage.getItem(OPT_OUT_KEY));
    } catch (e) {
      setAllowed(true);   // приватний режим — рахуємо як звичайного гостя
    }
  }, []);

  if (allowed !== true) return null;
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
