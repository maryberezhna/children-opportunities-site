import Link from 'next/link';
import '@/app/styles/own.css';
import Footer from '../Footer';
import { ownOpportunities, OWN_PATH, OWN_LABEL } from '@/lib/own-opportunities';

// «Наші можливості» (Марія, 13.10.2026): сторінка, де лише власні продукти
// Dityam.com.ua — олімпіади й Dityam+. На неї веде помаранчева кнопка в
// шапці (замість кнопки Dityam+). Список — lib/own-opportunities.js, той
// самий, що в меню. Перше речення — слова Марії з поста про олімпіаду
// («ми не тільки збираємо, а й створюємо»).
const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}${OWN_PATH}`;
const TITLE = 'Наші можливості — олімпіади й Dityam+ від Dityam.com.ua';
const DESCRIPTION = 'Можливості, які створює сама Dityam.com.ua: онлайн-олімпіада з логіки, олімпіада з моди «Модний код» і Dityam+ — особиста добірка можливостей у Telegram.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website', locale: 'uk_UA', url: URL, siteName: 'Dityam.com.ua',
    title: TITLE, description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function OwnOpportunitiesPage() {
  const items = ownOpportunities();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: OWN_LABEL,
    description: DESCRIPTION,
    url: URL,
    inLanguage: 'uk',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.label,
        url: `${SITE_URL}${it.href}`,
      })),
    },
  };

  return (
    <div className="v2-page own-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="v2-container own-page">
        <section className="own-hero">
          <h1>
            Наші <span className="v2-script">можливості</span>
          </h1>
          <p className="own-sub">
            Ми не тільки збираємо можливості для дітей, а й створюємо свої.
          </p>
        </section>

        <ul className="own-list">
          {items.map((it) => (
            <li key={it.href} className="own-card">
              {/* Картинка — прев'ю самої сторінки (opengraph-image), той самий
                  вигляд, що в соцмережах. Марія, 13.10.2026: «має бути картинками». */}
              <img
                className="own-card-img"
                src={`${it.href}/opengraph-image`}
                alt=""
                width={1200}
                height={630}
                loading="lazy"
                decoding="async"
              />
              <div className="own-card-body">
                <div className="own-card-meta">{it.note}</div>
                <h2>{it.label}</h2>
                <p>{it.text}</p>
                <Link href={it.href} prefetch={false} className="own-card-btn">
                  {it.cta}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
