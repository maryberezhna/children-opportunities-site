import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS, CARD_FIELDS_EN } from '@/lib/supabase';
import { TOPIC_LIST, topicPath, collectionsPath } from '@/lib/topics';
import { opportunitiesWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import Footer from './Footer';

/**
 * Сторінка «Підбірки» (/pidbirky, /en/collections).
 *
 * Середня ланка хлібних крихт «Головна / Підбірки / Назва підбірки». До
 * 15.09.2026 «Підбірки» були лише випадним списком у шапці, тож крихтам на
 * підбірці не було куди вести, і ланку пропускали (зауваження Марії).
 *
 * Числа рахуються тими самими живими записами й тим самим предикатом, що й на
 * самій підбірці (app/TopicPage.js), тож збігаються з лічильником там. Запит
 * до бази той самий, і fetchAllRows віддає його з кешу.
 *
 * SEO/GEO: власні title/description/OG, JSON-LD (CollectionPage + ItemList +
 * BreadcrumbList), рядок у sitemap і в llms.txt.
 */

const SITE_URL = 'https://dityam.com.ua';

const COPY = {
  uk: {
    home: 'Головна',
    crumb: 'Підбірки',
    title: 'Підбірки можливостей для дітей — табори, конкурси, обміни, гуртки',
    description:
      'Усі тематичні підбірки Dityam.com.ua: безкоштовні гуртки й табори, конкурси, олімпіади, програми обміну, можливості за кордоном і для дітей захисників. Оновлюється щодня.',
    heading: { lead: 'Підбірки', script: 'можливостей', tail: ' для дітей' },
    intro:
      'Кожна підбірка збирає в одному місці все, що зараз відкрито за темою. Число на картці — скільки можливостей у підбірці сьогодні.',
    count: (n) => `${n} ${opportunitiesWord(n)}`,
    homeLink: 'Усі можливості — на головній →',
    listName: 'Тематичні підбірки Dityam.com.ua',
    breadcrumbs: 'Навігація',
    locale: 'uk_UA',
  },
  en: {
    home: 'Home',
    crumb: 'Collections',
    title: 'Collections of opportunities for children — camps, contests, exchanges, clubs',
    description:
      'Every Dityam.com.ua collection: free clubs and camps, contests, olympiads, exchange programmes, opportunities abroad and for children of defenders. Updated daily.',
    heading: { lead: 'Collections', script: 'of opportunities', tail: ' for children' },
    intro:
      'Each collection gathers everything open on one topic right now. The number on a card is how many opportunities the collection has today.',
    count: (n) => `${n} ${n === 1 ? 'opportunity' : 'opportunities'}`,
    homeLink: 'All opportunities on the home page →',
    listName: 'Dityam.com.ua collections',
    breadcrumbs: 'Breadcrumbs',
    locale: 'en_GB',
  },
};

export function collectionsMetadata(lang = 'uk') {
  const t = COPY[lang] || COPY.uk;
  const url = `${SITE_URL}${collectionsPath(lang)}`;
  const image = { url: '/og-image.png', width: 1200, height: 630, alt: t.title };
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: {
      canonical: url,
      languages: {
        uk: `${SITE_URL}${collectionsPath('uk')}`,
        en: `${SITE_URL}${collectionsPath('en')}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: t.locale,
      url,
      siteName: 'Dityam.com.ua',
      title: t.title,
      description: t.description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.title,
      description: t.description,
      images: [image.url],
    },
  };
}

async function getRows(lang) {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(lang === 'en' ? CARD_FIELDS_EN : CARD_FIELDS)
      .order('created_at', { ascending: false }).order('id')), `collections ${lang}`);
}

export default async function CollectionsHub({ lang = 'uk' }) {
  const t = COPY[lang] || COPY.uk;
  const isEn = lang === 'en';
  const todayIso = kyivToday();

  const rows = await getRows(lang);
  const liveRows = rows.filter((o) => isLive(o, todayIso));
  const cards = TOPIC_LIST.map((topic) => ({
    href: topicPath({ slug: topic.slug, slugEn: topic.en.slug }, lang),
    name: isEn ? topic.navEn : topic.nav,
    count: liveRows.filter(topic.match).length,
  }));

  const homePath = isEn ? '/en' : '/';
  const base = isEn ? `${SITE_URL}/en` : SITE_URL;
  const url = `${SITE_URL}${collectionsPath(lang)}`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: t.title,
        description: t.description,
        inLanguage: isEn ? 'en' : 'uk',
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: { '@id': `${url}#list` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        name: t.listName,
        numberOfItems: cards.length,
        itemListElement: cards.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          url: `${SITE_URL}${c.href}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: base },
          { '@type': 'ListItem', position: 2, name: t.crumb, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <main className="tp-main" lang={isEn ? 'en' : undefined}>
        <nav className="tp-crumbs" aria-label={t.breadcrumbs}>
          <Link href={homePath}>{t.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{t.crumb}</span>
        </nav>

        <header className="tp-hub-head">
          <h1 className="tp-h1">
            {t.heading.lead} <span className="tp-script">{t.heading.script}</span>{t.heading.tail}
          </h1>
          <p className="tp-intro">{t.intro}</p>
        </header>

        <div className="tp-related-grid tp-hub-grid">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="tp-related-card">
              <span className="tp-related-title">{c.name}</span>
              <span className="tp-related-n">{t.count(c.count)}</span>
            </Link>
          ))}
        </div>

        <p className="tp-home-link"><Link href={homePath}>{t.homeLink}</Link></p>
      </main>

      <Footer lang={lang} />
    </>
  );
}
