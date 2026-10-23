import Link from 'next/link';
import PayPalButton from './PayPalButton';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const MONOBANK_WIDGET_URL = 'https://base.monobank.ua/5QKZeVxPVjZEx7';

export const metadata = {
  title: 'Підтримати проєкт — Dityam.com.ua',
  description:
    'Підтримайте безкоштовну платформу можливостей для українських дітей 0–18 років. Донат через PayPal або monobank — допомагає додавати нові програми та розвивати сайт.',
  alternates: {
    canonical: 'https://dityam.com.ua/support',
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: { uk: 'https://dityam.com.ua/support', en: 'https://dityam.com.ua/en/support' },
  },
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
        <h1>Підтримати Dityam.com.ua</h1>

        {/* До 23.10.2026 українська сторінка була написана англійською, а саме
            сюди ведуть «🧡 Підтримати платформу» з дописів у каналі. */}
        <p className="lead">
          Dityam.com.ua — безкоштовна платформа перевірених можливостей для
          дітей 0–18 років в Україні та за кордоном: курси, олімпіади, стипендії,
          табори, медична допомога й державні виплати. Усе в одному місці.
        </p>

        <p>
          Ваша підтримка допомагає нам:
        </p>
        <ul>
          <li>перевіряти й додавати нові програми;</li>
          <li>тримати платформу актуальною й безкоштовною для кожної родини;</li>
          <li>розвивати платформу й робити її зручнішою.</li>
        </ul>

        <p>
          Кожен внесок — це більше можливостей, які доходять до дітей, яким вони
          потрібні. Дякуємо! 💛💙
        </p>

        <h2>PayPal</h2>
        <p>
          Для тих, хто за кордоном, — будь-яка сума через PayPal, дебетову чи
          кредитну картку.
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
          Доступ до можливостей безкоштовний для кожної родини.
        </p>
      </article>
    </div>
  );
}
