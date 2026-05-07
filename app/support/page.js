import Link from 'next/link';
import PayPalButton from './PayPalButton';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

export const metadata = {
  title: 'Підтримати проєкт — dityam.com.ua',
  description:
    'Підтримайте безкоштовний каталог можливостей для дітей 0–18 років в Україні. Донат через PayPal або monobank — допомагає додавати нові програми та розвивати сайт.',
  alternates: { canonical: 'https://dityam.com.ua/support' },
  openGraph: {
    type: 'website',
    url: 'https://dityam.com.ua/support',
    title: 'Підтримати dityam.com.ua',
    description:
      'PayPal, monobank або Підписка Base — оберіть зручний спосіб допомогти проєкту.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Підтримати dityam.com.ua',
    description:
      'PayPal, monobank або Підписка Base — оберіть зручний спосіб допомогти проєкту.',
    images: ['/og-image.png'],
  },
};

export default function SupportPage() {
  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>

      <article className="legal-page support-page">
        <h1>Support dityam.com.ua</h1>

        <p className="lead">
          Dityam is a free catalog of verified opportunities for children
          aged 0–18 in Ukraine: courses, olympiads, scholarships, summer camps,
          medical aid, and government benefits. Everything in one place.
        </p>

        <p>
          Your support helps us:
        </p>
        <ul>
          <li>verify and add new programs</li>
          <li>keep the catalog up-to-date and free for every family</li>
          <li>develop the platform and make it easier to use</li>
        </ul>

        <p>
          Every contribution means more opportunities reaching the children
          who need them. Thank you! 💛💙
        </p>

        <h2>PayPal</h2>
        <p>
          For donors outside Ukraine — pay any amount with PayPal, debit or
          credit card.
        </p>
        <PayPalButton />

        <h2>Monobank (Україна)</h2>
        <p>Для донорів в Україні — банка monobank або підписка Base.</p>
        <div className="support-links">
          <a
            href={MONOBANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mono-btn"
          >
            🏦 Банка monobank
          </a>
          <a
            href={MONOBANK_WIDGET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mono-btn mono-btn-secondary"
          >
            💳 Підписка Base
          </a>
        </div>

        <p className="modal-footer">
          Сайт створений однією людиною, без реклами і без монетизації.
        </p>
      </article>
    </div>
  );
}
