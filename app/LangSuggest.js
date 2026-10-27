'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rememberLang, counterpart } from './Header';
import { readsUkrainian, langSuggestion, isEnglishPath, LANG_SUGGEST_KEY } from '@/lib/lang';

/**
 * Вибір мови — вікном, у якому людина сама обирає «Українська» чи «English»
 * (Марія, 27.10.2026: «зроби це попапом, щоб людина сама вибрала»). До того
 * це була смужка над шапкою «View in English → / Читати українською →».
 *
 * Коли показувати — як і раніше: україномовному браузеру на англійській
 * сторінці і неукраїнському на українській (lib/lang.js, langSuggestion).
 * Рішення приймає LANG_SUGGEST_BOOT_SCRIPT ще до першої промальовки й ставить
 * на <html> data-lang-suggest; розмітка вже в HTML, CSS показує її одразу.
 * Вікно fixed поверх сторінки, тож нічого не зсуває.
 *
 * Вибір іншої мови — та сама сторінка іншою мовою (counterpart) і cookie
 * dityam_lang; поточна мова, хрестик чи Esc — закрити й більше не питати
 * (LANG_SUGGEST_KEY). Банер згоди на cookie чекає, поки це вікно відкрите
 * (app/ConsentBanner.js), і говорить уже обраною мовою.
 */
export default function LangSuggest() {
  const pathname = usePathname() || '/';
  // Чи може знадобитись вікно на цій адресі. Чи воно видиме — каже атрибут.
  const variant = pathname.startsWith('/admin') ? null : (isEnglishPath(pathname) ? 'to_uk' : 'to_en');
  const onEnglish = variant === 'to_uk';
  const shown = useRef(null);
  const boxRef = useRef(null);

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
    if (s && s !== shown.current) {
      if (window.gtag) window.gtag('event', 'lang_suggest_shown', { event_label: s });
      // Фокус — на першу кнопку, щоб вибір робився і з клавіатури.
      setTimeout(() => boxRef.current?.querySelector('a, button.lang-choice-btn')?.focus(), 0);
    }
    shown.current = s;
  }, [pathname]);

  const dismiss = () => {
    try { localStorage.setItem(LANG_SUGGEST_KEY, '1'); } catch { /* noop */ }
    document.documentElement.removeAttribute('data-lang-suggest');
    shown.current = null;
  };

  // Esc закриває, Tab ходить по колу всередині вікна.
  useEffect(() => {
    const onKey = (e) => {
      if (!document.documentElement.hasAttribute('data-lang-suggest')) return;
      if (e.key === 'Escape') { dismiss(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const items = [...boxRef.current.querySelectorAll('a, button')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!variant) return null;

  const otherHref = counterpart(pathname, !onEnglish);
  const choose = (lang) => () => {
    rememberLang(lang);
    try { localStorage.setItem(LANG_SUGGEST_KEY, '1'); } catch { /* noop */ }
    document.documentElement.removeAttribute('data-lang-suggest');
    if (window.gtag) window.gtag('event', 'lang_suggest_click', { event_label: lang === 'en' ? 'to_en' : 'to_uk' });
  };
  const keep = (lang) => () => {
    rememberLang(lang);
    dismiss();
  };

  // Поточна мова — кнопка «лишитись», інша — посилання на ту саму сторінку.
  const uk = onEnglish
    ? <Link href={otherHref} prefetch={false} hrefLang="uk" lang="uk" className="lang-choice-btn" onClick={choose('uk')}>Українська</Link>
    : <button type="button" lang="uk" className="lang-choice-btn is-current" aria-current="true" onClick={keep('uk')}>Українська</button>;
  const en = onEnglish
    ? <button type="button" lang="en" className="lang-choice-btn is-current" aria-current="true" onClick={keep('en')}>English</button>
    : <Link href={otherHref} prefetch={false} hrefLang="en" lang="en" className="lang-choice-btn" onClick={choose('en')}>English</Link>;

  return (
    <div
      className="lang-suggest"
      data-variant={variant}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-choice-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="lang-choice" ref={boxRef}>
        <p id="lang-choice-title" className="lang-choice-title">
          <span lang="uk">Оберіть мову</span>
          <span className="lang-choice-sep" aria-hidden="true"> · </span>
          <span lang="en">Choose your language</span>
        </p>
        <p className="lang-choice-sub">
          <span lang="uk">Ті самі можливості обома мовами.</span>
          <span lang="en">The same opportunities in both languages.</span>
        </p>
        <div className="lang-choice-btns">
          {uk}
          {en}
        </div>
        <button
          type="button"
          className="lang-suggest-close"
          aria-label={onEnglish ? 'Close' : 'Закрити'}
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
