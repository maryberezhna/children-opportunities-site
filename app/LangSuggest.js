'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rememberLang, counterpart } from './Header';
import { readsUkrainian, langSuggestion, isEnglishPath, LANG_SUGGEST_KEY } from '@/lib/lang';

/**
 * Пропозиція іншої мовної версії — в обидва боки.
 *
 * Було лише в один: людині в Україні з неукраїнським браузером пропонували
 * англійську. Зворотного випадку не існувало, хоча саме він і масовий: за 28
 * днів на англійські сторінки зайшли 326 разів, із них 103 з ChatGPT, і 81%
 * усього трафіку з ChatGPT — з України. Тобто україномовна людина потрапляла
 * на англійську сторінку й не отримувала жодної підказки, що та сама сторінка
 * є українською. Підказку за той самий час показано 10 разів.
 *
 * Ведемо на ТУ САМУ сторінку іншою мовою (counterpart), а не на головну:
 * людина прийшла по конкретну тему, і повертати її на початок — те саме, що
 * не допомогти.
 *
 * Тих, хто заходить на головну з-за кордону з неукраїнським браузером,
 * /middleware.js веде на /en одразу — сюди вони не доходять.
 *
 * Показ вирішує не цей компонент, а LANG_SUGGEST_BOOT_SCRIPT (lib/lang.js) ще
 * до першої промальовки: розмітка банера завжди в HTML, а CSS показує її, лише
 * коли на <html> стоїть data-lang-suggest. Раніше банер з'являвся після
 * гідратації й зсував сторінку на 70px (07.10.2026). Тут — лише синхронізація
 * атрибута при переходах усередині сайту й кнопка «закрити».
 */
export default function LangSuggest() {
  const pathname = usePathname() || '/';
  // Який банер може знадобитись на цій адресі. Чи він видимий — каже атрибут.
  const variant = pathname.startsWith('/admin') ? null : (isEnglishPath(pathname) ? 'to_uk' : 'to_en');
  const toEnglish = variant === 'to_en';
  const shown = useRef(null);

  // Переходи всередині сайту: скрипт у <body> бачив лише першу адресу.
  // Рішення — у lib/lang.js, щоб його перевіряв тест.
  useEffect(() => {
    let s = null;
    try {
      if (!localStorage.getItem(LANG_SUGGEST_KEY)) {
        s = langSuggestion({ pathname, uaReader: readsUkrainian(navigator.languages || [navigator.language || '']) });
      }
    } catch {
      /* приватний режим — просто не показуємо */
    }
    const root = document.documentElement;
    if (s) root.setAttribute('data-lang-suggest', s);
    else root.removeAttribute('data-lang-suggest');
    // Подію шлемо раз на появу варіанта, а не на кожен перехід, поки він видимий.
    if (s && s !== shown.current && window.gtag) {
      window.gtag('event', 'lang_suggest_shown', { event_label: s });
    }
    shown.current = s;
  }, [pathname]);

  if (!variant) return null;

  const href = counterpart(pathname, toEnglish);
  const dismiss = () => {
    try { localStorage.setItem(LANG_SUGGEST_KEY, '1'); } catch { /* noop */ }
    document.documentElement.removeAttribute('data-lang-suggest');
    shown.current = null;
  };

  return (
    <div className="lang-suggest" data-variant={variant} lang={toEnglish ? 'en' : 'uk'}>
      <span className="lang-suggest-text">
        {toEnglish
          ? '🇺🇦 Opportunities for Ukrainian children — worldwide.'
          : '🇺🇦 Ця сторінка є українською — з тими самими можливостями.'}
      </span>
      <Link
        href={href}
        prefetch={false}
        className="lang-suggest-link"
        onClick={() => {
          rememberLang(toEnglish ? 'en' : 'uk');
          if (window.gtag) {
            window.gtag('event', 'lang_suggest_click', { event_label: toEnglish ? 'to_en' : 'to_uk' });
          }
        }}
      >
        {toEnglish ? 'View in English →' : 'Читати українською →'}
      </Link>
      <button
        type="button"
        className="lang-suggest-close"
        aria-label={toEnglish ? 'Dismiss' : 'Закрити'}
        onClick={dismiss}
      >
        ✕
      </button>
    </div>
  );
}
