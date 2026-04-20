'use client';
import { useState, useEffect, useRef } from 'react';

// Ключі в localStorage
const DISMISSED_KEY = 'dityam_subscribe_dismissed';
const SUBSCRIBED_KEY = 'dityam_subscribed';

// Налаштування тригерів
const TIME_TRIGGER_MS = 10000;  // 10 секунд
const CARDS_TRIGGER = 15;        // Після 15 переглянутих карток

export default function SubscribePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const scriptLoaded = useRef(false);
  const triggered = useRef(false);

  // Перевіряємо чи вже показували поп-ап цьому користувачу
  const shouldShow = () => {
    if (typeof window === 'undefined') return false;
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      const subscribed = localStorage.getItem(SUBSCRIBED_KEY);
      return !dismissed && !subscribed;
    } catch (e) {
      return true;
    }
  };

  const openPopup = (trigger) => {
    if (triggered.current) return;
    if (!shouldShow()) return;
    triggered.current = true;
    setIsOpen(true);
    // Трекінг
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_popup_shown', {
        event_category: 'engagement',
        event_label: trigger,
      });
    }
  };

  const closePopup = () => {
    setIsOpen(false);
    // Запам'ятовуємо що закрили — не показувати знову
    try {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    } catch (e) {}
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_popup_dismissed', {
        event_category: 'engagement',
      });
    }
  };

  // ТРИГЕР 1: Таймер 10 секунд
  useEffect(() => {
    if (!shouldShow()) return;
    const timer = setTimeout(() => {
      openPopup('timer_10s');
    }, TIME_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, []);

  // ТРИГЕР 2: Скрол через 15 карток
  useEffect(() => {
    if (!shouldShow()) return;

    const checkScroll = () => {
      if (triggered.current) return;
      // Рахуємо скільки карток видно в поточній view
      const cards = document.querySelectorAll('.card');
      if (cards.length === 0) return;

      const viewportBottom = window.scrollY + window.innerHeight;
      let visibleCount = 0;

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardTop = rect.top + window.scrollY;
        // Картка "переглянута" якщо ми проскролили нижче її верху
        if (cardTop < viewportBottom - rect.height / 2) {
          visibleCount++;
        }
      });

      if (visibleCount >= CARDS_TRIGGER) {
        openPopup('scroll_15_cards');
      }
    };

    // Throttled scroll handler
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

  // Детектимо коли форма відправлена (HubSpot постить message)
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
        // Автозакриття через 3 сек після успішної підписки
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
