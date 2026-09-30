'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rememberLang, counterpart } from './Header';
import { readsUkrainian, langSuggestion } from '@/lib/lang';

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
 */
const KEY = 'dityam_lang_suggest_dismissed';

export default function LangSuggest() {
  const pathname = usePathname() || '/';
  // null — ще не знаємо: до перевірки браузера не показуємо нічого, щоб банер
  // не блимнув не тією мовою.
  const [uaReader, setUaReader] = useState(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      setUaReader(readsUkrainian(navigator.languages || [navigator.language || '']));
    } catch {
      /* приватний режим — просто не показуємо */
    }
  }, []);

  // Рішення — у lib/lang.js, щоб його перевіряв тест: сам банер зібрати в
  // тесті нічим, а помилка тут показала б людині не ту мову.
  const suggest = langSuggestion({ pathname, uaReader });
  const toEnglish = suggest === 'to_en';
  const show = Boolean(suggest);

  useEffect(() => {
    if (show && window.gtag) {
      window.gtag('event', 'lang_suggest_shown', { event_label: toEnglish ? 'to_en' : 'to_uk' });
    }
    // Раніше подію слали з ефекту, що не знав про адресу: на /en вона
    // спрацьовувала, хоча банер не малювався. Тепер шлемо лише те, що видно.
  }, [show, toEnglish]);

  if (!show) return null;

  const href = counterpart(pathname, toEnglish);
  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
    setUaReader(null);
  };

  return (
    <div className="lang-suggest" lang={toEnglish ? 'en' : 'uk'}>
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
