'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rememberLang } from './Header';

// Пропозиція англійської версії для тих, кого не забрав редірект: людина
// в Україні з неукраїнським браузером. Тих, хто заходить з-за кордону,
// /middleware.js веде на /en одразу. Банер закривається назавжди
// (localStorage) — і клік по ньому запамʼятовує вибір мови, щоб редірект
// та перемикач у шапці не сперечалися між собою.
const KEY = 'dityam_lang_suggest_dismissed';

export default function LangSuggest() {
  const pathname = usePathname() || '/';
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      const langs = navigator.languages || [navigator.language || ''];
      const primary = (langs[0] || '').toLowerCase();
      // uk/ru — читають українську; решті пропонуємо англійську сторінку.
      if (primary.startsWith('uk') || primary.startsWith('ru')) return;
      setShow(true);
      if (window.gtag) window.gtag('event', 'lang_suggest_shown');
    } catch {
      /* noop */
    }
  }, []);

  if (!show || pathname.startsWith('/en') || pathname.startsWith('/admin')) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
    setShow(false);
  };

  return (
    <div className="lang-suggest" lang="en">
      <span className="lang-suggest-text">
        🇺🇦 Opportunities for Ukrainian children — worldwide.
      </span>
      <Link
        href="/en"
        className="lang-suggest-link"
        onClick={() => {
          rememberLang('en');
          if (window.gtag) window.gtag('event', 'lang_suggest_click');
        }}
      >
        View in English →
      </Link>
      <button type="button" className="lang-suggest-close" aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
