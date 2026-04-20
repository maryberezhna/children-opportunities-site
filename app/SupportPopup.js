'use client';
import { useState, useEffect } from 'react';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

export default function SupportPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const trackSupport = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'support_click');
    }
    setIsOpen(true);
  };

  const trackMonobank = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_click');
    }
  };

  return (
    <>
      <section className="support-section">
        <div className="support-bg-blob support-bg-blob-1" />
        <div className="support-bg-blob support-bg-blob-2" />
        <div className="support-content">
          <div className="support-icon-wrap">
            <span className="support-big-heart">❤️</span>
            <span className="support-sparkle support-sparkle-1">✨</span>
            <span className="support-sparkle support-sparkle-2">✨</span>
            <span className="support-sparkle support-sparkle-3">✨</span>
          </div>
          <div className="support-text">
            <h2 className="support-title">Допоможіть розвитку проєкту</h2>
            <p className="support-description">
              Привіт! Я- Маша, створила цей сайт, щоб зібрати всі можливості для дітей в одному місці. Роблю це на ентузіазмі, без реклами. Якщо сайт корисний — підтримайте, щоб я могла додавати більше програм 🧡
            </p>
          </div>
          <button className="support-cta-btn" onClick={trackSupport}>
            Підтримати через monobank
          </button>
        </div>
      </section>

      <button className="support-btn-mini" onClick={trackSupport} aria-label="Підтримати проект">
        <span className="heart">❤️</span>
      </button>

      {isOpen ? (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setIsOpen(false)}>✕</button>
            <div className="modal-icon">❤️</div>
            <h2 id="support-title">Дякую, що тут</h2>
            <p>
              Я роблю цей каталог сама, щоб кожна українська родина знайшла можливості для своєї дитини. Ваша підтримка допомагає додавати нові програми, покращувати сайт і залишатись незалежними — без реклами та монетизації.
            </p>
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" className="mono-btn" onClick={trackMonobank}>
              🏦 Підтримати через monobank
            </a>
            <p className="modal-footer">Посилання відкриється на сайті send.monobank.ua</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
