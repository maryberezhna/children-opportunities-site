import Link from 'next/link';
import PayPalButton from '../../support/PayPalButton';
import Footer from '../../Footer';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

export const metadata = {
  title: 'Support the project — dityam.com.ua',
  description:
    'Support a free platform of opportunities for Ukrainian children aged 0–18. A donation through PayPal or monobank helps add new programmes and keep the site running.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/support',
    languages: {
      uk: 'https://dityam.com.ua/support',
      en: 'https://dityam.com.ua/en/support',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://dityam.com.ua/en/support',
    title: 'Support dityam.com.ua',
    description: 'PayPal, monobank or a Base subscription — pick whichever suits you.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support dityam.com.ua',
    description: 'PayPal, monobank or a Base subscription — pick whichever suits you.',
    images: ['/og-image.png'],
  },
};

export default function SupportPageEn() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>

      <article className="legal-page support-page">
        <h1>Support dityam.com.ua</h1>

        <p className="lead">
          Dityam is a free platform of verified opportunities for Ukrainian
          children aged 0–18: courses, olympiads, scholarships, summer camps,
          medical aid and state payments — in Ukraine and abroad, all in one
          place.
        </p>

        <p>Your support helps us:</p>
        <ul>
          <li>verify and add new programmes</li>
          <li>keep the listings current and free for every family</li>
          <li>develop the platform and make it easier to use</li>
        </ul>

        <p>
          Every contribution means more opportunities reaching the children who
          need them. Thank you! 💛💙
        </p>

        <h2>PayPal</h2>
        <p>
          For donors outside Ukraine — any amount, by PayPal, debit or credit
          card.
        </p>
        <PayPalButton />

        <h2>Monobank (inside Ukraine)</h2>
        <p>For donors in Ukraine — a monobank jar or a Base subscription.</p>
        <div className="support-links">
          <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" className="mono-btn">
            🏦 Monobank jar
          </a>
          <a
            href={MONOBANK_WIDGET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mono-btn mono-btn-secondary"
          >
            💳 Base subscription
          </a>
        </div>

        <p className="modal-footer">
          The site is built and run by one person, with no advertising.
        </p>
      </article>
      <Footer lang="en" />
    </div>
  );
}
