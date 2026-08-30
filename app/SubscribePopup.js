'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { trackConversion } from '@/lib/track';

export const OPEN_SUBSCRIBE_EVENT = 'dityam:open-subscribe';

// Момент цінності: людина щойно пішла на сайт організатора, тобто знайшла те,
// по що прийшла. Списки й сторінка можливості кидають цю подію, підказка на
// неї чекає — саме тут у пропозиції підписатись є причина, а не на 4-й секунді.
export const OPPORTUNITY_CLICK_EVENT = 'dityam:opportunity-click';

const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

// localStorage: користувач долучився до каналу — не показуємо більше.
const JOINED_KEY = 'dityam_subscribed';

// sessionStorage: ЗАКРИВ ХРЕСТИКОМ. Автоприховування сюди навмисно не пише.
// Раніше писало — і «не хочу» та «не помітив» були злиті в один стан: підказка
// згорала на 18-й секунді назавжди, при середній сесії 4,6 хвилини. З 368
// показів 353 просто зникли самі, і повторного шансу вже не було.
const SESSION_CLOSED_KEY = 'dityam_popup_closed_session';

const TIME_TRIGGER_MS = 4000;
const CARDS_TRIGGER = 15;

// Скільки висить, перш ніж сховатись. Смуга внизу губилась серед карток —
// підказка біля кнопки помітна, але саме тому не має стояти вічно.
const AUTO_HIDE_MS = 10000;

// Пауза після автоприховування. Без неї підказка миготіла б щоразу, коли
// людина повертається з вкладки організатора.
const RESHOW_COOLDOWN_MS = 45000;

// Стеля на сесію: повторний показ має бути другим шансом, а не переслідуванням.
const MAX_SHOWS_PER_SESSION = 3;

// Посилання організатора відкривається в новій вкладці, тож підказку показуємо
// на поверненні. Але вкладка могла й не відкритись (блокувальник, той самий
// таб) — тоді показуємо із затримкою, щоб момент цінності не пропав зовсім.
const VALUE_FALLBACK_MS = 12000;

const COPY = {
  default: {
    title: 'Залишайтесь на зв’язку',
    text: 'Нові можливості — щодня в Telegram',
  },
  // Людина щойно перейшла до організатора: говоримо не «підпишіться», а про
  // те, що таких знахідок буде більше й вони швидко зникають.
  value: {
    title: 'Знайшли потрібне?',
    text: 'Щодня з’являються нові — надсилаємо їх у Telegram',
  },
};

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [variant, setVariant] = useState('default');

  const openRef = useRef(false);        // актуальний стан для слухачів подій
  const lastTrigger = useRef('');       // чим викликано поточний показ
  const shownCount = useRef(0);
  const lastHiddenAt = useRef(0);
  const hideTimer = useRef(null);
  const pendingValue = useRef(false);   // чекаємо на повернення у вкладку
  const valueFallback = useRef(null);

  useEffect(() => { openRef.current = isOpen; }, [isOpen]);

  // force — показ на явну дію людини («Підписатись» у хедері чи нижній панелі).
  // Такий запит поважаємо попри ліміти: людина сама попросила.
  const canShow = useCallback((force = false) => {
    if (typeof window === 'undefined') return false;
    if (openRef.current) return false;
    try {
      if (localStorage.getItem(JOINED_KEY)) return false;
      if (sessionStorage.getItem(SESSION_CLOSED_KEY)) return false;
    } catch (e) {
      // Приватний режим — не привід ховати підказку.
    }
    if (force) return true;
    if (shownCount.current >= MAX_SHOWS_PER_SESSION) return false;
    if (lastHiddenAt.current &&
        Date.now() - lastHiddenAt.current < RESHOW_COOLDOWN_MS) return false;
    return true;
  }, []);

  const open = useCallback((trigger, nextVariant = 'default', force = false) => {
    if (!canShow(force)) return;
    shownCount.current += 1;
    lastTrigger.current = trigger;
    openRef.current = true;
    setVariant(nextVariant);
    setIsOpen(true);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_popup_shown', {
        event_category: 'engagement',
        event_label: trigger,
      });
    }
  }, [canShow]);

  // reason: 'closed' (хрестик/Esc), 'autohidden' (таймер), 'joined' (перехід).
  // Окрема подія на автоприховування — щоб у GA4 нарешті було видно різницю
  // між «побачив і не зацікавився» та «не помітив».
  const hide = useCallback((reason) => {
    clearTimeout(hideTimer.current);
    openRef.current = false;
    setIsOpen(false);
    lastHiddenAt.current = Date.now();

    if (reason === 'closed') {
      try {
        sessionStorage.setItem(SESSION_CLOSED_KEY, Date.now().toString());
      } catch (e) {}
    }
    if (reason !== 'joined' && typeof window !== 'undefined' && window.gtag) {
      window.gtag(
        'event',
        reason === 'closed' ? 'telegram_popup_dismissed' : 'telegram_popup_autohidden',
        { event_category: 'engagement', event_label: lastTrigger.current },
      );
    }
  }, []);

  const handleJoinClick = () => {
    try {
      localStorage.setItem(JOINED_KEY, Date.now().toString());
    } catch (e) {}
    // event_label лишаємо 'popup' (сумісність із наявними звітами), а тригер
    // передаємо окремо: тепер видно, який саме момент приносить підписників.
    trackConversion('telegram_join_click', {
      event_label: 'popup',
      popup_trigger: lastTrigger.current,
    });
    hide('joined');
  };

  // ТРИГЕР 1: 4 секунди — м'який перший дотик. Раніше це був єдиний показ за
  // сесію, тепер лише перший з кількох, тож рання поява нічого не «спалює».
  useEffect(() => {
    const timer = setTimeout(() => open('timer_4s'), TIME_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // ТРИГЕР 2: 15 переглянутих карток
  useEffect(() => {
    const checkScroll = () => {
      if (openRef.current) return;
      const cards = document.querySelectorAll('.card');
      if (cards.length === 0) return;

      const viewportBottom = window.scrollY + window.innerHeight;
      let visibleCount = 0;

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardTop = rect.top + window.scrollY;
        if (cardTop < viewportBottom - rect.height / 2) {
          visibleCount++;
        }
      });

      if (visibleCount >= CARDS_TRIGGER) open('scroll_15_cards');
    };

    let timeout;
    const onScroll = () => {
      if (timeout) return;
      timeout = setTimeout(() => {
        checkScroll();
        timeout = null;
      }, 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, [open]);

  // ТРИГЕР 3: момент цінності — перехід до організатора.
  useEffect(() => {
    const onValue = () => {
      pendingValue.current = true;
      clearTimeout(valueFallback.current);
      valueFallback.current = setTimeout(() => {
        if (!pendingValue.current) return;
        // Якщо вкладка досі схована, показ зробить visibilitychange.
        if (document.visibilityState !== 'visible') return;
        pendingValue.current = false;
        open('opportunity_click', 'value');
      }, VALUE_FALLBACK_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pendingValue.current) return;
      pendingValue.current = false;
      clearTimeout(valueFallback.current);
      // Коротка пауза: людина щойно повернулась, дамо їй побачити сторінку.
      setTimeout(() => open('opportunity_click', 'value'), 800);
    };

    window.addEventListener(OPPORTUNITY_CLICK_EVENT, onValue);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(OPPORTUNITY_CLICK_EVENT, onValue);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(valueFallback.current);
    };
  }, [open]);

  // ТРИГЕР 4: кнопки «Підписатись» у хедері / нижній панелі.
  useEffect(() => {
    const handleOpen = () => {
      try {
        if (localStorage.getItem(JOINED_KEY)) {
          alert('Ви вже долучилися до Telegram-каналу 🧡');
          return;
        }
      } catch (e) {}
      open('manual', 'default', true);
    };
    window.addEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
  }, [open]);

  // Ховаємо самі через 10 секунд — але не поки на підказці курсор: інакше
  // вона зникала б просто тоді, коли людина тягнеться до кнопки.
  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => hide('autohidden'), AUTO_HIDE_MS);
  }, [hide]);

  useEffect(() => {
    if (!isOpen) return undefined;
    startHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [isOpen, startHideTimer]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEsc = (e) => { if (e.key === 'Escape') hide('closed'); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, hide]);

  if (!isOpen) return null;

  const copy = COPY[variant] || COPY.default;

  return (
    <div
      className="tg-callout"
      role="complementary"
      aria-label="Долучитись до Telegram-каналу"
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={startHideTimer}
    >
      {/* Іконки тут немає навмисно: підказка визирає з-під самої кнопки
          Telegram, і другий літачок за сантиметр від першого — шум. */}
      <p className="tg-callout-text">
        <strong>{copy.title}</strong>
        <span>{copy.text}</span>
      </p>

      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="tg-callout-cta"
        onClick={handleJoinClick}
      >
        Долучитися
      </a>

      <button
        className="tg-callout-close"
        onClick={() => hide('closed')}
        aria-label="Закрити"
      >
        ✕
      </button>
    </div>
  );
}
