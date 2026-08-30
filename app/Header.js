'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOPIC_LIST } from '@/lib/topics';
import { CITY_META } from '@/lib/cities';

// Постійний хедер: 4 маршрути-хаби + пошук + одна CTA. Глибина (підбірки,
// міста, категорії) живе на хабах і у футері — меню не росте разом із
// каталогом. Старий StickyHeader (виринав по скролу, без навігації) замінено.
// hrefEn — англійський двійник, якщо він є. Інакше лишається українська
// сторінка: привести на існуючу чесніше, ніж на 404.
const NAV = [
  { href: '/', hrefEn: '/en', label: 'Каталог', en: 'Catalogue',
    match: (p) => p === '/' || p === '/en' },
  { href: '/kategorii', hrefEn: '/en/categories', label: 'Категорії', en: 'Categories',
    match: (p) => p.startsWith('/kategorii') || p.startsWith('/en/categories') },
  { href: '/about', hrefEn: '/en/about', label: 'Про проєкт', en: 'About',
    match: (p) => /^\/(en\/)?(about|press|yak-my-pereviriaiemo|how-we-verify)/.test(p) },
  { href: '/contacts', hrefEn: '/en/contacts', label: 'Написати нам', en: 'Contact',
    match: (p) => /^\/(en\/)?contacts/.test(p) },
];

const isEn = (p) => p === '/en' || p.startsWith('/en/');

// Перемикач має вести на ТУ САМУ сторінку іншою мовою, а не на головну:
// інакше людина, що читає «Як ми перевіряємо дані», натискає English і
// опиняється в каталозі, загубивши те, що читала.
//
// Слаги, які не збігаються, — тут; решта відрізняється лише префіксом /en,
// а сторінка можливості (/o/slug) збігається сама собою.
const SLUG_PAIRS = [
  ['/yak-my-pereviriaiemo', '/en/how-we-verify'],
  ['/kategorii', '/en/categories'],
  ['/pidbirka', '/en/plus'],
  ['/dyakuyu', '/en/thank-you'],
  // Підбірки мають свої англійські слаги, бо існують заради пошуку.
  ...TOPIC_LIST.map((t) => [`/${t.slug}`, `/en/${t.en.slug}`]),
];

// Сторінки, де слаг однаковий і різниця лише в префіксі /en.
const HAS_EN = [
  '/about', '/contacts', '/support', '/privacy', '/terms',
  '/press', '/refund', '/offline',
  ...Object.keys(CITY_META).map((c) => `/${c}`),
];

// Префіксні гілки: сторінка можливості та «додати в календар» збігаються
// слагом, але слаг динамічний, тож переліком їх не задати.
const PREFIX_EN = ['/o/', '/events/'];

export function counterpart(pathname, toEnglish) {
  const p = pathname || '/';
  for (const [uk, en] of SLUG_PAIRS) {
    if (toEnglish && p === uk) return en;
    if (!toEnglish && p === en) return uk;
  }
  if (toEnglish) {
    if (p === '/') return '/en';
    if (HAS_EN.includes(p) || PREFIX_EN.some((x) => p.startsWith(x))) return `/en${p}`;
    return '/en';
  }
  if (p === '/en') return '/';
  const rest = p.replace(/^\/en/, '');
  return rest || '/';
}

const POPULAR = [
  { href: '/bezkoshtovni-tabory', hrefEn: '/en/free-camps', label: 'Табори', en: 'Camps' },
  { href: '/bezkoshtovni-hurtky', hrefEn: '/en/free-clubs-and-courses', label: 'Гуртки', en: 'Clubs' },
  { href: '/konkursy', hrefEn: '/en/contests', label: 'Конкурси', en: 'Contests' },
  { href: '/mizhnarodni-olimpiady', hrefEn: '/en/olympiads', label: 'Олімпіади', en: 'Olympiads' },
  { href: '/prohramy-obminu', hrefEn: '/en/exchange-programs', label: 'Обміни', en: 'Exchanges' },
  { href: '/kyiv', hrefEn: '/en/kyiv', label: 'Київ', en: 'Kyiv' },
  { href: '/lviv', hrefEn: '/en/lviv', label: 'Львів', en: 'Lviv' },
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
  const to = (item) => ((isEnglish && item.hrefEn) || item.href);

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
        <Link href={isEnglish ? '/en' : '/'} className="site-header-logo" onClick={track('logo')}>
          <span aria-hidden="true">🧡</span> dityam.com.ua
        </Link>

        <nav className="site-header-nav" aria-label={isEnglish ? 'Main navigation' : 'Головна навігація'}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={to(item)}
              className={`site-header-link${item.match(pathname) ? ' active' : ''}`}
              onClick={track(item.label)}
            >
              {t(item)}
            </Link>
          ))}
        </nav>

        <form className="site-header-search" action={isEnglish ? '/en' : '/'} method="get" role="search">
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
          href={counterpart(pathname, !isEnglish)}
          className="site-header-lang"
          hrefLang={isEnglish ? 'uk' : 'en'}
          lang={isEnglish ? 'uk' : 'en'}
          onClick={switchLang}
        >
          {isEnglish ? 'Українською' : 'English'}
        </Link>

        <Link href={isEnglish ? '/en/plus' : '/pidbirka'} className="site-header-cta" onClick={track('plus')}>
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
              href={to(item)}
              className={`site-header-menu-item${item.match(pathname) ? ' active' : ''}`}
            >
              {t(item)}
            </Link>
          ))}
          <form className="site-header-menu-search" action={isEnglish ? '/en' : '/'} method="get" role="search">
            <input type="search" name="q" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          </form>
          <div className="site-header-menu-sub">{isEnglish ? 'Popular' : 'Популярне'}</div>
          <div className="site-header-menu-chips">
            {POPULAR.map((c) => (
              <Link key={c.href} href={to(c)} className="site-header-chip">{t(c)}</Link>
            ))}
          </div>
          {/* На вузькому екрані перемикач у шапці схований — тут його місце. */}
          <Link
            href={counterpart(pathname, !isEnglish)}
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
