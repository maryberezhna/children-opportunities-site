'use client';
import { useState, useEffect, useRef } from 'react';

// Подія для відкриття з інших компонентів (кнопки "Підписатись")
export const OPEN_SUBSCRIBE_EVENT = 'dityam:open-subscribe';

// Ключ у localStorage (тільки ОДИН - хто підписався назавжди)
const SUBSCRIBED_KEY = 'dityam_subscribed';

// Ключ у sessionStorage - щоб не показувати 100 разів за один візит
const SESSION_DISMISSED_KEY = 'dityam_popup_dismissed_session';

// Налаштування тригерів
const TIME_TRIGGER_MS = 8000;   // 8 секунд
const CARDS_TRIGGER = 15;        // Після 15 переглянутих карток

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const scriptLoaded = useRef(false);
  const triggered = useRef(false);

  // Показувати якщо: НЕ підписаний І не закривав у цій сесії
  const shouldShow = () => {
    if (typeof window === 'undefined') return false;
    try {
      const subscribed = localStorage.getItem(SUBSCRIBED_KEY);
      if (subscribed) return false; // підписався - не показувати більше ніколи

      const sessionDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
      if (sessionDismissed) return false; // закрив у цій сесії - не спамити

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
      window.gtag('event', 'subscribe_popup_shown', {
        event_category: 'engagement',
        event_label: trigger,
      });
    }
  };

  const closePopup = () => {
    setIsOpen(false);
    // Запамʼятовуємо у sessionStorage - не показувати більше в цьому візиті
    // При новому відкритті сайту покажемо знову (якщо не підписався)
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, Date.now().toString());
    } catch (e) {}
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_popup_dismissed', {
        event_category: 'engagement',
      });
    }
  };

  // ТРИГЕР 1: Таймер 8 секунд
  useEffect(() => {
    if (!shouldShow()) return;
    const timer = setTimeout(() => {
      openPopup('timer_8s');
    }, TIME_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, []);

  // ТРИГЕР 2: Скрол через 15 карток
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
        const subscribed = localStorage.getItem(SUBSCRIBED_KEY);
        if (subscribed) {
          alert('Ви вже підписані на розсилку! Дякуємо 🧡');
          return;
        }
      }
      triggered.current = true;
      setIsOpen(true);
    };
    window.addEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SUBSCRIBE_EVENT, handleOpen);
  }, []);

  // Завантаження HubSpot форми коли поп-ап відкривається
  useEffect(() => {
    if (!isOpen || scriptLoaded.current) return;
    scriptLoaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://js-eu1.hsforms.net/forms/embed/26525145.js';
    script.defer = true;
    document.body.appendChild(script);
  }, [isOpen]);

  // Блокуємо scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Закриття по Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') closePopup(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Детектимо коли форма відправлена
  useEffect(() => {
    const onMessage = (e) => {
      if (e.data?.type === 'hsFormCallback' && e.data?.eventName === 'onFormSubmitted') {
        try {
          localStorage.setItem(SUBSCRIBED_KEY, Date.now().toString());
        } catch (err) {}
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'subscribe_form_submitted', {
            event_category: 'conversion',
            event_label: 'popup',
          });
        }
        setTimeout(() => setIsOpen(false), 3000);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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
          <div className="subscribe-popup-icon">📬</div>
          <h2 className="subscribe-popup-title">Не пропустіть нові можливості</h2>
          <p className="subscribe-popup-description">
            Раз на місяць — 5-7 найкращих програм для дітей на email.
            <br />
            Без спаму. Відписатись можна одним кліком.
          </p>
        </div>

        <div className="subscribe-popup-form">
          <div
            className="hs-form-frame"
            data-region="eu1"
            data-form-id="7d2d6246-71fc-4650-a9e8-547523cec5c7"
            data-portal-id="26525145"
          />
        </div>

        <button className="subscribe-popup-skip" onClick={closePopup}>
          Пізніше, дякую
        </button>
      </div>
    </div>
  );
}
