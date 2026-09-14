'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOPIC_LIST } from '@/lib/topics';
import { CITY_META } from '@/lib/cities';
import { readMode, writeMode, onModeChange } from '@/lib/mode';

// Шапка редизайну (вересень 2026): лого рукописним Caveat, три пункти
// навігації, перемикач «Батькам / Підліткам» на сторінках каталогу і одна
// помаранчева CTA «Підтримати». Пошук з шапки переїхав у фільтри каталогу,
// перемикач мови — прибраний свідомо (EN-сторінки живуть за прямими URL і
// в sitemap; банер LangSuggest лишається для неукраїнських браузерів).

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

const isEn = (p) => p === '/en' || p.startsWith('/en/');

// Перемикач мови зник із шапки, але LangSuggest досі веде людей на «ту саму
// сторінку іншою мовою» — таблиця відповідностей лишається тут.
const SLUG_PAIRS = [
  ['/yak-my-pereviriaiemo', '/en/how-we-verify'],
  ['/kategorii', '/en/categories'],
  ['/plus', '/en/plus'],
  ['/dyakuyu', '/en/thank-you'],
  ...TOPIC_LIST.map((t) => [`/${t.slug}`, `/en/${t.en.slug}`]),
];

const HAS_EN = [
  '/about', '/contacts', '/support', '/privacy', '/terms',
  '/press', '/refund', '/offline',
  ...Object.keys(CITY_META).map((c) => `/${c}`),
];

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
  // Перемикач режиму живе лише там, де є каталог, — на головній.
  const isCatalogue = pathname === '/' || pathname === '/en';
  // Мобільна головна (≤900px): шапка — лише лого й перемикач, «Підтримати»
  // живе у футері (референс «Dityam — мобільна версія», 6a).
  const headerClass = `v2-header${pathname === '/' ? ' v2-header--home' : ''}`;
  // SSR завжди малює «Батькам»: справжній режим читається з localStorage
  // після монтування, інакше React лається на розбіжність розмітки.
  const [mode, setMode] = useState('parents');
  useEffect(() => {
    setMode(readMode());
    return onModeChange(setMode);
  }, []);

  // Меню на телефоні. На вузьких екранах навігацію сховано (.v2-nav), і в
  // шапці лишались лише лого й одна кнопка — до «Про проєкт», Dityam+ і
  // Telegram можна було дістатися тільки через футер унизу сторінки.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (pathname.startsWith('/admin')) return null;

  const track = (label) => () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'header_nav_click', { event_label: label });
    }
  };

  const switchMode = (m) => () => {
    setMode(m);
    writeMode(m);
  };

  // Пункту «Каталог» у меню немає навмисно: логотип веде рівно туди ж, а два
  // посилання на ту саму сторінку поруч лише з'їдають місце в шапці.
  const NAV = isEnglish
    ? [
        { href: '/en/about', label: 'About', active: pathname.startsWith('/en/about') },
        { href: '/en/plus', label: 'Dityam+', active: pathname.startsWith('/en/plus') },
      ]
    : [
        { href: '/about', label: 'Про проєкт', active: pathname.startsWith('/about') },
        { href: '/plus', label: 'Dityam+', active: pathname.startsWith('/plus') },
      ];

  return (
    <header className={headerClass}>
      <div className="v2-header-inner">
        <Link href={isEnglish ? '/en' : '/'} className="v2-logo" onClick={track('logo')}>
          <span className="v2-logo-script">dityam.com.ua</span>
        </Link>

        <nav className="v2-nav" aria-label={isEnglish ? 'Main navigation' : 'Головна навігація'}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? 'is-active' : undefined}
              onClick={track(item.label)}
            >
              {item.label}
            </Link>
          ))}
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={track('telegram')}>
            Telegram
          </a>
        </nav>

        <div className="v2-header-right">
          {isCatalogue ? (
            <div className="v2-mode" role="group" aria-label={isEnglish ? 'Who is browsing' : 'Хто дивиться'}>
              <button
                type="button"
                className={mode === 'parents' ? 'is-on' : undefined}
                onClick={switchMode('parents')}
              >
                {isEnglish ? 'Parents' : 'Батькам'}
              </button>
              <button
                type="button"
                className={mode === 'teens' ? 'is-on' : undefined}
                onClick={switchMode('teens')}
              >
                {isEnglish ? 'Teens' : 'Підліткам'}
              </button>
            </div>
          ) : null}
          <a
            href={MONOBANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-support-btn"
            onClick={track('support')}
          >
            🧡 {isEnglish ? 'Support' : 'Підтримати'}
          </a>
        </div>

        <button
          type="button"
          className="v2-burger"
          aria-expanded={menuOpen}
          aria-controls="v2-mobile-menu"
          aria-label={isEnglish
            ? (menuOpen ? 'Close menu' : 'Open menu')
            : (menuOpen ? 'Закрити меню' : 'Відкрити меню')}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span aria-hidden="true" className={menuOpen ? 'v2-burger-lines is-open' : 'v2-burger-lines'} />
        </button>
      </div>

      {menuOpen ? (
        <nav id="v2-mobile-menu" className="v2-mmenu" aria-label={isEnglish ? 'Menu' : 'Меню'}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? 'is-active' : undefined}
              onClick={() => { track(item.label)(); setMenuOpen(false); }}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { track('telegram')(); setMenuOpen(false); }}
          >
            Telegram
          </a>
          <a
            href={MONOBANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-mmenu-support"
            onClick={() => { track('support')(); setMenuOpen(false); }}
          >
            🧡 {isEnglish ? 'Support' : 'Підтримати'}
          </a>
        </nav>
      ) : null}
    </header>
  );
}
