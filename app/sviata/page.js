import Link from 'next/link';
import eventsData from '@/data/events.json';
import SubscribeBar from './SubscribeBar';

const SITE_URL = 'https://dityam.com.ua';
const ICS_URL = `${SITE_URL}/calendar.ics`;

export const metadata = {
  title: 'Календар свят для родин з дітьми',
  description:
    'Українські державні свята та міжнародні дні для родин з дітьми 0–18 років. Підпишіться на оновлюваний календар у Google, Apple або Outlook.',
  alternates: { canonical: `${SITE_URL}/sviata` },
  openGraph: {
    title: 'Календар свят для родин з дітьми',
    description: 'Українські свята + міжнародні дні, дотичні до дітей. Один публічний календар.',
    url: `${SITE_URL}/sviata`,
    siteName: 'dityam.com.ua',
    locale: 'uk_UA',
    type: 'website',
  },
};

// Перебудовувати раз на добу для коректного підсвічування минулих подій
export const revalidate = 86400;

const MONTHS_UA = [
  '', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const DOW_UA = ['', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

function groupByMonth(events) {
  const grouped = {};
  for (const e of events) {
    if (!grouped[e.month]) grouped[e.month] = [];
    grouped[e.month].push(e);
  }
  return grouped;
}

function isPast(isoDate, today) {
  return new Date(isoDate) < new Date(today.toDateString());
}

function buildJsonLd(events) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Календар свят для родин з дітьми',
    description: 'Українські державні свята та міжнародні дні, дотичні до дітей',
    url: `${SITE_URL}/sviata`,
    itemListElement: events.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: e.summary,
        startDate: e.date,
        description: e.description,
        eventStatus: 'https://schema.org/EventScheduled',
      },
    })),
  };
}

function FilterChip({ href, active, label }) {
  return (
    <Link
      href={href}
      className={`filter-btn${active ? ' active' : ''}`}
    >
      {label}
    </Link>
  );
}

function EventRow({ event, past }) {
  return (
    <li className={`sviata-event${past ? ' sviata-event--past' : ''}`}>
      <div className="sviata-event-date">
        <span className="sviata-event-day">{event.day}</span>
        <span className="sviata-event-dow">{DOW_UA[event.dow]}</span>
      </div>
      <div className="sviata-event-body">
        <div className="sviata-event-title">
          <span aria-hidden="true">{event.emoji} </span>
          {event.summary}
        </div>
        <p className="sviata-event-desc">{event.description}</p>
        {event.tags.length > 0 && (
          <div className="sviata-event-tags">
            <span className={`sviata-tag ${event.category === 'Україна' ? 'sviata-tag-ua' : 'sviata-tag-inter'}`}>
              {event.category}
            </span>
            {event.tags.slice(0, 3).map((t) => (
              <span key={t} className="sviata-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function SviataPage({ searchParams }) {
  const today = new Date();

  const selectedYear =
    searchParams?.year && eventsData.years.includes(searchParams.year)
      ? searchParams.year
      : String(eventsData.current_year);

  const allEvents = eventsData.by_year[selectedYear] ?? [];

  const catFilter = searchParams?.cat;
  const filtered = allEvents.filter((e) => {
    if (catFilter === 'ukraina') return e.category === 'Україна';
    if (catFilter === 'inter') return e.category === 'Міжнародні';
    return true;
  });

  const grouped = groupByMonth(filtered);
  // Показуємо тільки поточний місяць і далі до кінця року (не минулі місяці)
  const currentMonth = today.getMonth() + 1; // 1-12
  const months = Object.keys(grouped)
    .map(Number)
    .filter((m) => m >= currentMonth)
    .sort((a, b) => a - b);

  const ukrCount = allEvents.filter((e) => e.category === 'Україна').length;
  const intCount = allEvents.filter((e) => e.category === 'Міжнародні').length;

  return (
    <div className="container">
      <div className="sviata-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(filtered)) }}
      />

      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>

      {/* Hero */}
      <header className="sviata-hero">
        <h1>📅 Календар свят для родин</h1>
        <p>
          Українські державні свята та міжнародні дні, дотичні до дітей.
          Підпишіться раз — оновлення прийдуть автоматично.
        </p>
        <SubscribeBar icsUrl={ICS_URL} />
      </header>

      {/* Фільтри */}
      <nav className="sviata-filters" aria-label="Фільтри">
        <FilterChip
          href={`/sviata?year=${selectedYear}`}
          active={!catFilter}
          label={`Усі (${ukrCount + intCount})`}
        />
        <FilterChip
          href={`/sviata?year=${selectedYear}&cat=ukraina`}
          active={catFilter === 'ukraina'}
          label={`🇺🇦 Україна (${ukrCount})`}
        />
        <FilterChip
          href={`/sviata?year=${selectedYear}&cat=inter`}
          active={catFilter === 'inter'}
          label={`🌍 Міжнародні (${intCount})`}
        />

        <span className="sviata-sep" aria-hidden="true">·</span>

        {eventsData.years.map((y) => (
          <FilterChip
            key={y}
            href={`/sviata?year=${y}${catFilter ? `&cat=${catFilter}` : ''}`}
            active={selectedYear === y}
            label={y}
          />
        ))}
      </nav>

      {/* Список за місяцями */}
      <div className="sviata-months">
        {months.map((m) => (
          <section key={m} id={`m-${m}`}>
            <h2 className="sviata-month-heading">{MONTHS_UA[m]}</h2>
            <ul className="sviata-events">
              {grouped[m].map((e) => (
                <EventRow
                  key={`${e.slug}-${e.date}`}
                  event={e}
                  past={isPast(e.date, today)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Підвал */}
      <footer className="sviata-footer-note">
        <p>
          Календар відкритий і безкоштовний.
          Джерело: ст.&nbsp;73 КЗпП України, укази Президента, ООН, ЮНЕСКО.
        </p>
        <p>
          Згенеровано:{' '}
          <time dateTime={eventsData.generated_at}>
            {new Date(eventsData.generated_at).toLocaleDateString('uk-UA')}
          </time>
          {' '}· вікно {eventsData.years[0]}–{eventsData.years[eventsData.years.length - 1]}
        </p>
      </footer>
      </div>
    </div>
  );
}
