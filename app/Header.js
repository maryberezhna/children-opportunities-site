'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Постійний хедер: 4 маршрути-хаби + пошук + одна CTA. Глибина (підбірки,
// міста, категорії) живе на хабах і у футері — меню не росте разом із
// каталогом. Старий StickyHeader (виринав по скролу, без навігації) замінено.
const NAV = [
  { href: '/', label: 'Каталог', match: (p) => p === '/' },
  { href: '/kategorii', label: 'Категорії', match: (p) => p.startsWith('/kategorii') },
  { href: '/events', label: 'Календар', match: (p) => p.startsWith('/events') || p.startsWith('/sviata') },
  { href: '/about', label: 'Про проєкт', match: (p) => p.startsWith('/about') || p.startsWith('/press') || p.startsWith('/yak-my-pereviriaiemo') },
  { href: '/contacts', label: 'Написати нам', match: (p) => p.startsWith('/contacts') },
];

const POPULAR = [
  { href: '/bezkoshtovni-tabory', label: 'Табори' },
  { href: '/bezkoshtovni-hurtky', label: 'Гуртки' },
  { href: '/konkursy', label: 'Конкурси' },
  { href: '/mizhnarodni-olimpiady', label: 'Олімпіади' },
  { href: '/prohramy-obminu', label: 'Обміни' },
  { href: '/kyiv', label: 'Київ' },
  { href: '/lviv', label: 'Львів' },
];

export default function Header() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);

  // Меню закривається при переході — інакше висить над новою сторінкою.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Службові сторінки живуть без публічного хедера.
  if (pathname.startsWith('/admin')) return null;

  const track = (label) => () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'header_nav_click', { event_label: label });
    }
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-logo" onClick={track('logo')}>
          <span aria-hidden="true">🧡</span> dityam.com.ua
        </Link>

        <nav className="site-header-nav" aria-label="Головна навігація">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-header-link${item.match(pathname) ? ' active' : ''}`}
              onClick={track(item.label)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form className="site-header-search" action="/" method="get" role="search">
          <input
            type="search"
            name="q"
            placeholder="Пошук можливостей…"
            aria-label="Пошук можливостей"
          />
        </form>

        <Link href="/pidbirka" className="site-header-cta" onClick={track('plus')}>
          Dityam+
        </Link>

        <button
          type="button"
          className={`site-header-burger${open ? ' open' : ''}`}
          aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
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
              {item.label}
            </Link>
          ))}
          <form className="site-header-menu-search" action="/" method="get" role="search">
            <input type="search" name="q" placeholder="Пошук можливостей…" aria-label="Пошук можливостей" />
          </form>
          <div className="site-header-menu-sub">Популярне</div>
          <div className="site-header-menu-chips">
            {POPULAR.map((c) => (
              <Link key={c.href} href={c.href} className="site-header-chip">{c.label}</Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
