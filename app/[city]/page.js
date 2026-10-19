import '../styles/routes/topic.css';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow } from '@/lib/supabase';
import { clientRows } from '@/lib/client-rows';
import { CITY_META } from '@/lib/cities';
import { TOPIC_LIST, collectionsPath } from '@/lib/topics';
import { MIN_LOCAL, localTopicCount } from '@/lib/city-topics';
import OpportunitiesList from '../OpportunitiesList';
import { kyivToday, daysUntil } from '@/lib/dates';
import { topWeekCards } from '@/lib/weekly-top';
import { sliderCards } from '@/lib/top-week-slider';
import { isoWeek } from '@/lib/week';
import { TYPE_LABELS, ageRangeLabel } from '@/lib/labels';
import TopWeekSlider from '../TopWeekSlider';
import TopWeekStrip from '../TopWeekStrip';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import ShareButton from '../ShareButton';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import Footer from '../Footer';

const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

// Фото міста в хіро. Справжні знімки є поки для двох міст — решта бере
// нейтральний кадр із дітьми: ставити Київ на сторінку Харкова не можна
// (19.10.2026, правило «нічого не вигадувати»).
const CITY_HERO = {
  lviv: { src: '/city-lviv', alt: 'Історична вулиця Львова' },
  kyiv: { src: '/city-kyiv', alt: 'Майдан Незалежності в Києві' },
  chernihiv: { src: '/city-chernihiv', alt: 'Осінній Чернігів: будинки серед дерев' },
  kharkiv: { src: '/city-kharkiv', alt: 'Держпром у Харкові навесні', credit: 'Andreeva Aliona01 · CC BY-SA 4.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:%D0%94%D0%B5%D1%80%D0%B6%D0%BF%D1%80%D0%BE%D0%BC_132.jpg' },
  odesa: { src: '/city-odesa', alt: 'Потьомкінські сходи в Одесі', credit: 'DIMSFIKAS · CC BY-SA 3.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:Potemkin_stairs,_Odessa.jpg' },
  zaporizhzhia: { src: '/city-zaporizhzhia', alt: 'Скелі Хортиці над Дніпром у Запоріжжі', credit: 'George Chernilevsky · CC BY-SA 4.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:Khortytsia_2021_G7.jpg' },
  dnipro: { src: '/city-dnipro', alt: 'Столітній будинок на вулиці Донцова в Дніпрі', credit: 'Alex Blokha · CC BY-SA 4.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:100_years_old_house_on_Dontsova_15_in_Dnipro.jpg' },
  chernivtsi: { src: '/city-chernivtsi', alt: 'Історична забудова Чернівців', credit: 'Romankravchuk · CC BY-SA 4.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:Architecture-of-Chernivtsi-4.jpg' },
  zhytomyr: { src: '/city-zhytomyr', alt: 'Спасо-Преображенський собор у Житомирі', credit: 'Texnik · CC BY-SA 3.0', creditUrl: 'https://commons.wikimedia.org/wiki/File:Svyato-Preobrajenskiy-Sobor_Zhytomyr_2008-2.jpg' },
};
const DEFAULT_HERO = { src: '/city-default', alt: 'Діти малюють на мольбертах у світлому класі' };

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
  const hero = CITY_HERO[params.city] || DEFAULT_HERO;
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
  const todayIso = kyivToday();
  const topWeek = sliderCards(
    topWeekCards({ items: opportunities, week: isoWeek(), todayIso, daysUntil }),
    {
      lang: 'uk',
      pinned: 'Топ',
      free: 'безкоштовно',
      type: TYPE_LABELS,
      age: (o) => ageRangeLabel(o, 'uk'),
      todayIso,
    },
  );

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
          <Link href={collectionsPath('uk')}>Підбірки</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{cityName}</span>
        </nav>

        <section className={`tp-hero${hero ? '' : ' tp-hero-solo'}`} aria-labelledby="city-title">
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

          {hero ? (
            <div className="tp-hero-side">
              <div className="tp-hero-photo">
                <picture>
                  <source srcSet={`${hero.src}.webp`} type="image/webp" />
                  <img src={`${hero.src}.jpg`} alt={hero.alt} width="900" height="600" loading="eager" fetchPriority="high" />
                </picture>
              </div>
              {/* Фото міст із Wikimedia Commons ідуть під CC BY-SA: ліцензія
                  вимагає імені автора. Рядок дрібний і сірий, але він має
                  бути — без нього знімок брати не можна (19.10.2026).
                  Живе ПОЗА .tp-hero-photo: там overflow:hidden і фіксована
                  пропорція 3:2, усередині підпис просто обрізало б. */}
              {hero.credit ? (
                <p className="tp-hero-credit">
                  Фото:{' '}
                  {hero.creditUrl
                    ? <a href={hero.creditUrl} target="_blank" rel="noopener noreferrer nofollow">{hero.credit}</a>
                    : hero.credit}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* «Топ 3 цього тижня» — той самий компонент і дизайн, що в підбірках
            (19.10.2026). Раніше місто малювало власний блок усередині списку,
            і на сторінці стояли дві різні трійки. */}
        {topWeek.length === 3 ? (
          <>
            <TopWeekSlider all lang="uk" title="Топ 3 цього тижня" cards={topWeek} />
            <TopWeekStrip lang="uk" title="Топ 3 цього тижня" cards={topWeek} />
          </>
        ) : null}

        <OpportunitiesList opportunities={clientRows(opportunities)} presetCity={cityName} today={todayIso} hideTop />

        {/* Смужки посилань — ПІСЛЯ списку. Нагорі вони стояли впритул до
            фільтрів, і чотири ряди пігулок поспіль читались як один мес
            (Марія, 19.10.2026). */}
        {cityTopics.length > 0 && (
          <section className="tp-related" aria-labelledby="city-topics-title">
            <h2 id="city-topics-title" className="tp-h2">Підбірки у {locative}</h2>
            <nav className="city-nav" aria-labelledby="city-topics-title">
              {cityTopics.map((t) => (
                <Link key={t.slug} href={`/${params.city}/${t.slug}`} className="city-nav-link">
                  {t.nav}
                </Link>
              ))}
            </nav>
          </section>
        )}

        <section className="tp-related" aria-labelledby="other-cities-title">
          <h2 id="other-cities-title" className="tp-h2">Інші міста</h2>
          <nav className="city-nav" aria-labelledby="other-cities-title">
            {otherCities.map(([slug, meta]) => (
              <Link key={slug} href={`/${slug}`} className="city-nav-link">
                {meta.ua}
              </Link>
            ))}
          </nav>
        </section>

        <p className="tp-home-link"><Link href="/" prefetch={false}>Усі можливості — на головній →</Link></p>
      </main>
      <Footer />

      <StickyBar />
      <SubscribePopup />
    </>
  );
}
