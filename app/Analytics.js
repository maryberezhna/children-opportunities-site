'use client';
import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { ADS_ID, cardSlugFromHref, trackCardClick } from '@/lib/track';
import { NO_ANALYTICS_KEY, PRODUCTION_HOST, AUTOMATION_UA, isInternalPath } from '@/lib/analytics-scope';
import { markVisit, sendSiteEvent, isPlusPath, SITE_EVENTS } from '@/lib/site-events';
import { AMPLITUDE_KEY, AMPLITUDE_EU, AMPLITUDE_SDK_VERSION } from '@/lib/amplitude';

const GA_ID = 'G-KPLE8LGH91';
const HOTJAR_ID = 6704189;

// Amplitude (02.10.2026). Ключ проєкту — публічний, живе в змінній Vercel
// NEXT_PUBLIC_AMPLITUDE_API_KEY: без неї нічого не вантажиться й не збирається.
// Якщо проєкт створено в європейському дата-центрі Amplitude, потрібна ще
// NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE=EU — інакше події підуть не туди й зникнуть.
// Розбір змінних — lib/amplitude.js.

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
//
// Не рахуємо, якщо: сторінка відкрита не на dityam.com.ua (прев'ю на Vercel,
// локальні сервери, знімки верстки) або браузер позначено як свій — вручну
// через ?noga=1 чи автоматично, коли в ньому відкривали адмінку.
const OPT_OUT_SCRIPT = `
  (function () {
    var off = !${PRODUCTION_HOST}.test(window.location.hostname);
    // Автоматика — не аудиторія: знімки верстки й перевірки з headless-Chrome
    // (scripts/screenshot.mjs, Claude) і все, що керується через webdriver.
    // 01.10.2026 у звіті за тиждень сиділи «мобільний Chrome, Варшава» — це
    // були мої ж прогони Lighthouse й знімки живого сайту.
    if (navigator.webdriver || ${AUTOMATION_UA}.test(navigator.userAgent)) off = true;
    try {
      var key = '${NO_ANALYTICS_KEY}';
      var flag = new URLSearchParams(window.location.search).get('noga');
      if (flag === '1') localStorage.setItem(key, '1');
      if (flag === '0') localStorage.removeItem(key);
      if (localStorage.getItem(key)) off = true;
      // Видиме підтвердження: на телефоні інакше не зрозуміти, чи спрацювало
      // (Марія, 01.10.2026: «викресли мене з усього трафіку… і мобільний теж»).
      if (flag === '1' || flag === '0') {
        document.addEventListener('DOMContentLoaded', function () {
          var n = document.createElement('div');
          n.textContent = flag === '1'
            ? 'Цей браузер більше не рахується в статистиці'
            : 'Цей браузер знову рахується в статистиці';
          n.style.cssText = 'position:fixed;left:16px;right:16px;bottom:120px;z-index:99999;padding:12px 16px;border-radius:12px;background:#1a1a1a;color:#fff;font:600 14px/1.3 system-ui;text-align:center';
          document.body.appendChild(n);
          setTimeout(function () { n.remove(); }, 5000);
        });
      }
    } catch (e) {}
    if (off) {
      window['ga-disable-${GA_ID}'] = true;
      window.__dityamNoAnalytics = true;
    }
  })();
`;

export function Analytics() {
  const pathname = usePathname();
  const internal = isInternalPath(pathname);

  // Модерацію відкриває лише той, хто працює над сайтом. Позначаємо браузер,
  // щоб його наступні заходи на публічні сторінки теж не рахувались: до
  // 17.09.2026 адмінку виключали, а решту заходів із того ж браузера — ні.
  useEffect(() => {
    if (!internal) return;
    try { localStorage.setItem(NO_ANALYTICS_KEY, '1'); } catch { /* приватний режим */ }
  }, [internal]);

  // Верхні кроки воронки — у власну базу, бо з GA4 їх не дістати в адмінку
  // (lib/site-events.js). «Зайшов» рахуємо раз на сесію, «відкрив Dityam+» —
  // на кожному заході на /plus.
  useEffect(() => {
    if (internal) return;
    markVisit();
  }, [internal]);

  useEffect(() => {
    if (internal || !isPlusPath(pathname)) return;
    sendSiteEvent(SITE_EVENTS.PLUS_VIEW);
  }, [internal, pathname]);

  // Перехід у бота Dityam+ звідки завгодно. Слухаємо документ, а не правимо
  // шість файлів із такими посиланнями: так жодна кнопка не загубиться й
  // наступна порахується сама.
  useEffect(() => {
    if (internal) return undefined;
    const onPlusClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href*="DityamPlusBot"]') : null;
      if (a) sendSiteEvent(SITE_EVENTS.PLUS_CLICK);
    };
    document.addEventListener('click', onPlusClick, true);
    return () => document.removeEventListener('click', onPlusClick, true);
  }, [internal]);

  // Клік по картці можливості з будь-якої сторінки — одна подія card_click.
  useEffect(() => {
    if (internal) return undefined;
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a.card') : null;
      const slug = a ? cardSlugFromHref(a.getAttribute('href')) : null;
      if (slug) trackCardClick(slug, window.location.pathname);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [internal]);

  if (internal) return null;

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
          function gtag(){
            dataLayer.push(arguments);
            ${AMPLITUDE_KEY ? `
            // Кожна подія GA4 йде ще й в Amplitude — однією точкою тут, а не
            // в сорока місцях, де викликають gtag. Amplitude вантажиться пізно
            // (lazyOnload), тож до того події чекають у черзі. «conversion» —
            // службовий виклик Google Ads, не подія.
            if (arguments[0] === 'event' && arguments[1] !== 'conversion' && !window.__dityamNoAnalytics) {
              (window.__dityamAmpQ = window.__dityamAmpQ || []).push([arguments[1], arguments[2] || {}]);
              if (window.__dityamAmpFlush) window.__dityamAmpFlush();
            }` : ''}
          }
          gtag('js', new Date());
          // A/B-тест картки (lib/ab-card.js): варіант — user property, до
          // config, щоб його ніс уже перший page_view. Без cookie — A.
          gtag('set', 'user_properties', {
            ab_card: (document.cookie.match(/(?:^|;\\s*)ab_card=(A|B)(?:;|$)/) || [])[1] || 'A'
          });
          gtag('config', '${GA_ID}');
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ''}
        `}
      </Script>
      {/* lazyOnload: Hotjar не потрібен для першого екрана, а це ~30 КБ JS,
          що змагався за головний потік із самою сторінкою (Lighthouse 14.09.2026). */}
      {HOTJAR_ID ? (
        <Script id="hotjar" strategy="lazyOnload">
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
      {/* Amplitude — теж lazyOnload: для першого екрана не потрібен. Автозбір:
          перегляди сторінок, сесії, джерела переходів, кліки, форми, файли.
          Запис сесій (Session Replay) не вмикаємо: для цього вже є Hotjar. */}
      {AMPLITUDE_KEY ? (
        <Script id="amplitude" strategy="lazyOnload">
          {`
            if (!window.__dityamNoAnalytics) {
              (function () {
                var s = document.createElement('script');
                s.async = true;
                // Звичайна бібліотека, а не скрипт проєкту /script/<ключ>.js: той
                // тягне ще Web Experiment і запис сесій і на сайті падав
                // («Cannot read properties of undefined (reading 'push')») —
                // 02.10.2026 за дві години в Amplitude не дійшло жодної події.
                s.src = 'https://${AMPLITUDE_EU ? 'cdn.eu.amplitude.com' : 'cdn.amplitude.com'}/libs/analytics-browser-${AMPLITUDE_SDK_VERSION}-min.js.gz';
                s.onload = function () {
                  var a = window.amplitude;
                  if (!a || !a.init) return;
                  try {
                    a.init('${AMPLITUDE_KEY}', {
                      ${AMPLITUDE_EU ? "serverZone: 'EU'," : ''}
                      autocapture: {
                        attribution: true,
                        pageViews: true,
                        sessions: true,
                        formInteractions: true,
                        fileDownloads: true,
                        elementInteractions: true
                      }
                    });
                    // Варіант A/B-тесту картки — властивість користувача, як у GA4.
                    if (a.Identify) {
                      var id = new a.Identify();
                      id.set('ab_card', (document.cookie.match(/(?:^|;\\s*)ab_card=(A|B)(?:;|$)/) || [])[1] || 'A');
                      a.identify(id);
                    }
                    window.__dityamAmpFlush = function () {
                      var q = window.__dityamAmpQ || [];
                      while (q.length) { var e = q.shift(); a.track(e[0], e[1]); }
                    };
                    window.__dityamAmpFlush();
                  } catch (e) { /* аналітика — не причина ламати сторінку */ }
                };
                document.head.appendChild(s);
              })();
            }
          `}
        </Script>
      ) : null}
    </>
  );
}
