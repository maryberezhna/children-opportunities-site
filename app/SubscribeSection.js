'use client';
import { useEffect, useRef, useState } from 'react';

export default function SubscribeSection() {
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Завантажуємо HubSpot скрипт лише один раз
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://js-eu1.hsforms.net/forms/embed/26525145.js';
    script.defer = true;
    document.body.appendChild(script);

    // Трекінг у Google Analytics коли секція з'являється
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_section_view', {
        event_category: 'engagement',
      });
    }
  }, []);

  // Блокуємо scroll коли попап відкритий
  useEffect(() => {
    if (isMobileModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileModalOpen]);

  // Закриття попапу по Escape
  useEffect(() => {
    if (!isMobileModalOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setIsMobileModalOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileModalOpen]);

  const handleMobileSubscribeClick = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_modal_open', {
        event_category: 'engagement',
      });
    }
    setIsMobileModalOpen(true);
  };

  return (
    <>
      <section className="subscribe-section" aria-label="Підписка на розсилку">
        <div className="subscribe-content">
          <div className="subscribe-icon">📬</div>
          <div className="subscribe-text">
            <h2 className="subscribe-title">Щомісячний дайджест можливостей</h2>
            <p className="subscribe-description">
              Раз на місяць — добірка 5-7 найцікавіших програм для дітей. Без спаму, можна відписатись у будь-який момент.
            </p>
          </div>
        </div>

        {/* ДЕСКТОП: форма одразу вбудована */}
        <div className="subscribe-form-wrap subscribe-desktop-only">
          <div
            className="hs-form-frame"
            data-region="eu1"
            data-form-id="7d2d6246-71fc-4650-a9e8-547523cec5c7"
            data-portal-id="26525145"
          />
        </div>

        {/* МОБІЛЬНИЙ: тільки кнопка, яка відкриває попап */}
        <button
          className="subscribe-mobile-btn subscribe-mobile-only"
          onClick={handleMobileSubscribeClick}
        >
          Підписатись на розсилку →
        </button>
      </section>

      {/* МОДАЛКА З ФОРМОЮ ДЛЯ МОБІЛЬНОГО */}
      {isMobileModalOpen ? (
        <div
          className="subscribe-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setIsMobileModalOpen(false); }}
        >
          <div className="subscribe-modal">
            <button
              className="subscribe-modal-close"
              onClick={() => setIsMobileModalOpen(false)}
              aria-label="Закрити"
            >
              ✕
            </button>
            <div className="subscribe-modal-header">
              <div className="subscribe-modal-icon">📬</div>
              <h2 className="subscribe-modal-title">Щомісячний дайджест</h2>
              <p className="subscribe-modal-description">
                Раз на місяць — добірка 5-7 найцікавіших можливостей для дітей.
              </p>
            </div>
            <div className="subscribe-modal-form">
              <div
                className="hs-form-frame"
                data-region="eu1"
                data-form-id="7d2d6246-71fc-4650-a9e8-547523cec5c7"
                data-portal-id="26525145"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
