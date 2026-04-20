'use client';
import { useEffect, useRef } from 'react';

export default function SubscribeSection() {
  const formContainer = useRef(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Завантажуємо HubSpot скрипт лише один раз
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://js-eu1.hsforms.net/forms/embed/26525145.js';
    script.defer = true;
    document.body.appendChild(script);

    // Трекінг у Google Analytics коли секція з'являється
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'subscribe_section_view', {
        event_category: 'engagement',
      });
    }

    return () => {
      // Не видаляємо скрипт — він потрібен для форми
    };
  }, []);

  return (
    <section className="subscribe-section" aria-label="Підписка на розсилку">
      <div className="subscribe-content">
        <div className="subscribe-icon">📬</div>
        <div className="subscribe-text">
          <h2 className="subscribe-title">Щомісячний дайджест можливостей</h2>
          <p className="subscribe-description">
            Раз на місяць — добірка 5-7 найцікавіших програм для дітей. Без спаму, можна відписатись у будь-який момент.
          </p>
        </div>
      </div>

      <div className="subscribe-form-wrap">
        <div
          ref={formContainer}
          className="hs-form-frame"
          data-region="eu1"
          data-form-id="7d2d6246-71fc-4650-a9e8-547523cec5c7"
          data-portal-id="26525145"
        />
      </div>
    </section>
  );
}
