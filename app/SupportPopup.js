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

  return (
    <>
      <button
        className="support-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Підтримати проект"
      >
        <span className="heart">❤️</span>
        <span>Підтримати проект</span>
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

            <a
              href={MONOBANK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && window.plausible) {
                  window.plausible('Support Click');
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
