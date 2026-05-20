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

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const triggered = useRef(false);

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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
      className="subscribe-popup-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}
    >
      <div className="subscribe-popup">
        <button
          className="subscribe-popup-close"
          onClick={closePopup}
          aria-label="Закрити"
        >
          ✕
        </button>

        <div className="subscribe-popup-header">
          <div className="subscribe-popup-icon" aria-hidden="true">
            <img
              src="/logo.png"
              alt=""
              width="96"
              height="96"
              className="subscribe-popup-logo"
            />
          </div>
          <h2 className="subscribe-popup-title">Долучайтеся до нашого Telegram-каналу</h2>
          <p className="subscribe-popup-description">
            Нові можливості для дітей — щодня в Telegram.
            <br />
            Без спаму. Відписатись можна одним кліком.
          </p>
        </div>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="subscribe-popup-tg-cta"
          onClick={handleJoinClick}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
          </svg>
          Долучитися до Telegram
        </a>

        <button className="subscribe-popup-skip" onClick={closePopup}>
          Пізніше, дякую
        </button>
      </div>
    </div>
  );
}
