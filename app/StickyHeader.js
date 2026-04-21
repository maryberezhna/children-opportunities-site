'use client';
import { useState, useEffect } from 'react';
import { OPEN_SUBSCRIBE_EVENT } from './SubscribePopup';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const INSTAGRAM_URL = 'https://www.instagram.com/dityam.com.ua';
const MAIL_URL = 'mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua';

// Після якого скролу показувати панель
const SCROLL_THRESHOLD = 400;

export default function StickyHeader() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsVisible(window.scrollY > SCROLL_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openSubscribe = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEN_SUBSCRIBE_EVENT, {
        detail: { source: 'sticky_header' }
      }));
    }
  };

  const track = (label) => () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', `${label}_click`, { event_label: 'sticky_header' });
    }
  };

  return (
    <div className={`sticky-header ${isVisible ? 'sticky-header-visible' : ''}`}>
      <div className="sticky-header-inner">
        <div className="sticky-header-brand">
          <span className="sticky-header-logo">🧡</span>
          <span className="sticky-header-name">dityam.com.ua</span>
        </div>

        <div className="sticky-header-actions">
          <a
            href={MAIL_URL}
            className="sticky-header-btn sticky-header-btn-write"
            aria-label="Написати"
            onClick={track('mail')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <span>Написати</span>
          </a>

          <button
            type="button"
            className="sticky-header-btn sticky-header-btn-subscribe"
            onClick={openSubscribe}
            aria-label="Підписатись"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Підписатись</span>
          </button>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sticky-header-btn sticky-header-btn-insta"
            aria-label="Instagram"
            onClick={track('instagram')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            className="sticky-header-btn sticky-header-btn-donate"
            aria-label="Підтримати"
            onClick={track('monobank')}
          >
            <span className="sticky-header-heart">🧡</span>
            <span>Підтримати</span>
          </a>
        </div>
      </div>
    </div>
  );
}
