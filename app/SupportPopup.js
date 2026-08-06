'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

export default function SupportPopup({ total, price }) {
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

  const trackPlus = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'plus_cta_click', {
        event_category: 'engagement',
        event_label: 'home_support_section',
      });
    }
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
          <div className="support-text">
            <span className="support-badge">Dityam+</span>
            <h2 className="support-title">Ваша дитина не пропустить свій шанс</h2>
            <p className="support-description">
              {total ? `У каталозі вже ${total} можливостей` : 'У каталозі сотні можливостей'} — але саме вашій дитині підходять одиниці,
              і в кожної свій дедлайн. Замість того щоб перевіряти сайт щотижня, отримуйте
              готову добірку: ми стежимо за новими програмами замість вас.
            </p>
            <ul className="support-benefits">
              <li><span aria-hidden="true">🎯</span> Тільки ваше — за віком та інтересами дитини, без гортання сотень карток</li>
              <li><span aria-hidden="true">⚡</span> Вчасно — нові можливості приходять, поки подача ще відкрита</li>
              <li><span aria-hidden="true">🔒</span> Безпечно — ми не запитуємо дитячих даних, лише вік-діапазон та інтереси</li>
              <li><span aria-hidden="true">✋</span> Без пасток — скасувати можна будь-коли, одним повідомленням</li>
            </ul>
          </div>
          <div className="support-cta-card">
            <div className="support-icon-wrap">
              <span className="support-big-heart">❤️</span>
              <span className="support-sparkle support-sparkle-1">✨</span>
              <span className="support-sparkle support-sparkle-2">✨</span>
              <span className="support-sparkle support-sparkle-3">✨</span>
            </div>
            <div className="support-price">
              <span className="support-price-num">{price}</span>
              <span className="support-price-per">грн / міс</span>
            </div>
            <Link href="/pidbirka" className="support-cta-btn support-cta-btn-dark" onClick={trackPlus}>
              ✨ Спробувати Dityam+
            </Link>
            <span className="support-cta-note">Базовий каталог лишається безкоштовним для всіх🧡</span>
            {/* Донати лишаються, але другорядними — головна дія тепер підписка. */}
            <div className="support-donate-row">
              <span className="support-donate-label">Або просто підтримати проєкт:</span>
              <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" className="support-donate-link" onClick={trackMonobank}>
                🏦 Банка
              </a>
              <a href={MONOBANK_WIDGET_URL} target="_blank" rel="noopener noreferrer" className="support-donate-link" onClick={trackMonobankWidget}>
                💳 Base
              </a>
            </div>
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
