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
  ['/pidbirka', '/en/plus'],
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
  // SSR завжди малює «Батькам»: справжній режим читається з localStorage
  // після монтування, інакше React лається на розбіжність розмітки.
  const [mode, setMode] = useState('parents');
  useEffect(() => {
    setMode(readMode());
    return onModeChange(setMode);
  }, []);

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

  const NAV = isEnglish
    ? [
        { href: '/en', label: 'Catalogue', active: pathname === '/en' },
        { href: '/en/about', label: 'About', active: pathname.startsWith('/en/about') },
        { href: '/en/plus', label: 'Dityam+', active: pathname.startsWith('/en/plus') },
      ]
    : [
        { href: '/', label: 'Каталог', active: pathname === '/' },
        { href: '/about', label: 'Про проєкт', active: pathname.startsWith('/about') },
        { href: '/pidbirka', label: 'Dityam+', active: pathname.startsWith('/pidbirka') },
      ];

  return (
    <header className="v2-header">
      <div className="v2-header-inner">
        <Link href={isEnglish ? '/en' : '/'} className="v2-logo" onClick={track('logo')}>
          <span className="v2-logo-heart" aria-hidden="true">🧡</span>
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
      </div>
    </header>
  );
}
