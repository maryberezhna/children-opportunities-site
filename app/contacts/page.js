import Link from 'next/link';
import ContactForm from './ContactForm';

export const metadata = {
  title: 'Написати нам — контакти Dityam',
  description: 'Контактна форма dityam.com.ua: запропонувати можливість, повідомити про помилку чи прострочену програму, поскаржитись, запропонувати співпрацю або запит від медіа.',
  alternates: { canonical: 'https://dityam.com.ua/contacts' },
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

        <h2>Реквізити</h2>
        <p>Продавець послуги «Dityam+»:</p>
        <ul>
          <li>ФОП Шутяк Марія Олександрівна</li>
          <li>ІПН (РНОКПП): 3530900201</li>
          <li>Адреса: 02130, Україна, м. Київ, вул. Воскресенська, 16Б, кв. 20</li>
          <li>Телефон: <a href="tel:+380634763998">+380 63 476 3998</a></li>
          <li>Email: <a href="mailto:mashaberezhna0209@gmail.com">mashaberezhna0209@gmail.com</a></li>
          <li>Сайт: dityam.com.ua</li>
        </ul>
        <p style={{ fontSize: 14, color: '#54617a' }}>
          Умови надання послуги — <Link href="/terms">Публічна оферта</Link> ·
          Повернення коштів — <Link href="/refund">тут</Link>.
        </p>
      </article>
    </div>
  );
}
