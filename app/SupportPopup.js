'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { opportunitiesWord, plural } from '@/lib/plural';

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
      {/* Ліворуч — обіцянка, праворуч — сам продукт. Попередній варіант описував
          цінність словами й ставив поруч велике серце: це читалось як прохання
          про пожертву, а не як платна послуга. Тепер видно, ЩО саме прийде. */}
      <section className="plus-section">
        <div className="plus-glow" aria-hidden="true" />
        <div className={`plus-inner${sample.length ? '' : ' plus-inner-solo'}`}>
          <div className="plus-copy">
            <span className="plus-badge">Dityam+</span>
            <h2 className="plus-title">Ми знайдемо — ви подастесь</h2>
            <p className="plus-lead">
              {total
                ? <>У каталозі {total} {opportunitiesWord(total)}. Вашій дитині підходять одиниці — і в кожної свій дедлайн.</>
                : <>Можливостей сотні. Вашій дитині підходять одиниці — і в кожної свій дедлайн.</>}
              {' '}Раз на 2 тижні надсилаємо тільки ваші.
            </p>

            <ul className="plus-points">
              <li><b>Під вік та інтереси</b> — без гортання сотень карток</li>
              <li><b>Без дитячих даних</b> — лише вік-діапазон і теми</li>
            </ul>

            <div className="plus-buy">
              <Link href="/pidbirka" className="plus-cta" onClick={trackPlus}>
                Спробувати Dityam+
              </Link>
              <span className="plus-price">
                <b>{price}</b> грн<span>/міс</span>
              </span>
            </div>
            <p className="plus-fine">
              Базовий каталог безкоштовний назавжди · скасувати одним повідомленням
            </p>
          </div>

          {/* Реальні можливості з каталогу, не вигадані: інакше це був би
              муляж, який обіцяє те, чого в базі немає. */}
          {sample.length > 0 && (
          <div className="plus-preview">
            <div className="plus-preview-bar">
              <span className="plus-preview-avatar" aria-hidden="true">🧡</span>
              <span className="plus-preview-name">Dityam+</span>
              <span className="plus-preview-meta">приклад підбірки</span>
            </div>
            <div className="plus-preview-body">
              <p className="plus-preview-hello">
                Знайшли <b>{sample.length}</b>{' '}
                {plural(sample.length, 'нову можливість', 'нові можливості', 'нових можливостей')}{' '}
                під вашу дитину 👇
              </p>
              {sample.map((o) => (
                <div key={o.slug} className="plus-card">
                  <span className="plus-card-title">{o.title}</span>
                  <span className="plus-card-meta">
                    {o.age}
                    {o.cost ? <> · <b>{o.cost}</b></> : null}
                    {o.deadline ? <> · до {o.deadline}</> : null}
                  </span>
                </div>
              ))}
              <p className="plus-preview-foot">Наступна підбірка — за 2 тижні</p>
            </div>
          </div>
          )}
        </div>

        {/* Донати лишаються, але третьорядними — головна дія тепер підписка. */}
        <div className="plus-donate">
          <span>Не потрібна підписка, але хочете підтримати проєкт?</span>
          <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobank}>Банка</a>
          <a href={MONOBANK_WIDGET_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobankWidget}>Base</a>
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
