'use client';
import { OPEN_SUBSCRIBE_EVENT } from './SubscribePopup';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const INSTAGRAM_URL = 'https://www.instagram.com/dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';
const MAIL_URL = 'mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua';

export default function StickyBar() {
  const openSubscribe = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEN_SUBSCRIBE_EVENT, {
        detail: { source: 'sticky_bar_mobile' }
      }));
      if (window.gtag) {
        window.gtag('event', 'subscribe_modal_open', {
          event_category: 'engagement',
          event_label: 'sticky_bar_mobile',
        });
      }
    }
  };

  const trackInstagram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'instagram_click', { event_label: 'sticky_bar' });
    }
  };

  const trackTelegram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_click', { event_label: 'sticky_bar' });
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
    <div className="sticky-bar">
      {/* МОБІЛЬНИЙ: "Підписатись" замість "Написати" */}
      <button
        className="sticky-btn sticky-btn-subscribe sticky-mobile-only"
        onClick={openSubscribe}
        aria-label="Підписатися на розсилку"
        type="button"
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
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sticky-btn sticky-btn-tg"
        aria-label="Telegram-канал"
        onClick={trackTelegram}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
        </svg>
        <span>Telegram</span>
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
  );
}
