import Link from 'next/link';
import SubscribeButton from './SubscribeButton';
import { TOPIC_NAV } from '@/lib/topics';
import { countActiveOpportunities } from '@/lib/supabase';

// Живі цифри довіри: ті самі, що на /press — тягнуться з бази, щоб «503»
// ніколи не застаріло в футері. Збій запиту → чесний фолбек «500+».
async function getProof() {
  try {
    return await countActiveOpportunities();
  } catch {
    return null;
  }
}

export default async function Footer() {
  const activeCount = await getProof();

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

        <Link
          href="/pidbirka"
          className="footer-action-btn footer-action-donate"
          aria-label="Dityam+ early list"
        >
          <span className="footer-action-heart">🚀</span>
          <span>Dityam+ early list</span>
        </Link>
      </div>

      <div className="footer-content">
        <div className="footer-section footer-section-brand">
          <div className="footer-brand">
            <span className="footer-logo">🧡</span>
            <div>
              <div className="footer-brand-name">
                <span>dityam.com.ua</span>
              </div>
              <div className="footer-brand-tag">Можливості для кожної дитини</div>
            </div>
          </div>
          <p className="footer-about">
            Всі можливості для українських дітей 0–18 років — в одному місці.
            Безкоштовно, без реклами.
          </p>
          <div className="footer-proof">
            <span><b>{activeCount ?? '500+'}</b> перевірених можливостей</span>
            <span><b>200+</b> джерел · оновлюється щодня</span>
            <span>лінки перевіряються щоночі ✓</span>
          </div>
        </div>

        <div className="footer-section">
          <div className="footer-title">Каталог</div>
          <Link href="/" className="footer-link"><span>Всі можливості</span></Link>
          <Link href="/kategorii" className="footer-link"><span>Всі категорії</span></Link>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="footer-link">
              <span>{t.label}</span>
            </Link>
          ))}
        </div>

        <div className="footer-section">
          <div className="footer-title">Батькам</div>
          <Link href="/pidbirka" className="footer-link"><span>Dityam+ — персональна добірка</span></Link>
          <a
            href="https://t.me/dityam_com_ua"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>Telegram-канал</span>
          </a>
          <a
            href="mailto:maryberezhna@gmail.com?subject=Додати%20можливість%20на%20dityam.com.ua"
            className="footer-link"
          >
            <span>Запропонувати можливість</span>
          </a>
          <Link href="/yak-my-pereviriaiemo" className="footer-link">
            <span>Як ми перевіряємо дані</span>
          </Link>
        </div>

        <div className="footer-section">
          <div className="footer-title">Проєкт</div>
          <Link href="/about" className="footer-link"><span>Про нас</span></Link>
          <Link href="/press" className="footer-link"><span>Для преси</span></Link>
          <Link href="/support" className="footer-link"><span>Підтримати проєкт</span></Link>
          <a
            href="https://send.monobank.ua/jar/F72fDrV2c"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>Донат на monobank</span>
          </a>
          <Link href="/contacts" className="footer-link"><span>Написати нам · контакти</span></Link>
          <Link href="/privacy" className="footer-link"><span>Конфіденційність</span></Link>
          <Link href="/terms" className="footer-link"><span>Оферта · Повернення</span></Link>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copy">
          © 2026 dityam.com.ua · Зроблено з любов&apos;ю в Україні 🇺🇦
        </div>
        <div className="footer-social">
          <a href="https://t.me/dityam_com_ua" target="_blank" rel="noopener noreferrer" className="footer-social-link">Telegram</a>
          <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer" className="footer-social-link">Instagram</a>
        </div>
      </div>
    </footer>
  );
}
