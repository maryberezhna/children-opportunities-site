import Link from 'next/link';

export const metadata = {
  title: 'Контакти',
  description: 'Як зв\'язатися з командою dityam.com.ua: email, Instagram, запропонувати нову програму, повідомити про помилку.',
  alternates: { canonical: 'https://dityam.com.ua/contacts' },
};

export default function ContactsPage() {
  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>
      <article className="legal-page">
        <h1>Контакти</h1>

        <p className="lead">
          Будемо раді зворотному зв'язку, новим програмам, виправленням помилок
          або просто привітанням.
        </p>

        <div className="contact-grid">
          <a href="mailto:maryberezhna@gmail.com" className="contact-card">
            <span className="contact-icon">✉️</span>
            <div>
              <div className="contact-title">Написати нам</div>
              <div className="contact-sub">maryberezhna@gmail.com</div>
            </div>
          </a>

          <a
            href="mailto:maryberezhna@gmail.com?subject=Запропонувати%20можливість%20на%20dityam.com.ua"
            className="contact-card"
          >
            <span className="contact-icon">➕</span>
            <div>
              <div className="contact-title">Запропонувати можливість</div>
              <div className="contact-sub">Знаєте програму, якої тут немає? Розкажіть.</div>
            </div>
          </a>

          <a
            href="mailto:maryberezhna@gmail.com?subject=Зауваження%20до%20dityam.com.ua"
            className="contact-card"
          >
            <span className="contact-icon">🐛</span>
            <div>
              <div className="contact-title">Повідомити про помилку</div>
              <div className="contact-sub">Прострочена програма, неправильний опис, баг.</div>
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
      </article>
    </div>
  );
}
