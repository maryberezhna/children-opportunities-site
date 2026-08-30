import Link from 'next/link';
import ContactForm from './ContactForm';

export const metadata = {
  title: 'Написати нам — контакти Dityam',
  description: 'Контактна форма dityam.com.ua: запропонувати можливість, повідомити про помилку чи прострочену програму, поскаржитись, запропонувати співпрацю або запит від медіа.',
  alternates: {
    canonical: 'https://dityam.com.ua/contacts',
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: { uk: 'https://dityam.com.ua/contacts', en: 'https://dityam.com.ua/en/contacts' },
  },
};

export default function ContactsPage() {
  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>
      <article className="legal-page">
        <h1>Написати нам</h1>

        <p className="lead">
          Будемо раді зворотному зв'язку, новим програмам, виправленням помилок
          або просто привітанням. Оберіть тему — і напишіть кілька слів.
        </p>

        <ContactForm />

        <h2>Інші способи звʼязку</h2>
        <div className="contact-grid">
          <a href="mailto:maryberezhna@gmail.com" className="contact-card">
            <span className="contact-icon">✉️</span>
            <div>
              <div className="contact-title">Email</div>
              <div className="contact-sub">maryberezhna@gmail.com</div>
            </div>
          </a>

          <a
            href="https://t.me/dityam_com_ua"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-card"
          >
            <span className="contact-icon">✈️</span>
            <div>
              <div className="contact-title">Telegram-канал</div>
              <div className="contact-sub">@dityam_com_ua — нові можливості щодня</div>
            </div>
          </a>

          <a
            href="https://www.instagram.com/dityam.com.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-card"
          >
            <span className="contact-icon">📷</span>
            <div>
              <div className="contact-title">Instagram</div>
              <div className="contact-sub">@dityam.com.ua — щоденні апдейти</div>
            </div>
          </a>
        </div>

        <h2>Підтримати проєкт</h2>
        <p>
          Якщо хочете, щоб каталог жив і розвивався — донат:{' '}
          <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer">monobank-банка</a>{' '}
          або{' '}
          <a href="https://base.monobank.ua/5QKZeVxPVjZEx7" target="_blank" rel="noopener noreferrer">Підписка Base</a>.
        </p>

        <p style={{ fontSize: 14, color: '#54617a' }}>
          Умови надання послуги — <Link href="/terms">Публічна оферта</Link> ·
          Повернення коштів — <Link href="/refund">тут</Link>.
        </p>
      </article>
    </div>
  );
}
