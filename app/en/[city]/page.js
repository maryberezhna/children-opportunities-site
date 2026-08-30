import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities, CARD_FIELDS_EN } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';
import OpportunitiesList from '../../OpportunitiesList';
import StickyBar from '../../StickyBar';
import SubscribePopup from '../../SubscribePopup';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';

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
    title: `Opportunities for children in ${name} — courses, olympiads, scholarships`,
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
  const { data, error } = await publicOpportunities(CARD_FIELDS_EN)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
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

      <div className="container" lang="en">
        <div className="hero">
          <div className="hero-badges">
            <Link href="/en" className="city-back-link">← All opportunities</Link>
          </div>
          <h1>
            Opportunities for children
            <br />
            <span className="accent">in {name}</span>
          </h1>
          <p>
            Courses, olympiads, scholarships, camps and medical help for children
            aged 0–18 in {name}. Nationwide programmes open across Ukraine are
            included too.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{total}</span>
              <span className="stat-label">opportunities</span>
            </div>
            <div className="stat">
              <span className="stat-num">{freeCount}</span>
              <span className="stat-label">free of charge</span>
            </div>
          </div>
        </div>

        <nav className="city-nav" aria-label="Other cities">
          {otherCities.map(([slug, meta]) => (
            <Link key={slug} href={`/en/${slug}`} className="city-nav-link">
              {meta.en || meta.ua}
            </Link>
          ))}
        </nav>

        <OpportunitiesList opportunities={opportunities} presetCity={cityName} lang="en" />
        <Footer lang="en" />
      </div>

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
