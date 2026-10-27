'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isEnglishPath } from '@/lib/lang';
import {
  shouldAskConsent, consentFromCookie, regionFromCookie, REGION_EU,
  CONSENT_COOKIE, CONSENT_MAX_AGE, CONSENT_GRANTED, CONSENT_DENIED, ANALYTICS_COOKIE_PREFIXES,
} from '@/lib/consent';

/**
 * Згода на cookie аналітики для ЄС/ЄЕЗ, Британії й Швейцарії (Марія,
 * 27.10.2026: «кукіс додай, бо це вже Євросоюз»). Правила — lib/consent.js.
 *
 * Показується сам, якщо регіон eu і вибору ще немає, — але не поверх вікна
 * вибору мови: спершу мова, потім банер уже обраною мовою. Кнопка «Налаштування
 * cookie» у футері відкриває його знову (подія dityam:cookie-settings).
 * «Прийняти» й «Відхилити» — однакові кнопки: відмова не має бути важчою.
 */
export const OPEN_EVENT = 'dityam:cookie-settings';

const COPY = {
  uk: {
    text: 'Ми використовуємо файли cookie для аналітики (Google Analytics, Hotjar, Amplitude), щоб розуміти, що корисно родинам. Необхідні cookie (мова сайту) працюють завжди.',
    more: 'Докладніше',
    href: '/privacy#cookies',
    accept: 'Прийняти',
    reject: 'Відхилити',
    label: 'Згода на файли cookie',
  },
  en: {
    text: 'We use cookies for analytics (Google Analytics, Hotjar, Amplitude) to understand what helps families. Necessary cookies (site language) always work.',
    more: 'Learn more',
    href: '/en/privacy#cookies',
    accept: 'Accept',
    reject: 'Reject',
    label: 'Cookie consent',
  },
};

function setConsent(value) {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
}

// Прибрати cookie аналітики, які могли лишитись від попередньої згоди.
function dropAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-3).join('.')}`];
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (!ANALYTICS_COOKIE_PREFIXES.some((p) => name.startsWith(p))) continue;
    for (const d of domains) {
      document.cookie = `${name}=; path=/; max-age=0${d ? `; domain=${d}` : ''}`;
    }
  }
}

export default function ConsentBanner() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const lang = isEnglishPath(pathname) ? 'en' : 'uk';
  const t = COPY[lang];

  useEffect(() => {
    if (pathname.startsWith('/admin')) return undefined;
    try { if (shouldAskConsent(document.cookie)) setOpen(true); } catch { /* noop */ }
    // Вікно вибору мови відкрите — чекаємо, поки людина обере.
    const root = document.documentElement;
    const sync = () => setLangOpen(root.hasAttribute('data-lang-suggest'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['data-lang-suggest'] });
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => { mo.disconnect(); window.removeEventListener(OPEN_EVENT, reopen); };
  }, [pathname]);

  if (!open || langOpen) return null;

  const accept = () => {
    setConsent(CONSENT_GRANTED);
    window.__dityamConsentPending = false;
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.__dityamLoadHotjar?.();
    window.__dityamLoadAmplitude?.();
    setOpen(false);
  };

  const reject = () => {
    const was = consentFromCookie(document.cookie);
    setConsent(CONSENT_DENIED);
    dropAnalyticsCookies();
    // Після «так» Hotjar і Amplitude вже завантажені — без перезавантаження
    // вони не зупиняться.
    if (was === CONSENT_GRANTED) { window.location.reload(); return; }
    setOpen(false);
  };

  return (
    <div className="consent-banner" role="region" aria-label={t.label} lang={lang}>
      <p>
        {t.text}{' '}
        <Link href={t.href} prefetch={false}>{t.more}</Link>
      </p>
      <div className="consent-btns">
        <button type="button" className="consent-btn" onClick={reject}>{t.reject}</button>
        <button type="button" className="consent-btn" onClick={accept}>{t.accept}</button>
      </div>
    </div>
  );
}

/** «Налаштування cookie» у футері — лише там, де банер має сенс (регіон eu). */
export function CookieSettingsLink({ lang = 'uk' }) {
  const [eu, setEu] = useState(false);
  useEffect(() => {
    try { setEu(regionFromCookie(document.cookie) === REGION_EU); } catch { /* noop */ }
  }, []);
  if (!eu) return null;
  return (
    <>
      {' · '}
      <button
        type="button"
        className="v2-footer-cookie-btn"
        onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      >
        {lang === 'en' ? 'Cookie settings' : 'Налаштування cookie'}
      </button>
    </>
  );
}
