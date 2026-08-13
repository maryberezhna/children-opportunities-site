'use client';
import { useState, useEffect, useRef } from 'react';

export const OPEN_SUBSCRIBE_EVENT = 'dityam:open-subscribe';

const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

// localStorage: користувач долучився до каналу — не показуємо більше.
const JOINED_KEY = 'dityam_subscribed';

// sessionStorage: закрив у поточному візиті — не спамимо до перезавантаження.
const SESSION_DISMISSED_KEY = 'dityam_popup_dismissed_session';

const TIME_TRIGGER_MS = 8000;
const CARDS_TRIGGER = 15;

// Скільки висить, перш ніж сховатись. Смуга внизу губилась серед карток —
// підказка біля кнопки помітна, але саме тому не має стояти вічно.
const AUTO_HIDE_MS = 10000;

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const triggered = useRef(false);
  const hideTimer = useRef(null);

  const shouldShow = () => {
    if (typeof window === 'undefined') return false;
    try {
      if (localStorage.getItem(JOINED_KEY)) return false;
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY)) return false;
      return true;
    } catch (e) {
      return true;
    }
  };

  const openPopup = (trigger) => {
    if (triggered.current) return;
    if (!shouldShow()) return;
    triggered.current = true;
    setIsOpen(true);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_popup_shown', {
        event_category: 'engagement',
        event_label: trigger,
      });
    }
  };

  const closePopup = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, Date.now().toString());
    } catch (e) {}
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_popup_dismissed', {
        event_category: 'engagement',
      });
    }
  };

  const handleJoinClick = () => {
    try {
      localStorage.setItem(JOINED_KEY, Date.now().toString());
    } catch (e) {}
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_join_click', {
        event_category: 'conversion',
        event_label: 'popup',
      });
    }
    // Закриваємо одразу — Telegram відкриється у новій вкладці через target="_blank".
    setIsOpen(false);
  };

  // ТРИГЕР 1: 8 секунд
  useEffect(() => {
    if (!shouldShow()) return;
    const timer = setTimeout(() => openPopup('timer_8s'), TIME_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, []);

  // ТРИГЕР 2: 15 переглянутих карток
  useEffect(() => {
    if (!shouldShow()) return;

    const checkScroll = () => {
      if (triggered.current) return;
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

      if (visibleCount >= CARDS_TRIGGER) {
        openPopup('scroll_15_cards');
      }
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
  }, []);

  // ТРИГЕР 3: Зовнішня подія (кнопки "Підписатись" у хедері/футері)
  useEffect(() => {
    const handleOpen = () => {
      if (typeof window !== 'undefined') {
        const joined = localStorage.getItem(JOINED_KEY);
        if (joined) {
          alert('Ви вже долучилися до Telegram-каналу 🧡');
          return;
        }
      }
      triggered.current = true;
      setIsOpen(true);
    };
    window.addEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
  }, []);

  // Скрол більше не блокуємо: смуга внизу нічого не перекриває,
  // тож зупиняти читання каталогу немає причин.

  // Ховаємо самі через 10 секунд — але не поки на підказці курсор: інакше
  // вона зникала б просто тоді, коли людина тягнеться до кнопки.
  const startHideTimer = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setIsOpen(false);
      // Позначаємо сеанс: підказка своє показала, друга поява — уже спам.
      try { sessionStorage.setItem(SESSION_DISMISSED_KEY, Date.now().toString()); } catch (e) {}
    }, AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    startHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') closePopup(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

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
        <strong>Залишайтесь на зв&apos;язку</strong>
        <span>Нові можливості — щодня в Telegram</span>
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

      <button className="tg-callout-close" onClick={closePopup} aria-label="Закрити">
        ✕
      </button>
    </div>
  );
}
