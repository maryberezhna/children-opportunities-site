'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TELEGRAM_URL } from '@/lib/social';
import { PLUS_WAITLIST_URL } from '@/lib/plus';
import { trackConversion, OPPORTUNITY_CLICK_EVENT } from '@/lib/track';

export const OPEN_SUBSCRIBE_EVENT = 'dityam:open-subscribe';

// localStorage: користувач долучився до каналу — не показуємо більше.
// Той самий прапорець читає TelegramCard у списках.
export const JOINED_KEY = 'dityam_subscribed';

// localStorage: став у список очікування Dityam+. Окремий прапорець, бо це
// інша дія, і TelegramCard у списках його не читає.
export const PLUS_KEY = 'dityam_plus_waitlist';

// localStorage: закрив хрестиком — не показуємо 30 днів. Досі памʼятали лише
// сесію, тож наступного дня людина, яка сказала «ні», бачила підказку знову
// (NN/g, «Popups: 10 Problematic Trends»: повторний показ тому, хто вже
// відмовився, читається як переслідування). Явне «ні» живе довше за сесію,
// але не вічно: за місяць і сайт, і пропозиція вже інші.
export const DISMISSED_KEY = 'dityam_popup_dismissed';
const DISMISS_DAYS = 30;

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

// 4-секундного тригера більше немає (22.09.2026). За 23.08–22.09 із 3 049
// показів 70% зникли самі, а закрили хрестиком лише 1,4%: на четвертій секунді
// людина ще нічого не знайшла, і показ згорав. Перший дотик тепер — Telegram-
// картка в самому списку (TelegramCard.js), а підказка лишається для моментів,
// коли вже є інтерес: 15 карток, повернення від організатора, кнопка.
const CARDS_TRIGGER = 15;

// Класи карток у списках. Були просто '.card', але редизайн перейменував їх на
// 'v2-card' (головна, міські сторінки) і 'tp-card' (тематичні), а '.card'
// лишився тільки в «схожих можливостях» — і тригер тихо помер: за 14 днів усі
// 1 896 показів дала не прокрутка, а повернення від організатора. Додаючи
// новий список карток, додай сюди його клас (стереже tests/subscribePopupCards).
const CARD_SELECTOR = '.card, .v2-card, .tp-card';

// Скільки висить, перш ніж сховатись. Смуга внизу губилась серед карток —
// підказка біля кнопки помітна, але саме тому не має стояти вічно.
// 10 секунд було замало: 70% показів гасли непоміченими. Курсор на підказці
// таймер зупиняє, тож 20 секунд не заважають тому, хто вже тягнеться до кнопки.
const AUTO_HIDE_MS = 20000;

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

// Заголовок підказки. Далі — два рівноцінні шляхи лишитись на звʼязку
// (Марія, 22.09.2026: «розділи на 2 частини… зліва телеграм канал і справа
// waitlist Dityam+»). До того підказка пропонувала лише канал, а список
// очікування Dityam+ за два тижні зібрав 7 кліків на весь сайт.
const COPY = {
  default: {
    title: 'Давайте бути на звʼязку',
    text: 'Оберіть, як зручніше',
  },
  // Людина щойно перейшла до організатора: говоримо не «підпишіться», а про
  // те, що таких знахідок буде більше й вони швидко зникають.
  value: {
    title: 'Знайшли потрібне?',
    text: 'Щодня зʼявляються нові — не пропустіть',
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

/** Чи діє ще відмова хрестиком. Зіпсована або чужа мітка — наче її немає. */
const dismissedRecently = () => {
  try {
    const at = Number(window.localStorage.getItem(DISMISSED_KEY));
    if (!at) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch (e) {
    return false;
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
    (readFlag('localStorage', JOINED_KEY) && readFlag('localStorage', PLUS_KEY))
    || readFlag('sessionStorage', SESSION_CLOSED_KEY)
    || dismissedRecently()
  ), []);

  // force — показ на явну дію людини («Підписатись» у хедері чи нижній панелі).
  // Стоїть ПЕРЕД перевіркою на закриття: інакше кнопка «Підписатись» ставала
  // мертвою до кінця сесії, щойно людина раз закрила підказку хрестиком.
  const canShow = useCallback(({ force = false, ignoreCooldown = false } = {}) => {
    if (typeof window === 'undefined') return false;
    if (openRef.current) return false;
    if (readFlag('localStorage', JOINED_KEY) && readFlag('localStorage', PLUS_KEY)) return false;
    // Натиснули «Підписатись» самі — показуємо, навіть якщо колись закрили.
    if (force) return true;
    if (readFlag('sessionStorage', SESSION_CLOSED_KEY)) return false;
    if (dismissedRecently()) return false;
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
      // popup_trigger — той самий параметр, що й у кліках: у звіті один
      // стовпчик означає одне («чим викликано показ»), хай яка подія.
      // event_label лишаємо для сумісності з наявними звітами.
      window.gtag('event', 'telegram_popup_shown', {
        event_category: 'engagement',
        event_label: trigger,
        popup_trigger: trigger,
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

    if (reason === 'closed') {
      writeSession(SESSION_CLOSED_KEY, Date.now());
      try {
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
      } catch (e) {}
    }

    if (reason !== 'joined' && typeof window !== 'undefined' && window.gtag) {
      window.gtag(
        'event',
        reason === 'closed' ? 'telegram_popup_dismissed' : 'telegram_popup_autohidden',
        {
          event_category: 'engagement',
          event_label: lastTrigger.current,
          popup_trigger: lastTrigger.current,
        },
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

  // Другий шлях: список очікування Dityam+. Подію лишаємо ту саму, що й на
  // решті сайту (plus_waitlist_tg_click), щоб звіти не розʼїхались, а місце
  // видно в event_label.
  const handlePlusClick = () => {
    try {
      localStorage.setItem(PLUS_KEY, Date.now().toString());
    } catch (e) {}
    trackConversion('plus_waitlist_tg_click', {
      event_label: 'popup',
      popup_trigger: lastTrigger.current,
    });
    hide('joined');
  };

  // ТРИГЕР 1: 15 переглянутих карток.
  // Слухач не вішаємо взагалі, якщо підказка вже не потрібна: checkScroll на
  // кожні 250 мс робить querySelectorAll('.card') і getBoundingClientRect по
  // кожній картці — примусовий перерахунок layout на найгарячішому шляху.
  useEffect(() => {
    if (isSuppressed()) return undefined;

    const checkScroll = () => {
      if (openRef.current) return;
      const cards = document.querySelectorAll(CARD_SELECTOR);
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

  // ТРИГЕР 2: момент цінності — перехід до організатора. Паузу між показами
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

  // ТРИГЕР 3: кнопки «Підписатись» у хедері / нижній панелі.
  useEffect(() => {
    const handleOpen = () => {
      if (readFlag('localStorage', JOINED_KEY) && readFlag('localStorage', PLUS_KEY)) {
        alert('Ви вже з нами — і в каналі, і в списку Dityam+ 🧡');
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

  const copy = COPY[variant] || COPY.default;

  // Область лишається в розмітці завжди: браузер озвучує зміну тексту в ній,
  // а не появу нового вузла. Порожня — мовчить.
  const liveRegion = (
    <div className="sr-only" role="status" aria-live="polite">
      {isOpen ? `${copy.title}. ${copy.text}: Telegram-канал або список Dityam+.` : ''}
    </div>
  );

  if (!isOpen) return liveRegion;

  return (
    <>
      {liveRegion}
    <div
      className="tg-callout"
      role="complementary"
      aria-label="Лишитись на звʼязку"
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={startHideTimer}
    >
      <p className="tg-callout-text">
        <strong>{copy.title}</strong>
        <span>{copy.text}</span>
      </p>

      {/* Два рівноцінні шляхи, не один із «або ще можна»: зліва безкоштовний
          канал, справа список очікування Dityam+. Порядок і сторони —
          рішення Марії 22.09.2026. */}
      <div className="tg-callout-options">
        <div className="tg-callout-option">
          <span className="tg-callout-opt-title">Telegram-канал</span>
          <span className="tg-callout-opt-text">Нові можливості щодня, безкоштовно</span>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tg-cta tg-callout-cta"
            onClick={handleJoinClick}
          >
            Долучитися
          </a>
        </div>

        <div className="tg-callout-option">
          <span className="tg-callout-opt-title">Dityam+</span>
          <span className="tg-callout-opt-text">Добірка під вашу дитину — скоро</span>
          <a
            href={PLUS_WAITLIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tg-callout-cta tg-callout-cta-plus"
            onClick={handlePlusClick}
          >
            Стати в список
          </a>
        </div>
      </div>

      <button
        className="tg-callout-close"
        onClick={() => hide('closed')}
        aria-label="Закрити"
      >
        ✕
      </button>
    </div>
    </>
  );
}
