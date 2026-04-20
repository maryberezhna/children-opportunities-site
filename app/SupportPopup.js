'use client';
import { useState, useEffect } from 'react';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

export default function SupportPopup() {
  const [isOpen, setIsOpen] = useState(false);

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
    const handleEsc = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleSupportClick = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'support_click', {
        event_category: 'engagement',
        event_label: 'monobank',
      });
    }
    setIsOpen(true);
  };

  return (
    <>
      <section className="support-section" aria-label="Підтримати проект">
        <div className="support-bg-blob support-bg-blob-1"></div>
        <div className="support-bg-blob support-bg-blob-2"></div>

        <div className="support-content">
          <div className="support-icon-wrap">
            <span className="support-big-heart">❤️</span>
            <span className="support-sparkle support-sparkle-1">✨</span>
            <span className="support-sparkle support-sparkle-2">✨</span>
            <span className="support-sparkle support-sparkle-3">✨</span>
          </div>

          <div className="support-text">
            <h2 className="support-title">Допоможіть нам робити це безкоштовним</h2>
            <p className="support-description">
              Ми щодня додаємо нові можливості для дітей. Сайт створений на ентузіазмі та не має реклами.
              Ваша підтримка допомагає зростати і знаходити більше програм для українських родин.
            </p>
          </div>

          <button
            className="support-cta-btn"
            onClick={handleSupportClick}
          >
            <span>Підтримати через monobank</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M17 7H8M17 7V16" />
            </svg>
          </button>
        </div>
      </section>

      <button
        className="support-btn-mini"
        onClick={handleSupportClick}
        aria-label="Підтримати проект"
        title="Підтримати проект"
      >
        <span className="heart">❤️</span>
      </button>

      {isOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="support-title">
            <button
              className="modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Закрити"
            >
              ✕
            </button>

            <div className="modal-icon">❤️</div>

            <h2 id="support-title">Дякую, що тут</h2>

            <p>
              Ми робимо цей каталог безкоштовно, щоб кожна українська родина знайшла
              можливості для своєї дитини. Ваша підтримка допомагає додавати нові програми,
              покращувати сайт і залишатись незалежними.
            </p>

            
              href={MONOBANK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'monobank_click', {
                    event_category: 'engagement',
                  });
                }
              }}
            >
              <span>🏦</span>
              <span>Підтримати через monobank</span>
            </a>

            <p className="modal-footer">
              Посилання відкриється на сайті send.monobank.ua
            </p>
          </div>
        </div>
      )}
    </>
  );
}
