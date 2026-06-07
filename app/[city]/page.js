import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';
import OpportunitiesList from '../OpportunitiesList';
import StickyHeader from '../StickyHeader';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import Footer from '../Footer';

export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(CITY_META).map((city) => ({ city }));
}

export async function generateMetadata({ params }) {
  const cityData = CITY_META[params.city];
  if (!cityData) return {};
  const { ua, locative } = cityData;
  return {
    title: `Можливості для дітей у ${locative} — курси, олімпіади, стипендії`,
    description: `Безкоштовний каталог можливостей для дітей 0–18 років у ${locative}: курси, олімпіади, стипендії, табори, медична допомога. Оновлюється щодня.`,
    alternates: { canonical: `https://dityam.com.ua/${params.city}` },
    openGraph: {
      type: 'website',
      locale: 'uk_UA',
      url: `https://dityam.com.ua/${params.city}`,
      siteName: 'Можливості для дитини',
      title: `Можливості для дітей у ${locative}`,
      description: `Безкоштовний каталог можливостей для дітей 0–18 років у ${locative}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `dityam.com.ua — можливості для дітей у ${locative}` }],
    },
  };
}

async function getCityOpportunities(cityName) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'active')
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

  const { ua: cityName, locative } = cityData;
  const opportunities = await getCityOpportunities(cityName);
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Можливості для дітей у ${locative}`,
    numberOfItems: total,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://dityam.com.ua/o/${o.slug}`,
      name: o.title,
    })),
  };

  const otherCities = Object.entries(CITY_META).filter(([slug]) => slug !== params.city);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <StickyHeader />

      <div className="container">
        <div className="hero">
          <div className="hero-badges">
            <Link href="/" className="city-back-link">← Всі можливості</Link>
          </div>
          <h1>
            Можливості для дітей
            <br />
            <span className="accent">у {locative}</span>
          </h1>
          <p>
            Курси, олімпіади, стипендії, табори та медична допомога для дітей 0–18 років
            у {locative}. Включені загальнонаціональні програми, доступні по всій Україні.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{total}</span>
              <span className="stat-label">можливостей</span>
            </div>
            <div className="stat">
              <span className="stat-num">{freeCount}</span>
              <span className="stat-label">безкоштовних</span>
            </div>
          </div>
        </div>

        <nav className="city-nav" aria-label="Інші міста">
          {otherCities.map(([slug, meta]) => (
            <Link key={slug} href={`/${slug}`} className="city-nav-link">
              {meta.ua}
            </Link>
          ))}
        </nav>

        <OpportunitiesList opportunities={opportunities} presetCity={cityName} />
        <Footer />
      </div>

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
