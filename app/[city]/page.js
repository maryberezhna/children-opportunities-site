import '../styles/routes/topic.css';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow } from '@/lib/supabase';
import { clientRows } from '@/lib/client-rows';
import { CITY_META } from '@/lib/cities';
import { TOPIC_LIST } from '@/lib/topics';
import { MIN_LOCAL, localTopicCount } from '@/lib/city-topics';
import OpportunitiesList from '../OpportunitiesList';
import { kyivToday } from '@/lib/dates';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import ShareButton from '../ShareButton';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import Footer from '../Footer';

const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(CITY_META).map((city) => ({ city }));
}

export async function generateMetadata({ params }) {
  const cityData = CITY_META[params.city];
  if (!cityData) return {};
  const { ua, locative } = cityData;
  return {
    title: { absolute: `Можливості для дітей у ${locative} — курси, олімпіади, стипендії` },
    description: `Безкоштовний каталог можливостей для дітей 0–18 років у ${locative}: курси, олімпіади, стипендії, табори, медична допомога. Оновлюється щодня.`,
    alternates: {
      canonical: `https://dityam.com.ua/${params.city}`,
      languages: {
        uk: `https://dityam.com.ua/${params.city}`,
        en: `https://dityam.com.ua/en/${params.city}`,
      },
    },
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
  const data = rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities().order('created_at', { ascending: false }).order('id')), `city ${cityName}`);
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

  // Підбірки цього міста, що пройшли поріг локальних записів, — ті самі
  // правила, що в /[city]/[topic]. Лінкуємо лише на сторінки, які існують.
  const cityTopics = TOPIC_LIST.filter(
    (t) => !t.noCityPages && localTopicCount(opportunities, t, cityName) >= MIN_LOCAL,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      {/* 19.10.2026: сторінка міста лишалась на доредизайновому хіро
          (.container/.hero/.stats) — заголовок відлітав праворуч, ліворуч
          зяяла порожнеча. Марія: «що це за найгірший у світі дизайн».
          Тепер та сама верстка, що в підбірок (tp-*, макет Topic.dc.html):
          крихти, H1 зі скорописом, одне речення, рядок цифр, кнопки.
          Список лишається повним — із пошуком і всіма фільтрами. */}
      <main className="tp-main">
        <nav className="tp-crumbs" aria-label="Навігація">
          <Link href="/" prefetch={false}>Головна</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{cityName}</span>
        </nav>

        <section className="tp-hero tp-hero-solo" aria-labelledby="city-title">
          <div className="tp-hero-copy">
            <h1 id="city-title" className="tp-h1">
              Можливості для дітей{' '}
              <span className="tp-script">у {locative}</span>
            </h1>
            <p className="tp-intro">
              Курси, олімпіади, стипендії, табори та медична допомога для дітей 0–18 років
              у {locative}. Включені загальнонаціональні програми, доступні по всій Україні.
            </p>
            <p className="tp-hero-stats">
              <span><strong>{total}</strong> {opportunitiesWord(total)}</span>
              {freeCount > 0 ? <span> · <strong>{freeCount}</strong> {freeWord(freeCount)}</span> : null}
            </p>
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                Отримувати нові в Telegram
              </a>
              <ShareButton
                label="Поділитися підбіркою"
                copiedLabel="Посилання скопійовано"
                className="tp-btn tp-btn-outline"
                place="city_page"
              />
            </div>
          </div>
        </section>

        {cityTopics.length > 0 && (
          <nav className="city-nav" aria-label={`Підбірки у ${locative}`}>
            {cityTopics.map((t) => (
              <Link key={t.slug} href={`/${params.city}/${t.slug}`} className="city-nav-link">
                {t.nav} у {locative}
              </Link>
            ))}
          </nav>
        )}

        <nav className="city-nav" aria-label="Інші міста">
          {otherCities.map(([slug, meta]) => (
            <Link key={slug} href={`/${slug}`} className="city-nav-link">
              {meta.ua}
            </Link>
          ))}
        </nav>

        <OpportunitiesList opportunities={clientRows(opportunities)} presetCity={cityName} today={kyivToday()} />

        <p className="tp-home-link"><Link href="/" prefetch={false}>Усі можливості — на головній →</Link></p>
      </main>
      <Footer />

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
