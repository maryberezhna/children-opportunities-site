import '@/app/styles/routes/topic.css';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS_EN } from '@/lib/supabase';
import { clientRows } from '@/lib/client-rows';
import { CITY_META } from '@/lib/cities';
import { fitTitle } from '@/lib/seo-title';
import OpportunitiesList from '../../OpportunitiesList';
import ShareButton from '../../ShareButton';
import StickyBar from '../../StickyBar';
import SubscribePopup from '../../SubscribePopup';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(CITY_META).map((city) => ({ city }));
}

export async function generateMetadata({ params }) {
  const cityData = CITY_META[params.city];
  if (!cityData) return {};
  const name = cityData.en || cityData.ua;
  const url = `${SITE_URL}/en/${params.city}`;
  return {
    // Назви міст різної довжини: із «Zaporizhzhia» чи «Chernivtsi» повний
    // хвіст виходив за 65 символів і пошук його обрізав. Беремо найдовший
    // варіант, що вміщається (05.10.2026, Site Scan у Bing).
    title: {
      absolute: fitTitle(
        `Opportunities for children in ${name} — courses, olympiads, scholarships`,
        `Opportunities for children in ${name} — courses and scholarships`,
        `Opportunities for children in ${name} — courses and camps`,
        `Opportunities for children in ${name}`,
      ),
    },
    description: `A free catalogue of opportunities for children aged 0–18 in ${name}: courses, olympiads, scholarships, camps, medical help. Updated daily.`,
    alternates: {
      canonical: url,
      languages: { uk: `${SITE_URL}/${params.city}`, en: url },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: 'Dityam',
      title: `Opportunities for children in ${name}`,
      description: `A free catalogue of opportunities for children aged 0–18 in ${name}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `dityam.com.ua — opportunities for children in ${name}` }],
    },
  };
}

// Місто в базі записане українською, тож фільтруємо саме за українською
// назвою — англійська існує лише для того, що бачить людина.
async function getCityOpportunities(cityName) {
  if (!supabase) return [];
  const data = rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(CARD_FIELDS_EN).order('created_at', { ascending: false }).order('id')), `en city ${cityName}`);
  return data.filter((o) => {
    const cities = o.cities || [];
    return cities.includes(cityName) || cities.includes('Вся Україна');
  });
}

export default async function CityPage({ params }) {
  const cityData = CITY_META[params.city];
  if (!cityData) notFound();

  const { ua: cityName } = cityData;
  const name = cityData.en || cityName;
  const opportunities = await getCityOpportunities(cityName);
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Opportunities for children in ${name}`,
    numberOfItems: total,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/en/o/${o.slug}`,
      name: o.title_en || o.title,
    })),
  };

  const otherCities = Object.entries(CITY_META).filter(([slug]) => slug !== params.city);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <main className="tp-main" lang="en">
        <nav className="tp-crumbs" aria-label="Breadcrumbs">
          <Link href="/en" prefetch={false}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/en/collections">Collections</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{name}</span>
        </nav>

        <section className="tp-hero tp-hero-solo" aria-labelledby="city-title">
          <div className="tp-hero-copy">
            <h1 id="city-title" className="tp-h1">
              Opportunities for children{' '}
              <span className="tp-script">in {name}</span>
            </h1>
            <p className="tp-intro">
              Courses, olympiads, scholarships, camps and medical help for children
              aged 0–18 in {name}. Nationwide programmes open across Ukraine are included too.
            </p>
            <p className="tp-hero-stats">
              <span><strong>{total}</strong> {total === 1 ? 'opportunity' : 'opportunities'}</span>
              {freeCount > 0 ? <span> · <strong>{freeCount}</strong> free</span> : null}
            </p>
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                Get new ones on Telegram
              </a>
              <ShareButton
                label="Share this collection"
                copiedLabel="Link copied"
                className="tp-btn tp-btn-outline"
                place="city_page"
              />
            </div>
          </div>
        </section>

        <OpportunitiesList opportunities={clientRows(opportunities)} presetCity={cityName} lang="en" />

        <section className="tp-related" aria-labelledby="other-cities-title">
          <h2 id="other-cities-title" className="tp-h2">Other cities</h2>
          <nav className="city-nav" aria-labelledby="other-cities-title">
            {otherCities.map(([slug, meta]) => (
              <Link key={slug} href={`/en/${slug}`} className="city-nav-link">
                {meta.en || meta.ua}
              </Link>
            ))}
          </nav>
        </section>

        <p className="tp-home-link"><Link href="/en" prefetch={false}>All opportunities on the home page →</Link></p>
      </main>
      <Footer lang="en" />

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
