'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Постійний хедер: 4 маршрути-хаби + пошук + одна CTA. Глибина (підбірки,
// міста, категорії) живе на хабах і у футері — меню не росте разом із
// каталогом. Старий StickyHeader (виринав по скролу, без навігації) замінено.
const NAV = [
  { href: '/', label: 'Каталог', en: 'Catalogue', match: (p) => p === '/' },
  { href: '/kategorii', label: 'Категорії', en: 'Categories', match: (p) => p.startsWith('/kategorii') },
  { href: '/about', label: 'Про проєкт', en: 'About', match: (p) => p.startsWith('/about') || p.startsWith('/press') || p.startsWith('/yak-my-pereviriaiemo') },
  { href: '/contacts', label: 'Написати нам', en: 'Contact', match: (p) => p.startsWith('/contacts') },
];

const isEn = (p) => p.startsWith('/en');

const POPULAR = [
  { href: '/bezkoshtovni-tabory', label: 'Табори', en: 'Camps' },
  { href: '/bezkoshtovni-hurtky', label: 'Гуртки', en: 'Clubs' },
  { href: '/konkursy', label: 'Конкурси', en: 'Contests' },
  { href: '/mizhnarodni-olimpiady', label: 'Олімпіади', en: 'Olympiads' },
  { href: '/prohramy-obminu', label: 'Обміни', en: 'Exchanges' },
  { href: '/kyiv', label: 'Київ', en: 'Kyiv' },
  { href: '/lviv', label: 'Львів', en: 'Lviv' },
];

// Вибір мови треба памʼятати: середник /middleware.js відправляє відвідувача
// не з України на /en, і без цієї позначки натиснуте «Українською» відкидало б
// його назад тим самим редіректом. Рік — щоб вибір пережив сесію.
export function rememberLang(lang) {
  try {
    document.cookie = `dityam_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* noop */
  }
}

export default function Header() {
  const pathname = usePathname() || '/';
  const isEnglish = isEn(pathname);
  const [open, setOpen] = useState(false);
  const t = (item) => (isEnglish ? item.en : item.label);

  // Меню закривається при переході — інакше висить над новою сторінкою.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Службові сторінки живуть без публічного хедера.
  if (pathname.startsWith('/admin')) return null;

  const track = (label) => () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'header_nav_click', { event_label: label });
    }
  };

  const switchLang = () => {
    rememberLang(isEnglish ? 'uk' : 'en');
    track(isEnglish ? 'lang-uk' : 'lang-en')();
  };

  const searchPlaceholder = isEnglish ? 'Search opportunities…' : 'Пошук можливостей…';

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-logo" onClick={track('logo')}>
          <span aria-hidden="true">🧡</span> dityam.com.ua
        </Link>

        <nav className="site-header-nav" aria-label={isEnglish ? 'Main navigation' : 'Головна навігація'}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-header-link${item.match(pathname) ? ' active' : ''}`}
              onClick={track(item.label)}
            >
              {t(item)}
            </Link>
          ))}
        </nav>

        <form className="site-header-search" action="/" method="get" role="search">
          <input
            type="search"
            name="q"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </form>

        {/* Перемикач мови. Досі його не було зовсім: англійська сторінка
            існувала, але потрапити на неї можна було лише через одноразовий
            банер LangSuggest, і тільки з неукраїнським браузером. Українець
            не знайшов би її ніколи, а з /en не було шляху назад.
            Ведемо чесно: /en — це не перекладений каталог, а англійський
            вступ до проєкту, тож підпис «English», а не «EN-версія сайту». */}
        <Link
          href={isEnglish ? '/' : '/en'}
          className="site-header-lang"
          hrefLang={isEnglish ? 'uk' : 'en'}
          lang={isEnglish ? 'uk' : 'en'}
          onClick={switchLang}
        >
          {isEnglish ? 'Українською' : 'English'}
        </Link>

        <Link href="/pidbirka" className="site-header-cta" onClick={track('plus')}>
          Dityam+
        </Link>

        <button
          type="button"
          className={`site-header-burger${open ? ' open' : ''}`}
          aria-label={open
            ? (isEnglish ? 'Close menu' : 'Закрити меню')
            : (isEnglish ? 'Open menu' : 'Відкрити меню')}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <i /><i /><i />
        </button>
      </div>

      {open && (
        <div className="site-header-menu">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-header-menu-item${item.match(pathname) ? ' active' : ''}`}
            >
              {t(item)}
            </Link>
          ))}
          <form className="site-header-menu-search" action="/" method="get" role="search">
            <input type="search" name="q" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          </form>
          <div className="site-header-menu-sub">{isEnglish ? 'Popular' : 'Популярне'}</div>
          <div className="site-header-menu-chips">
            {POPULAR.map((c) => (
              <Link key={c.href} href={c.href} className="site-header-chip">{t(c)}</Link>
            ))}
          </div>
          {/* На вузькому екрані перемикач у шапці схований — тут його місце. */}
          <Link
            href={isEnglish ? '/' : '/en'}
            className="site-header-menu-item"
            hrefLang={isEnglish ? 'uk' : 'en'}
            lang={isEnglish ? 'uk' : 'en'}
            onClick={switchLang}
          >
            {isEnglish ? '🇺🇦 Українською' : '🇬🇧 English'}
          </Link>
        </div>
      )}
    </header>
  );
}
