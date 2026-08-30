'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { ADS_ID } from '@/lib/track';

const GA_ID = 'G-KPLE8LGH91';
const HOTJAR_ID = 6704189;

// Внутрішні маршрути, які не мають потрапляти в статистику. Модерація давала
// ~16 переглядів на місяць — це власна робота, а не аудиторія, і вона псувала
// і кількість сторінок, і показники залученості.
const EXCLUDED = ['/admin'];

// Вимикач власного трафіку. Заходи авторки псували статистику: середня сесія
// на головній була 11 хвилин при 16% відмов — так поводиться не відвідувач.
// Фільтр за IP у GA4 не годиться, домашня адреса динамічна.
//
// Читаємо синхронно, до гідратації, а не в useEffect: якщо ховати весь блок за
// станом після монтування, теги gtag і Hotjar перестають потрапляти в перший
// рендер, встановлюються пізніше, і події коротких сесій — саме тих, які ми й
// намагаємось виміряти — мовчки зникають, бо кожен відправник перевіряє
// `window.gtag`. Тому скрипти лишаються на місці завжди, а відмову від збору
// вмикаємо штатним прапорцем GA `ga-disable-<ID>`.
const OPT_OUT_SCRIPT = `
  (function () {
    try {
      var key = 'dityam_no_analytics';
      var flag = new URLSearchParams(window.location.search).get('noga');
      if (flag === '1') localStorage.setItem(key, '1');
      if (flag === '0') localStorage.removeItem(key);
      if (localStorage.getItem(key)) {
        window['ga-disable-${GA_ID}'] = true;
        window.__dityamNoAnalytics = true;
      }
    } catch (e) {}
  })();
`;

export function Analytics() {
  const pathname = usePathname();
  if (pathname && EXCLUDED.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* Звичайний inline-скрипт, а не next/script: має виконатись при розборі
          HTML, ще до того, як завантажиться gtag. */}
      <script dangerouslySetInnerHTML={{ __html: OPT_OUT_SCRIPT }} />

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
            if (!window.__dityamNoAnalytics) {
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-',  '.js?sv=');
            }
          `}
        </Script>
      ) : null}
    </>
  );
}
