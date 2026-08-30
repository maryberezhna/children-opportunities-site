import Link from 'next/link';
import { publicOpportunities, CARD_FIELDS, isSupabaseConfigured } from '@/lib/supabase';
import { TYPE_LABELS, COST_LABELS, ageLabel } from '@/lib/labels';
import { placeLabel, isInternational } from '@/lib/geo';
import ReminderForm from './ReminderForm';

export const revalidate = 300;

const SITE_URL = 'https://dityam.com.ua';

// Вікно на 92 дні, а не «осінь 2026». Датована сторінка помирає в грудні
// разом із усією органікою, яку встигла набрати; живе вікно щодня зсувається
// саме й лишається правдивим.
const WINDOW_DAYS = 92;

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер',
  'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

const iso = (d) => d.toISOString().slice(0, 10);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function getItems() {
  if (!isSupabaseConfigured) return [];
  const today = new Date();
  const until = new Date(today.getTime() + WINDOW_DAYS * 86400000);
  const { data, error } = await publicOpportunities(
    `${CARD_FIELDS}, is_international, countries`,
  )
    .not('deadline', 'is', null)
    .gte('deadline', iso(today))
    .lte('deadline', iso(until))
    .order('deadline', { ascending: true });
  return error ? [] : (data || []);
}

export const metadata = {
  title: 'Календар дедлайнів для дітей — конкурси, олімпіади, обміни, стипендії',
  description:
    'Найближчі дедлайни можливостей для дітей 0–18 років: конкурси, олімпіади, '
    + 'програми обміну, стипендії й табори. Дати подачі в одному місці, оновлюється щодня.',
  alternates: { canonical: `${SITE_URL}/dedlainy` },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: `${SITE_URL}/dedlainy`,
    title: 'Календар дедлайнів для дітей',
    description: 'Найближчі дати подачі: конкурси, олімпіади, обміни, стипендії, табори.',
  },
};

export default async function Page() {
  const items = await getItems();

  const groups = [];
  for (const item of items) {
    const d = new Date(item.deadline);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, year: d.getFullYear(), month: d.getMonth(), items: [item] });
  }

  const intlCount = items.filter(isInternational).length;
  const freeCount = items.filter((o) => o.cost_type === 'free').length;
  const until = new Date(Date.now() + WINDOW_DAYS * 86400000);
  const untilLabel = `${until.getDate()} ${MONTHS_SHORT[until.getMonth()]} ${until.getFullYear()}`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Календар дедлайнів можливостей для дітей',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((o, i) => ({
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
        { '@type': 'ListItem', position: 2, name: 'Календар дедлайнів', item: `${SITE_URL}/dedlainy` },
      ],
    },
  ];

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
              <Link href="/" className="city-back-link">← Всі можливості</Link>
            </div>
            <h1>
              Календар дедлайнів
              <br />
              <span className="accent">для дітей і підлітків</span>
            </h1>
            <p>
              Найближчі дати подачі — до {untilLabel}. Конкурси, олімпіади, програми
              обміну, стипендії й табори в порядку, у якому вони закриваються.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{items.length}</span>
                <span className="stat-label">дедлайнів попереду</span>
              </div>
              <div className="stat">
                <span className="stat-num">{intlCount}</span>
                <span className="stat-label">міжнародних</span>
              </div>
              <div className="stat">
                <span className="stat-num">{freeCount}</span>
                <span className="stat-label">безкоштовних</span>
              </div>
            </div>
          </div>
        </div>

        <p className="topic-note">
          Найбільше можливостей губиться не тому, що про них не знали, а тому що
          відклали «на потім». Тут вони стоять за датою закриття: спершу те, де
          лишилось найменше часу.
        </p>

        <ReminderForm />

        {groups.length === 0 ? (
          <p className="topic-note">
            Найближчим часом дедлайнів немає. Загляньте в{' '}
            <Link href="/">повний перелік можливостей</Link> — там є й програми
            з постійним набором.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="dl-month" aria-labelledby={`m-${g.key}`}>
              <h2 id={`m-${g.key}`} className="dl-month-title">
                {capitalize(MONTHS[g.month])} {g.year}
                <span className="dl-month-count">{g.items.length}</span>
              </h2>

              <ul className="dl-list">
                {g.items.map((o) => {
                  const d = new Date(o.deadline);
                  const place = placeLabel(o);
                  return (
                    <li key={o.slug} className="dl-row">
                      <Link href={`/o/${o.slug}`} className="dl-link">
                        <time className="dl-date" dateTime={o.deadline}>
                          <span className="dl-day">{d.getDate()}</span>
                          <span className="dl-mon">{MONTHS_SHORT[d.getMonth()]}</span>
                        </time>
                        <span className="dl-body">
                          <span className="dl-title">{o.title}</span>
                          <span className="chips">
                            {isInternational(o) && (
                              <span className="chip chip-intl">Міжнародна</span>
                            )}
                            <span className="chip chip-type">
                              {TYPE_LABELS[o.opportunity_type] || 'Можливість'}
                            </span>
                            <span className="chip chip-age">{ageLabel(o.age_from, o.age_to)}</span>
                            {COST_LABELS[o.cost_type] && (
                              <span className={o.cost_type === 'free' ? 'chip chip-free' : 'chip chip-paid'}>
                                {COST_LABELS[o.cost_type]}
                              </span>
                            )}
                            {place && <span className="chip chip-place">{place}</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
