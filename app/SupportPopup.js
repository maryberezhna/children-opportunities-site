'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { opportunitiesWord } from '@/lib/plural';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

export default function SupportPopup({ total, price, sample = [] }) {
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
      {/* Компактна смуга: заголовок + чипи переваг + CTA, і одна найближча
          можливість як приклад. Попередня версія (шість пунктів + картка на
          три можливості) займала пів екрана й відсувала каталог — а каталог
          і є причиною візиту. */}
      <section className="plus-section">
        <div className="plus-glow" aria-hidden="true" />
        <div className="plus-inner">
          <div className="plus-copy">
            <div className="plus-head">
              <span className="plus-badge">Dityam+</span>
              <h2 className="plus-title">Ми знайдемо — ви подастесь</h2>
            </div>
            <p className="plus-lead">
              {total
                ? <>Серед {total} {opportunitiesWord(total)} вашій дитині підходять одиниці.</>
                : <>Серед сотень можливостей вашій дитині підходять одиниці.</>}
              {' '}Надсилаємо тільки ваші — щойно зʼявляться.
            </p>
            {/* Чипи замість списку: та сама суть, чверть висоти */}
            <div className="plus-chips" aria-label="Переваги підписки">
              <span>під вік та інтереси</span>
              <span>допомога із заявкою</span>
              <span>Telegram або email</span>
              <span>без дитячих даних</span>
            </div>
          </div>

          <div className="plus-side">
            {/* Одна найближча можливість — доказ замість опису */}
            {sample.length > 0 && (
              <div className="plus-card">
                <span className="plus-card-eyebrow">приклад із підбірки</span>
                <span className="plus-card-title">{sample[0].title}</span>
                <span className="plus-card-meta">
                  {sample[0].age}
                  {sample[0].cost ? <> · <b>{sample[0].cost}</b></> : null}
                  {sample[0].deadline ? <> · до {sample[0].deadline}</> : null}
                </span>
              </div>
            )}
            <div className="plus-buy">
              <Link href="/pidbirka" className="plus-cta" onClick={trackPlus}>
                Спробувати Dityam+
              </Link>
              <span className="plus-price">
                <b>{price}</b> грн<span>/міс</span>
              </span>
            </div>
            <p className="plus-fine">
              Каталог безкоштовний назавжди · скасувати одним повідомленням ·{' '}
              <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobank}>підтримати проєкт</a>
            </p>
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
