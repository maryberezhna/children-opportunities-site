'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOPIC_LIST, TOPIC_NAV, topicPath } from '@/lib/topics';
import { ERASMUS_PATH } from '@/lib/erasmus';
import { CITY_META } from '@/lib/cities';
import { readMode, writeMode, onModeChange } from '@/lib/mode';

// Шапка редизайну (вересень 2026): лого рукописним Caveat, три пункти
// навігації, перемикач «Батькам / Підліткам» на сторінках каталогу і одна
// помаранчева CTA — з 14.09.2026 це Dityam+, а не «Підтримати». Пошук з шапки переїхав у фільтри каталогу,
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
  // Мобільна головна (≤900px): шапка — лого, перемикач і меню; Dityam+ та
  // «Підтримати» — у меню (референс «Dityam — мобільна версія», 6a).
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
  // Підменю «Підбірки» (14.09.2026, прохання Марії): на десктопі — випадний
  // список біля «Про проєкт», у мобільному меню — окрема група. Відкривається
  // наведенням і кліком; закривається Escape, кліком поза ним і переходом.
  const [topicsOpen, setTopicsOpen] = useState(false);
  const topicsRef = useRef(null);
  useEffect(() => { setMenuOpen(false); setTopicsOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen && !topicsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); setTopicsOpen(false); } };
    const onDown = (e) => {
      if (topicsOpen && topicsRef.current && !topicsRef.current.contains(e.target)) setTopicsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuOpen, topicsOpen]);

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
  // Dityam+ теж не в переліку: це помаранчева кнопка праворуч (замість
  // «Підтримати», яка переїхала в мобільне меню й футер).
  const NAV = isEnglish
    ? [{ href: '/en/about', label: 'About', active: pathname.startsWith('/en/about') }]
    : [{ href: '/about', label: 'Про проєкт', active: pathname.startsWith('/about') }];
  const PLUS_HREF = isEnglish ? '/en/plus' : '/plus';
  const TOPICS_LABEL = isEnglish ? 'Collections' : 'Підбірки';
  const topicLinks = TOPIC_NAV.flatMap((t) => {
    const link = { href: topicPath(t, isEnglish ? 'en' : 'uk'), label: isEnglish ? t.labelEn : t.label };
    // Путівник Erasmus+ — одразу під «Програмами обміну», як у його хлібних
    // крихтах. Англійської версії путівника поки немає.
    return !isEnglish && t.slug === 'prohramy-obminu' ? [link, { href: ERASMUS_PATH, label: 'Erasmus+' }] : [link];
  });
  const topicActive = topicLinks.some((l) => l.href === pathname);

  return (
    <header className={headerClass}>
      <div className="v2-header-inner">
        <Link href={isEnglish ? '/en' : '/'} className="v2-logo" onClick={track('logo')}>
          <span className="v2-logo-script">dityam.com.ua</span>
        </Link>

        <nav className="v2-nav" aria-label={isEnglish ? 'Main navigation' : 'Головна навігація'}>
          <div
            ref={topicsRef}
            className={`v2-nav-drop${topicsOpen ? ' is-open' : ''}`}
            onMouseEnter={() => setTopicsOpen(true)}
            onMouseLeave={() => setTopicsOpen(false)}
          >
            <button
              type="button"
              className={`v2-nav-drop-btn${topicActive ? ' is-active' : ''}`}
              aria-expanded={topicsOpen}
              aria-controls="v2-topics-menu"
              onClick={() => setTopicsOpen((v) => !v)}
            >
              {TOPICS_LABEL}
              <span className="v2-nav-caret" aria-hidden="true" />
            </button>
            {/* Посилання лишаються в HTML і при закритому списку (hidden):
                пошуковик бачить внутрішні лінки на всі підбірки з кожної сторінки. */}
            <ul id="v2-topics-menu" className="v2-nav-drop-panel" hidden={!topicsOpen}>
              {topicLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={l.href === pathname ? 'page' : undefined}
                    onClick={() => { track(`topic:${l.label}`)(); setTopicsOpen(false); }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
          <Link
            href={PLUS_HREF}
            className="v2-support-btn"
            aria-current={pathname.startsWith(PLUS_HREF) ? 'page' : undefined}
            onClick={track('Dityam+')}
          >
            Dityam+
          </Link>
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
          <div className="v2-mmenu-group" role="group" aria-labelledby="v2-mmenu-topics">
            <span id="v2-mmenu-topics" className="v2-mmenu-label">{TOPICS_LABEL}</span>
            {topicLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`v2-mmenu-sub${l.href === pathname ? ' is-active' : ''}`}
                aria-current={l.href === pathname ? 'page' : undefined}
                onClick={() => { track(`topic:${l.label}`)(); setMenuOpen(false); }}
              >
                {l.label}
              </Link>
            ))}
          </div>
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
            onClick={() => { track('support')(); setMenuOpen(false); }}
          >
            🧡 {isEnglish ? 'Support' : 'Підтримати'}
          </a>
          <Link
            href={PLUS_HREF}
            className="v2-mmenu-support"
            onClick={() => { track('Dityam+')(); setMenuOpen(false); }}
          >
            Dityam+
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
