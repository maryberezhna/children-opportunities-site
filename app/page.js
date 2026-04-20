import { supabase } from '@/lib/supabase';
import OpportunitiesList from './OpportunitiesList';
import SupportPopup from './SupportPopup';

export const revalidate = 300;

async function getOpportunities() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return [];
  }
  return data || [];
}

export default async function Home() {
  const opportunities = await getOpportunities();
  const total = opportunities.length;
  const freeCount = opportunities.filter(o => o.cost_type === 'free').length;
  const sourceCount = new Set(opportunities.map(o => o.source)).size;

  return (
    <div className="container">
      <div className="hero">
        <div className="hero-badge">Безкоштовно і оновлюється щодня</div>
        <h1>
          Усі можливості <span className="accent">для вашої дитини</span> в одному місці
        </h1>
        <p>
          Курси, олімпіади, стипендії, табори, медична допомога та виплати для дітей 0-18 років в Україні.
          Всі перевірені програми зібрані в один каталог.
        </p>
        <div className="stats">
          <div className="stat">
            <span className="stat-num">{total}</span>
            <span className="stat-label">можливостей</span>
          </div>
          <div className="stat">
            <span className="stat-num">{freeCount}</span>
            <span className="stat-label">безкоштовних</span>
          </div>
          <div className="stat">
            <span className="stat-num">{sourceCount}</span>
            <span className="stat-label">джерел</span>
          </div>
          <div className="stat">
            <span className="stat-num">0-18</span>
            <span className="stat-label">років</span>
          </div>
        </div>
      </div>

      <SupportPopup />
      <OpportunitiesList opportunities={opportunities} />

      {/* ============ ФУТЕР ============ */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-section footer-section-brand">
            <div className="footer-brand">
              <span className="footer-logo">🧡</span>
              <div>
                <div className="footer-brand-name">dityam.com.ua</div>
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
          </div>

          <div className="footer-section">
            <div className="footer-title">Підтримати</div>
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
    </div>
  );
}
