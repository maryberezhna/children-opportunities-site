import '@/app/styles/sviata.css';
import Link from 'next/link';
import eventsData from '@/data/events.json';
import { publicOpportunities, fetchAllRows, rowsOrThrow, isSupabaseConfigured } from '@/lib/supabase';
import { TYPE_LABELS } from '@/lib/labels';
import { CALENDAR_TYPES } from '@/app/calendar.ics/route';
import SubscribeBar from './SubscribeBar';

const SITE_URL = 'https://dityam.com.ua';
const ICS_URL = `${SITE_URL}/calendar.ics`;

export const metadata = {
  title: 'Календар свят і дедлайнів конкурсів для дітей',
  description:
    'Українські свята, міжнародні дні для дітей і дедлайни конкурсів, олімпіад та стипендій — в одному календарі. Підпишіться в Google, Apple або Outlook: оновлюється самостійно.',
  alternates: { canonical: `${SITE_URL}/sviata` },
  openGraph: {
    title: 'Календар свят і дедлайнів конкурсів для дітей',
    description: 'Свята, міжнародні дні для дітей і дедлайни конкурсів — один календар, що оновлюється сам.',
    url: `${SITE_URL}/sviata`,
    siteName: 'Можливості для дитини',
    locale: 'uk_UA',
    type: 'website',
  },
};

// Раз на годину: сторінка показує не лише свята, а й дедлайни з бази.
export const revalidate = 3600;

const WINDOW_DAYS = 120;
const isoDate = (d) => d.toISOString().slice(0, 10);

// Найближчі дедлайни конкурсів, олімпіад і стипендій — те саме, що в .ics.
async function nearestDeadlines() {
  if (!isSupabaseConfigured) return [];
  const today = new Date();
  const until = new Date(today.getTime() + WINDOW_DAYS * 86400000);
  return rowsOrThrow(await fetchAllRows(() => publicOpportunities(
    'slug, title, deadline, opportunity_type, cost_type, featured_week',
  )
    .in('opportunity_type', CALENDAR_TYPES)
    .not('deadline', 'is', null)
    .gte('deadline', isoDate(today))
    .lte('deadline', isoDate(until))
    .order('deadline', { ascending: true })
    .order('id')), 'sviata');
}

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

const MONTHS_GEN = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

function fmtDeadline(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_GEN[m]}`;
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

export default async function SviataPage({ searchParams }) {
  const today = new Date();
  let deadlines = [];
  try {
    deadlines = await nearestDeadlines();
  } catch (e) {
    // Свята показуємо навіть тоді, коли база недоступна.
    console.error('[sviata] deadlines:', e?.message || e);
  }

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

  const allEventsCount = allEvents.length;
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
        <h1>📅 Календар свят і дедлайнів</h1>
        <p>
          Українські свята, міжнародні дні для дітей — і дедлайни конкурсів,
          олімпіад та стипендій. Підпишіться раз: нові конкурси зʼявляться
          у вашому календарі самі, а за 3 дні до дедлайну прийде нагадування.
        </p>
        <SubscribeBar icsUrl={ICS_URL} />
        {deadlines.length > 0 && (
          <p className="sviata-hero-count">
            У календарі зараз <b>{deadlines.length}</b>{' '}
            {deadlines.length === 1 ? 'дедлайн' : 'дедлайнів'} на найближчі 4 місяці
            й <b>{allEventsCount}</b> свят на рік.
          </p>
        )}
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

      {/* Дедлайни конкурсів — те саме, що в .ics (15.10.2026). */}
      {deadlines.length > 0 && (
        <section className="sviata-deadlines" aria-labelledby="sviata-dl">
          <h2 id="sviata-dl">⏰ Найближчі дедлайни конкурсів і олімпіад</h2>
          <p className="sviata-deadlines-sub">
            Конкурси, олімпіади та стипендії з відкритою подачею. Підпишіться на
            календар — нагадування прийде за 3 дні до кожного дедлайну.
          </p>
          <ul className="sviata-dl-list">
            {deadlines.slice(0, 12).map((o) => (
              <li key={o.slug}>
                <Link href={`/o/${o.slug}`}>
                  <span className="sviata-dl-date">{fmtDeadline(o.deadline)}</span>
                  <span className="sviata-dl-title">
                    {o.featured_week ? '⭐ ' : ''}{o.title}
                  </span>
                  <span className="sviata-dl-meta">
                    {TYPE_LABELS[o.opportunity_type] || 'Можливість'}
                    {o.cost_type === 'free' ? ' · безкоштовно' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="sviata-dl-more">
            <Link href="/dedlainy">Усі дедлайни на найближчі місяці →</Link>
          </p>
        </section>
      )}

      {/* Нагадування про Dityam+ (Марія, 15.10.2026: «додай туди нагадування
          про підписку»). Обіцяємо лише те, що вже працює. */}
      <section className="sviata-plus">
        <div>
          <h2>Нагадаємо саме про те, що підходить вашій дитині</h2>
          <p>
            Календар показує всі дедлайни підряд. Dityam+ щодня перебирає нові
            можливості й надсилає в Telegram лише ті, що підходять вашій дитині
            за віком, інтересами й містом, — і нагадує про дедлайн, поки ще
            встигаєте подати заявку.
          </p>
        </div>
        <Link href="/plus" className="sviata-plus-btn">Про Dityam+</Link>
      </section>

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
