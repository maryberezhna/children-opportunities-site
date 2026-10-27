'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { NIGHT_ASKED_KEY, shouldAskAboutNight } from '@/lib/night-prompt';
import { THEME_KEY } from '@/lib/theme';
import useOverlaySlot from './useOverlaySlot';

/**
 * «Зараз нічна тема — лишити чи перейти на світлу?»
 *
 * Марія, 04.10.2026: «покажи на сайті попап у нічний час, що зараз активована
 * темна тема, чи бажаєте залишити, чи перейти на світлу. Час для України».
 *
 * Чому смужка знизу, а не модалка поверх сторінки: людина прийшла по
 * можливості, і перекривати їх питанням про колір — невелика, але справжня
 * шкода. Смужку видно, вона не ловить фокус силою і не заважає читати.
 *
 * Показуємо РІВНО ОДИН раз на пристрій: попап, який повертається, — це вже не
 * турбота. Будь-яка з трьох дій (залишити / світла / закрити) закриває питання
 * назавжди.
 *
 * Не показуємо в адмінці: там своя тема й свої задачі.
 *
 * Чекає своєї черги (lib/overlay-queue.js): після вибору мови й банера cookie.
 */
const L = {
  uk: {
    text: 'Зараз увімкнена нічна тема — за налаштуванням вашого пристрою.',
    keep: 'Залишити',
    light: 'Світла тема',
    close: 'Закрити',
  },
  en: {
    text: 'Night theme is on — it follows your device settings.',
    keep: 'Keep it',
    light: 'Light theme',
    close: 'Close',
  },
};

export default function NightThemePrompt() {
  const pathname = usePathname() || '/';
  const [show, setShow] = useState(false);
  const granted = useOverlaySlot('night', show);
  const t = pathname.startsWith('/en') ? L.en : L.uk;

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    let asked = false;
    let theme = 'auto';
    try {
      asked = localStorage.getItem(NIGHT_ASKED_KEY) === '1';
      theme = localStorage.getItem(THEME_KEY) || 'auto';
    } catch { /* приватне вікно — просто не питаємо */ }
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (shouldAskAboutNight({ theme, systemDark, asked })) setShow(true);
  }, [pathname]);

  const done = (next) => {
    try { localStorage.setItem(NIGHT_ASKED_KEY, '1'); } catch { /* ок */ }
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem(THEME_KEY, 'light'); } catch { /* ок */ }
    }
    setShow(false);
  };

  if (!show || !granted) return null;

  return (
    <div className="night-ask" role="status">
      <span className="night-ask-icon" aria-hidden="true">🌙</span>
      <p className="night-ask-text">{t.text}</p>
      <div className="night-ask-btns">
        <button type="button" className="night-ask-keep" onClick={() => done('keep')}>{t.keep}</button>
        <button type="button" className="night-ask-light" onClick={() => done('light')}>{t.light}</button>
      </div>
      <button type="button" className="night-ask-x" aria-label={t.close} onClick={() => done('keep')}>✕</button>
    </div>
  );
}
