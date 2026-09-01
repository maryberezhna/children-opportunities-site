import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';
import { TOPICS, TOPIC_LIST } from '@/lib/topics';
import {
  MIN_LOCAL,
  CITY_TOPIC_TEXTS,
  cityTopicRows,
  localTopicCount,
  qualifyingCombos,
} from '@/lib/city-topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import OpportunitiesList from '../../OpportunitiesList';
import StickyBar from '../../StickyBar';
import SubscribePopup from '../../SubscribePopup';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 300;

// Поля, від яких залежить право сторінки на існування: match() дивиться на
// назву й типи, поріг — на міста. Повні картки для цього тягти не треба.
const COMBO_FIELDS = 'title, cost_type, aid_type, opportunity_type, cities';

async function getAllRows(fields) {
  if (!supabase) return [];
  const { data, error } = await fetchAllRows(() =>
    publicOpportunities(fields).order('created_at', { ascending: false }).order('id'));
  return error || !data ? [] : data;
}

/**
 * Будуємо лише комбінації над порогом — решта віддає 404 і в білд не
 * потрапляє. dynamicParams лишається увімкненим: коли гео-розмітка доростить
 * нове місто до порогу, сторінка зʼявиться на першому ж запиті, без деплою.
 */
export async function generateStaticParams() {
  const rows = await getAllRows(COMBO_FIELDS);
  return qualifyingCombos(rows).map(({ citySlug, topicSlug }) => ({
    city: citySlug,
    topic: topicSlug,
  }));
}

export async function generateMetadata({ params }) {
  const cityData = CITY_META[params.city];
  const texts = CITY_TOPIC_TEXTS[params.topic];
  if (!cityData || !texts) return {};
  const url = `${SITE_URL}/${params.city}/${params.topic}`;
  return {
    title: texts.title(cityData),
    description: texts.description(cityData),
    // Без hreflang: англійського двійника немає, обіцяти його Google не можна.
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'uk_UA',
      url,
      siteName: 'Можливості для дитини',
      title: texts.title(cityData),
      description: texts.description(cityData),
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: texts.title(cityData) }],
    },
  };
}

export default async function CityTopicPage({ params }) {
  const cityData = CITY_META[params.city];
  const topic = TOPICS[params.topic];
  const texts = CITY_TOPIC_TEXTS[params.topic];
  if (!cityData || !topic || !texts) notFound();

  const rows = await getAllRows(undefined);
  const localCount = localTopicCount(rows, topic, cityData.ua);
  if (localCount < MIN_LOCAL) notFound();

  const opportunities = cityTopicRows(rows, topic, cityData.ua);
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;

  const url = `${SITE_URL}/${params.city}/${params.topic}`;
  const { locative } = cityData;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: texts.h1(cityData).join(' '),
      numberOfItems: total,
      itemListElement: opportunities.slice(0, 100).map((o, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/o/${o.slug}`,
        name: o.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: cityData.ua, item: `${SITE_URL}/${params.city}` },
        { '@type': 'ListItem', position: 3, name: topic.nav, item: url },
      ],
    },
  ];

  // Самодостатнє речення з числами й датою — той самий формат, що на
  // тематичних сторінках: AI-двигуни цитують його як готову відповідь.
  const updatedLabel = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  const sentence =
    `Станом на ${updatedLabel} у ${locative} — ${total} ${opportunitiesWord(total)} `
    + `у цій категорії: ${localCount} саме в місті, решта — всеукраїнські, доступні звідусіль`
    + (freeCount > 0 ? `; ${freeCount} — ${freeWord(freeCount)}` : '')
    + '. Каталог оновлюється щодня.';

  // Перехресні посилання тільки на сторінки, що існують: та сама тема в інших
  // містах і інші теми цього міста, кожна — над порогом.
  const sameTopicElsewhere = Object.entries(CITY_META)
    .filter(([slug, meta]) =>
      slug !== params.city && localTopicCount(rows, topic, meta.ua) >= MIN_LOCAL);
  const otherTopicsHere = TOPIC_LIST
    .filter((t) => t.slug !== topic.slug && localTopicCount(rows, t, cityData.ua) >= MIN_LOCAL);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <div className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href={`/${params.city}`} className="city-back-link">
                ← Всі можливості у {locative}
              </Link>
            </div>
            <h1>
              {texts.h1(cityData)[0]}
              <br />
              <span className="accent">{texts.h1(cityData)[1]}</span>
            </h1>
            <p>{texts.intro(cityData)}</p>
            <p>{sentence}</p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{total}</span>
                <span className="stat-label">{opportunitiesWord(total)}</span>
              </div>
              <div className="stat">
                <span className="stat-num">{localCount}</span>
                <span className="stat-label">у {locative}</span>
              </div>
              <div className="stat">
                <span className="stat-num">{freeCount}</span>
                <span className="stat-label">{freeWord(freeCount)}</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="city-nav" aria-label="Повʼязані підбірки">
          {otherTopicsHere.map((t) => (
            <Link key={t.slug} href={`/${params.city}/${t.slug}`} className="city-nav-link">
              {t.nav} у {locative}
            </Link>
          ))}
          {sameTopicElsewhere.map(([slug, meta]) => (
            <Link key={slug} href={`/${slug}/${topic.slug}`} className="city-nav-link">
              {topic.nav} у {meta.locative}
            </Link>
          ))}
          <Link href={`/${topic.slug}`} className="city-nav-link">
            {topic.nav} — вся Україна
          </Link>
        </nav>

        <OpportunitiesList
          opportunities={opportunities}
          presetCity={cityData.ua}
          today={kyivToday()}
        />
        <Footer />
      </div>

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
