import Link from 'next/link';
import '@/app/styles/own.css';
import Footer from '../Footer';
import OwnTrack from './OwnTrack';
import { ownOpportunities, OWN_PATH, OWN_LABEL } from '@/lib/own-opportunities';
import { OLIMP, OLIMP_OPEN, OLIMP_PUBLIC } from '@/lib/olimpiada';
import { MK } from '@/lib/modnyi-kod';
import { PRICE, PRICE_HALF } from '@/lib/wayforpay';

// «Наші можливості» (Марія, 13.10.2026): сторінка, де лише власні продукти
// Dityam.com.ua — олімпіади й Dityam+. На неї веде помаранчева кнопка в
// шапці (замість кнопки Dityam+). Список — lib/own-opportunities.js, той
// самий, що в меню. Перше речення — слова Марії з поста про олімпіаду
// («ми не тільки збираємо, а й створюємо»).
//
// SEO/GEO (Марія: «і оптимізацію під гео сео»): власні title, description,
// canonical, OG-картинка (opengraph-image.js), JSON-LD — CollectionPage зі
// списком, хлібні крихти й FAQPage. Питання й відповіді видно й на самій
// сторінці: розмітка FAQ без видимого тексту — порушення правил Google, а
// ШІ-асистенти цитують саме такі короткі відповіді. Кожна відповідь — із
// даних у коді (вік, ціни), нічого понад описи самих сторінок.
const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}${OWN_PATH}`;
const TITLE = 'Наші можливості — олімпіади й Dityam+ від Dityam.com.ua';
const DESCRIPTION = 'Можливості, які створює сама Dityam.com.ua: онлайн-олімпіада з логіки, олімпіада з моди «Модний код» і Dityam+, особиста добірка можливостей у Telegram.';

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

const OLIMP_ON = OLIMP_OPEN || OLIMP_PUBLIC;

function faq() {
  const olimpPrice = OLIMP_OPEN ? 'безкоштовно' : 'реєстрація скоро';
  return [
    {
      q: 'Що таке «Наші можливості» Dityam.com.ua?',
      a: `Олімпіади й сервіси, які створює сама Dityam.com.ua, а не інші організатори: ${OLIMP_ON ? 'онлайн-олімпіада з логіки, ' : ''}олімпіада з моди «${MK.title}» і Dityam+, особиста добірка можливостей у Telegram.`,
    },
    // Відповідь — дослівно Марія, 14.10.2026.
    {
      q: 'Навіщо Dityam.com.ua створює свої можливості?',
      a: 'Щоб дати рівні шанси дітям.',
    },
    {
      q: 'Скільки це коштує?',
      a: `${OLIMP_ON ? `Онлайн-олімпіада з логіки: ${olimpPrice}. ` : ''}«${MK.title}»: безкоштовно. Dityam+: ${PRICE} грн на місяць або ${PRICE_HALF} грн за пів року.`,
    },
    {
      q: 'Для якого віку?',
      a: `${OLIMP_ON ? `Олімпіада з логіки — для дітей ${OLIMP.groupLabel}, ` : ''}«${MK.title}» — для дітей ${MK.ageFrom}–${MK.ageTo} років. Dityam+ добирає можливості для кожної дитини за віком, вподобаннями й містом.`,
    },
  ];
}

export default function OwnOpportunitiesPage() {
  const items = ownOpportunities({ plusMonth: PRICE });
  const questions = faq();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${URL}#page`,
        name: OWN_LABEL,
        description: DESCRIPTION,
        url: URL,
        inLanguage: 'uk',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#org` },
        breadcrumb: { '@id': `${URL}#breadcrumb` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.label,
            description: it.text,
            url: `${SITE_URL}${it.href}`,
            image: `${SITE_URL}${it.href}/opengraph-image`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Dityam.com.ua', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: OWN_LABEL, item: URL },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${URL}#faq`,
        mainEntity: questions.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };

  return (
    <div className="v2-page own-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <OwnTrack />
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
            <li key={it.href} className="own-card" data-own={it.key}>
              {/* Картинка — прев'ю самої сторінки (opengraph-image), той самий
                  вигляд, що в соцмережах. Марія, 13.10.2026: «має бути картинками».
                  Посилання з картинки — без фокуса й для читалок прихований:
                  той самий перехід уже є в назві й кнопці. */}
              <Link href={it.href} prefetch={false} className="own-card-imglink" tabIndex={-1} aria-hidden="true">
                <img
                  className="own-card-img"
                  src={`${it.href}/opengraph-image`}
                  alt=""
                  width={1200}
                  height={630}
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <div className="own-card-body">
                <div className="own-card-meta">{it.note}</div>
                <h2>
                  <Link href={it.href} prefetch={false} className="own-card-title">{it.label}</Link>
                </h2>
                <p>{it.text}</p>
                <Link href={it.href} prefetch={false} className="own-card-btn">
                  {it.cta}
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <section className="own-faq" aria-labelledby="own-faq">
          <h2 id="own-faq">Питання й відповіді</h2>
          <dl>
            {questions.map(({ q, a }) => (
              <div key={q} className="own-faq-item">
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </div>
  );
}
