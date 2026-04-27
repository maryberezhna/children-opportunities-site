'use client';
import { useState, useEffect } from 'react';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

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

  const trackMonobankWidget = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_widget_click');
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
              Привіт, я Маша. Вірю, що кожна дитина в Україні має знати про свої можливості — від безкоштовного гуртка у своєму місті до стипендії за кордон. Якщо маєте змогу підтримати — це допоможе проекту розвиватися і додавати більше можливостей для дітей🧡
            </p>
          </div>
          <div className="support-cta-group">
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" className="support-cta-btn support-cta-btn-dark" onClick={trackMonobank}>
              🏦 Банка
            </a>
            <a href={MONOBANK_WIDGET_URL} target="_blank" rel="noopener noreferrer" className="support-cta-btn" onClick={trackMonobankWidget}>
              💳 Підписка на Base
            </a>
          </div>
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
              🏦 Банка
            </a>
            <a href={MONOBANK_WIDGET_URL} target="_blank" rel="noopener noreferrer" className="mono-btn mono-btn-secondary" onClick={trackMonobankWidget}>
              💳 Підписка на Base
            </a>
            <p className="modal-footer">Посилання відкриваються на сайті monobank.ua</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
