import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const TYPE_LABELS = {
  course: 'Курс',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  club: 'Гурток',
  exchange: 'Обмін',
  camp: 'Табір',
  study_abroad: 'Навчання за кордоном',
  scholarship: 'Стипендія',
  allowance: 'Виплата',
  grant: 'Грант',
  festival: 'Фестиваль',
  sport_event: 'Спорт',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
};

const NEED_LABELS = {
  gifted: 'обдаровані',
  disability: 'інвалідність',
  autism: 'РАС',
  idp: 'ВПО',
  veteran_family: 'діти ветеранів',
  de_occupied: 'з деокупованих',
  frontline: 'з прифронтових',
  oncology: 'онкохворі',
  rare_disease: 'рідкісні хвороби',
  low_income: 'малозабезпечені',
  large_family: 'багатодітні',
  rural: 'сільська місцевість',
};

const COST_LABELS = {
  free: 'Безкоштовно',
  partially_free: 'З фінансуванням',
  paid_affordable: 'Доступно',
  paid_premium: 'Преміум',
  closed: 'Закрита подача',
};

const COURSE_TYPES = new Set(['course', 'olympiad', 'club', 'exchange', 'study_abroad', 'scholarship', 'internship']);
const EVENT_TYPES = new Set(['camp', 'festival', 'sport_event', 'competition']);

export const revalidate = 3600;

async function getOpportunity(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export async function generateStaticParams() {
  if (!supabase) return [];
  const { data } = await supabase.from('opportunities').select('slug');
  return (data || []).map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) return { title: 'Можливість не знайдена' };

  const typeLabel = TYPE_LABELS[item.opportunity_type] || '';
  const ageRange =
    item.age_from === 0 && item.age_to >= 17
      ? '0-18 років'
      : `${item.age_from}-${item.age_to} років`;

  const title = `${item.title} — ${typeLabel} для дітей ${ageRange}`;
  const description = (item.summary || '').slice(0, 160);
  const url = `https://dityam.com.ua/o/${item.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'Можливості для дитини',
      locale: 'uk_UA',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'dityam.com.ua',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}

function ageRangeLabel(item) {
  if (item.age_from === item.age_to) return `${item.age_from} років`;
  if (item.age_from === 0 && item.age_to >= 17) return '0-18 років';
  return `${item.age_from}-${item.age_to} років`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function buildJsonLd(item) {
  const url = `https://dityam.com.ua/o/${item.slug}`;
  const isFree = item.cost_type === 'free';

  if (COURSE_TYPES.has(item.opportunity_type)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: item.title,
      description: item.summary,
      url,
      inLanguage: 'uk',
      provider: {
        '@type': 'Organization',
        name: item.source || 'dityam.com.ua',
        sameAs: item.source_url || undefined,
      },
      ...(isFree && {
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'UAH',
          category: 'Free',
        },
      }),
      audience: {
        '@type': 'EducationalAudience',
        educationalRole: 'student',
      },
    };
  }

  if (EVENT_TYPES.has(item.opportunity_type)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: item.title,
      description: item.summary,
      url,
      inLanguage: 'uk',
      ...(item.deadline && { startDate: item.deadline }),
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: item.format || 'Україна',
      },
      organizer: {
        '@type': 'Organization',
        name: item.source || 'dityam.com.ua',
        url: item.source_url || undefined,
      },
      ...(isFree && {
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'UAH',
          url,
        },
      }),
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: item.title,
    description: item.summary,
    url,
    inLanguage: 'uk',
  };
}

export default async function OpportunityPage({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) notFound();

  const jsonLd = buildJsonLd(item);
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Головна',
        item: 'https://dityam.com.ua',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: TYPE_LABELS[item.opportunity_type] || 'Можливість',
        item: 'https://dityam.com.ua',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: item.title,
        item: `https://dityam.com.ua/o/${item.slug}`,
      },
    ],
  };

  const needs = (item.child_needs || []).filter((n) => NEED_LABELS[n]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <div className="container">
        <nav className="opportunity-breadcrumbs">
          <Link href="/">← Усі можливості</Link>
        </nav>

        <article className="opportunity-page">
          <div className="opportunity-chips">
            <span className="chip chip-type">{TYPE_LABELS[item.opportunity_type] || item.opportunity_type}</span>
            <span className="chip chip-age">{ageRangeLabel(item)}</span>
            {item.cost_type === 'free' ? <span className="chip chip-free">безкоштовно</span> : null}
            {item.cost_type === 'partially_free' ? <span className="chip chip-paid">з фінансуванням</span> : null}
            {needs.map((n) => (
              <span key={n} className="chip chip-need">{NEED_LABELS[n]}</span>
            ))}
          </div>

          <h1 className="opportunity-title">{item.title}</h1>
          <p className="opportunity-summary">{item.summary}</p>

          <dl className="opportunity-meta">
            {item.format && (
              <>
                <dt>Формат</dt>
                <dd>{item.format}</dd>
              </>
            )}
            {item.deadline && (
              <>
                <dt>Дедлайн</dt>
                <dd>{formatDate(item.deadline)}</dd>
              </>
            )}
            {item.cost_type && (
              <>
                <dt>Вартість</dt>
                <dd>{COST_LABELS[item.cost_type] || item.cost_type}</dd>
              </>
            )}
            {item.source && (
              <>
                <dt>Джерело</dt>
                <dd>{item.source}</dd>
              </>
            )}
          </dl>

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="opportunity-cta"
            >
              Перейти до офіційного сайту ↗
            </a>
          )}
        </article>
      </div>
    </>
  );
}
