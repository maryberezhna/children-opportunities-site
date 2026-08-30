'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TELEGRAM_URL } from '@/lib/social';
import { trackConversion, OPPORTUNITY_CLICK_EVENT } from '@/lib/track';

export const OPEN_SUBSCRIBE_EVENT = 'dityam:open-subscribe';

// localStorage: користувач долучився до каналу — не показуємо більше.
const JOINED_KEY = 'dityam_subscribed';

// sessionStorage: ЗАКРИВ ХРЕСТИКОМ. Автоприховування сюди навмисно не пише.
// Раніше писало — і «не хочу» та «не помітив» були злиті в один стан: підказка
// згорала на 18-й секунді назавжди, при середній сесії 4,6 хвилини. З 368
// показів 353 просто зникли самі, і повторного шансу вже не було.
const SESSION_CLOSED_KEY = 'dityam_popup_closed_session';

// Лічильники теж у sessionStorage, а не в рефах компонента. Підказка змонтована
// окремо на головній, тематичних, міських і на сторінці можливості, тож перехід
// між ними перемонтовує компонент. У рефах ліміт і пауза обнулялись на кожній
// сторінці — «3 покази на сесію» не діяли взагалі, і людина, яка ходить по
// картках, бачила підказку щоразу на 4-й секунді.
const SESSION_SHOWS_KEY = 'dityam_popup_shows';
const SESSION_HIDDEN_AT_KEY = 'dityam_popup_hidden_at';

const TIME_TRIGGER_MS = 4000;
const CARDS_TRIGGER = 15;

// Скільки висить, перш ніж сховатись. Смуга внизу губилась серед карток —
// підказка біля кнопки помітна, але саме тому не має стояти вічно.
const AUTO_HIDE_MS = 10000;

// Пауза після автоприховування. Не поширюється на момент цінності: там людина
// щойно зробила дію, і чекати 45 секунд означало б втратити той єдиний момент,
// заради якого тригер і додавався.
const RESHOW_COOLDOWN_MS = 45000;

// Стеля на сесію: повторний показ має бути другим шансом, а не переслідуванням.
const MAX_SHOWS_PER_SESSION = 3;

// Посилання організатора відкривається в новій вкладці, тож підказку показуємо
// на поверненні. Але вкладка могла й не відкритись (блокувальник, той самий
// таб) — тоді показуємо із затримкою, щоб момент цінності не пропав зовсім.
const VALUE_FALLBACK_MS = 12000;

// Пауза після повернення у вкладку: даємо людині побачити сторінку.
const VALUE_SETTLE_MS = 800;

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

// Приватний режим або вимкнене сховище — не привід ламати сторінку.
const readFlag = (storage, key) => {
  try {
    return Boolean(window[storage].getItem(key));
  } catch (e) {
    return false;
  }
};
const readNumber = (key) => {
  try {
    return Number(window.sessionStorage.getItem(key)) || 0;
  } catch (e) {
    return 0;
  }
};
const writeSession = (key, value) => {
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch (e) {}
};

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [variant, setVariant] = useState('default');

  const openRef = useRef(false);        // актуальний стан для слухачів подій
  const lastTrigger = useRef('');       // чим викликано поточний показ
  const hideTimer = useRef(null);
  const pendingValue = useRef(false);   // чекаємо на повернення у вкладку
  const valueFallback = useRef(null);
  const valueShowTimer = useRef(null);

  // Долучився або закрив хрестиком — у цій сесії підказка більше не потрібна.
  const isSuppressed = useCallback(() => (
    readFlag('localStorage', JOINED_KEY) || readFlag('sessionStorage', SESSION_CLOSED_KEY)
  ), []);

  // force — показ на явну дію людини («Підписатись» у хедері чи нижній панелі).
  // Стоїть ПЕРЕД перевіркою на закриття: інакше кнопка «Підписатись» ставала
  // мертвою до кінця сесії, щойно людина раз закрила підказку хрестиком.
  const canShow = useCallback(({ force = false, ignoreCooldown = false } = {}) => {
    if (typeof window === 'undefined') return false;
    if (openRef.current) return false;
    if (readFlag('localStorage', JOINED_KEY)) return false;
    if (force) return true;
    if (readFlag('sessionStorage', SESSION_CLOSED_KEY)) return false;
    if (readNumber(SESSION_SHOWS_KEY) >= MAX_SHOWS_PER_SESSION) return false;
    if (!ignoreCooldown) {
      const hiddenAt = readNumber(SESSION_HIDDEN_AT_KEY);
      if (hiddenAt && Date.now() - hiddenAt < RESHOW_COOLDOWN_MS) return false;
    }
    return true;
  }, []);

  const open = useCallback((trigger, nextVariant = 'default', opts = {}) => {
    if (!canShow(opts)) return;
    writeSession(SESSION_SHOWS_KEY, readNumber(SESSION_SHOWS_KEY) + 1);
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
    writeSession(SESSION_HIDDEN_AT_KEY, Date.now());

    if (reason === 'closed') writeSession(SESSION_CLOSED_KEY, Date.now());

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
    if (isSuppressed()) return undefined;
    const timer = setTimeout(() => open('timer_4s'), TIME_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, [open, isSuppressed]);

  // ТРИГЕР 2: 15 переглянутих карток.
  // Слухач не вішаємо взагалі, якщо підказка вже не потрібна: checkScroll на
  // кожні 250 мс робить querySelectorAll('.card') і getBoundingClientRect по
  // кожній картці — примусовий перерахунок layout на найгарячішому шляху.
  useEffect(() => {
    if (isSuppressed()) return undefined;

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
  }, [open, isSuppressed]);

  // ТРИГЕР 3: момент цінності — перехід до організатора. Паузу між показами
  // тут свідомо ігноруємо: це найсильніший момент, і другого такого не буде.
  useEffect(() => {
    const showValue = () => open('opportunity_click', 'value', { ignoreCooldown: true });

    const onValue = () => {
      pendingValue.current = true;
      clearTimeout(valueFallback.current);
      valueFallback.current = setTimeout(() => {
        if (!pendingValue.current) return;
        // Якщо вкладка досі схована, показ зробить visibilitychange.
        if (document.visibilityState !== 'visible') return;
        pendingValue.current = false;
        showValue();
      }, VALUE_FALLBACK_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pendingValue.current) return;
      pendingValue.current = false;
      clearTimeout(valueFallback.current);
      clearTimeout(valueShowTimer.current);
      valueShowTimer.current = setTimeout(showValue, VALUE_SETTLE_MS);
    };

    window.addEventListener(OPPORTUNITY_CLICK_EVENT, onValue);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(OPPORTUNITY_CLICK_EVENT, onValue);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(valueFallback.current);
      // Без цього таймер спрацьовував уже після розмонтування й писав у GA4
      // показ підказки, якої ніхто не бачив.
      clearTimeout(valueShowTimer.current);
    };
  }, [open]);

  // ТРИГЕР 4: кнопки «Підписатись» у хедері / нижній панелі.
  useEffect(() => {
    const handleOpen = () => {
      if (readFlag('localStorage', JOINED_KEY)) {
        alert('Ви вже долучилися до Telegram-каналу 🧡');
        return;
      }
      open('manual', 'default', { force: true });
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
        className="tg-cta tg-callout-cta"
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
