import SubscribeButton from './SubscribeButton';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-actions">
        <a
          href="mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua"
          className="footer-action-btn footer-action-write"
          aria-label="Написати нам"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Написати</span>
        </a>

        <SubscribeButton
          className="footer-action-btn footer-action-subscribe"
          ariaLabel="Підписатись на розсилку"
          source="footer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Підписатись</span>
        </SubscribeButton>

        <a
          href="https://www.instagram.com/dityam.com.ua"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-action-btn footer-action-insta"
          aria-label="Instagram"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
          <span>Instagram</span>
        </a>

        <a
          href="https://send.monobank.ua/jar/F72fDrV2c"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-action-btn footer-action-donate"
          aria-label="Підтримати"
        >
          <span className="footer-action-heart">🧡</span>
          <span>Підтримати</span>
        </a>
      </div>

      <div className="footer-content">
        <div className="footer-section footer-section-brand">
          <div className="footer-brand">
            <span className="footer-logo">🧡</span>
            <div>
              <div className="footer-brand-name">
                <span>dityam.com.ua</span>
                <span className="footer-beta">BETA</span>
              </div>
              <div className="footer-brand-tag">Можливості для кожної дитини</div>
            </div>
          </div>
          <p className="footer-about">
            Каталог безкоштовних та доступних програм для дітей 0-18 років в Україні.
            Сайт створений на ентузіазмі, без реклами.
          </p>
          <div className="footer-social">
            <a
              href="https://www.instagram.com/dityam.com.ua"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="Instagram"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
              <span>Instagram</span>
            </a>
          </div>
        </div>

        <div className="footer-section">
          <div className="footer-title">Контакти</div>
          <a
            href="mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua"
            className="footer-link"
          >
            <span className="footer-link-icon">✉</span>
            <span>Написати нам</span>
          </a>
          <a
            href="mailto:maryberezhna@gmail.com?subject=Додати%20можливість%20на%20dityam.com.ua"
            className="footer-link"
          >
            <span className="footer-link-icon">➕</span>
            <span>Запропонувати можливість</span>
          </a>
          <a href="/contacts" className="footer-link">
            <span className="footer-link-icon">📍</span>
            <span>Усі контакти</span>
          </a>
        </div>

        <div className="footer-section">
          <div className="footer-title">Сайт</div>
          <a href="/pidbirka" className="footer-link">
            <span className="footer-link-icon">🎯</span>
            <span>Персональна підбірка · Dityam+</span>
          </a>
          <a href="/about" className="footer-link">
            <span className="footer-link-icon">ℹ️</span>
            <span>Про проєкт</span>
          </a>
          <a href="/privacy" className="footer-link">
            <span className="footer-link-icon">🔒</span>
            <span>Політика конфіденційності</span>
          </a>
        </div>

        <div className="footer-section">
          <div className="footer-title">Підтримати</div>
          <a href="/support" className="footer-link">
            <span className="footer-link-icon">🌍</span>
            <span>PayPal & all options</span>
          </a>
          <a
            href="https://send.monobank.ua/jar/F72fDrV2c"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span className="footer-link-icon">🧡</span>
            <span>Донат на monobank</span>
          </a>
          <p className="footer-note">
            Ваша допомога — паливо для проєкту
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copy">
          © 2026 dityam.com.ua · Зроблено з любов&apos;ю в Україні 🇺🇦
        </div>
      </div>
    </footer>
  );
}
