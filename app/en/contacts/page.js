import Link from 'next/link';
import ContactForm from '../../contacts/ContactForm';
import Footer from '../../Footer';

export const metadata = {
  title: 'Contact us — Dityam',
  description:
    'Contact form for dityam.com.ua: suggest an opportunity, report a mistake or an expired programme, raise a complaint, propose a partnership, or make a media request.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/contacts',
    languages: {
      uk: 'https://dityam.com.ua/contacts',
      en: 'https://dityam.com.ua/en/contacts',
    },
  },
};

export default function ContactsPageEn() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>
      <article className="legal-page">
        <h1>Contact us</h1>

        <p className="lead">
          We’re glad to hear feedback, new programmes, corrections — or just a
          hello. Pick a topic and write a few words.
        </p>

        <ContactForm lang="en" />

        <h2>Other ways to reach us</h2>
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
              <div className="contact-title">Telegram channel</div>
              <div className="contact-sub">@dityam_com_ua — new opportunities daily, in Ukrainian</div>
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
              <div className="contact-sub">@dityam.com.ua — daily updates</div>
            </div>
          </a>
        </div>

        <h2>Support the project</h2>
        <p>
          If you’d like the platform to live and grow — donate via{' '}
          <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer">monobank</a>,{' '}
          <a href="https://base.monobank.ua/5QKZeVxPVjZEx7" target="_blank" rel="noopener noreferrer">Base subscription</a>,{' '}
          or <Link href="/en/support">PayPal</Link>.
        </p>

        <p className="contact-fine">
          Terms of service — <Link href="/en/terms">public offer</Link> ·
          Refunds — <Link href="/en/refund">here</Link>.
        </p>
      </article>
      <Footer lang="en" />
    </div>
  );
}
