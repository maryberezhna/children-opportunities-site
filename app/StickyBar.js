'use client';
import { useState, useEffect, useRef } from 'react';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const INSTAGRAM_URL = 'https://www.instagram.com/dityam.com.ua';
const MAIL_URL = 'mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua';

export default function StickyBar() {
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const scriptLoaded = useRef(false);

  // Завантажуємо HubSpot форму коли модалка відкривається вперше
  useEffect(() => {
    if (!isSubscribeOpen || scriptLoaded.current) return;
    scriptLoaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://js-eu1.hsforms.net/forms/embed/26525145.js';
    script.defer = true;
    document.body.appendChild(script);
  }, [isSubscribeOpen]);

  // Блокуємо scroll коли модалка відкрита
  useEffect(() => {
    if (isSubscribeOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isSubscribeOpen]);

  // Закриття по Escape
  useEffect(() => {
    if (!isSubscribeOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setIsSubscribeOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isSubscribeOpen]);

  const openSubscribe = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_modal_open', {
        event_category: 'engagement',
        event_label: 'sticky_bar_mobile',
      });
    }
    setIsSubscribeOpen(true);
  };

  const trackInstagram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'instagram_click', { event_label: 'sticky_bar' });
    }
  };

  const trackDonate = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_click', { event_label: 'sticky_bar' });
    }
  };

  const trackMail = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'mail_click', { event_label: 'sticky_bar' });
    }
  };

  return (
    <>
      <div className="sticky-bar">
        {/* МОБІЛЬНИЙ: "Підписатись" замість "Написати" */}
        <button
          className="sticky-btn sticky-btn-subscribe sticky-mobile-only"
          onClick={openSubscribe}
          aria-label="Підписатися на розсилку"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Підписатись</span>
        </button>

        {/* ДЕСКТОП: "Написати" */}
        <a
          href={MAIL_URL}
          className="sticky-btn sticky-desktop-only"
          aria-label="Написати нам"
          onClick={trackMail}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Написати</span>
        </a>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="sticky-btn sticky-btn-insta"
          aria-label="Instagram"
          onClick={trackInstagram}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
          <span>Instagram</span>
        </a>

        <a
          href={MONOBANK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="sticky-btn sticky-btn-donate"
          aria-label="Підтримати"
          onClick={trackDonate}
        >
          <span className="sticky-heart">🧡</span>
          <span>Підтримати</span>
        </a>
      </div>

      {/* МОДАЛКА ПІДПИСКИ (для мобільних) */}
      {isSubscribeOpen ? (
        <div
          className="subscribe-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setIsSubscribeOpen(false); }}
        >
          <div className="subscribe-modal">
            <button
              className="subscribe-modal-close"
              onClick={() => setIsSubscribeOpen(false)}
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
