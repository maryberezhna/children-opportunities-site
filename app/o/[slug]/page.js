import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { addToCalendarPageUrl } from '@/lib/calendar-links';

const TYPE_LABELS = {
  course: 'Курс',
  workshop: 'Майстер-клас',
  summer_school: 'Літня школа',
  study_program: 'Навчальна програма',
  mentorship: 'Менторство',
  club: 'Гурток',
  camp: 'Табір',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  hackathon: 'Хакатон',
  sport_tournament: 'Спорт. турнір',
  festival: 'Фестиваль',
  award: 'Премія',
  exchange: 'Обмін',
  excursion: 'Екскурсія',
  residency: 'Резиденція',
  scholarship: 'Стипендія',
  grant: 'Грант',
  allowance: 'Виплата',
  support_payment: 'Соц. виплата',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
  conference: 'Конференція',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  legal_aid: 'Правова допомога',
  shelter: 'Прихисток',
  educational_material: 'Навч. матеріали',
  // legacy aliases
  study_abroad: 'Навчання за кордоном',
  sport_event: 'Спорт',
};

const NEED_LABELS = {
  gifted: 'обдаровані',
  disability: 'інвалідність',
  autism: 'РАС',
  idp: 'ВПО',
  veteran_family: 'діти ветеранів і загиблих',
  de_occupied: 'з деокупованих',
  frontline: 'з прифронтових',
  oncology: 'онкохворі',
  rare_disease: 'рідкісні хвороби',
  low_income: 'малозабезпечені',
  orphan: 'сироти',
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

const AID_TYPE_LABELS = {
  cash: 'держвиплата',
  scholarship: 'соц. стипендія',
  recreation: 'оздоровлення',
  free_activities: 'безкоштовна секція',
  vocational: 'проф. навчання',
};

const COURSE_TYPES = new Set(['course', 'olympiad', 'club', 'exchange', 'study_abroad', 'scholarship', 'internship']);
const EVENT_TYPES = new Set(['camp', 'festival', 'sport_event', 'competition']);

export const revalidate = 3600;

async function getOpportunity(slug) {
  if (!supabase) return null;
  // status='active' only — never render drafts (pending agent candidates),
  // skipped (closed) or archived rows, even by direct slug URL.
  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  return data;
}

const RELATED_FIELDS = 'slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, child_needs';

async function getRelated(item, limit = 8) {
  if (!supabase || !item) return [];
  const { data } = await supabase
    .from('opportunities')
    .select(RELATED_FIELDS)
    .eq('status', 'active')
    .neq('slug', item.slug)
    .eq('opportunity_type', item.opportunity_type)
    .lte('age_from', item.age_to)
    .gte('age_to', item.age_from)
    .limit(limit);
  if (data && data.length >= 4) return data;

  const { data: fallback } = await supabase
    .from('opportunities')
    .select(RELATED_FIELDS)
    .eq('status', 'active')
    .neq('slug', item.slug)
    .lte('age_from', item.age_to)
    .gte('age_to', item.age_from)
    .limit(limit);
  return fallback || [];
}

export async function generateStaticParams() {
  if (!supabase) return [];
  const { data } = await supabase.from('opportunities').select('slug').eq('status', 'active');
  return (data || []).map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) return { title: 'Можливість не знайдена' };

  if (item.status && item.status !== 'active') {
    return {
      title: item.title,
      robots: { index: false, follow: false },
    };
  }

  const typeLabel = TYPE_LABELS[item.opportunity_type] || '';
  const ageRange =
    item.age_from === 0 && item.age_to >= 17
      ? '0-18 років'
      : `${item.age_from}-${item.age_to} років`;

  const title = `${item.title} — ${typeLabel} для дітей ${ageRange}`;
  const url = `https://dityam.com.ua/o/${item.slug}`;

  const rawSummary = (item.summary || '').trim();
  const COST_DESC = {
    free: 'безкоштовно',
    partially_free: 'з фінансуванням',
    paid_affordable: 'доступна вартість',
    paid_premium: 'платно',
  };
  const costHint = COST_DESC[item.cost_type] || '';
  const description = rawSummary.length >= 40
    ? rawSummary.slice(0, 160)
    : `${typeLabel} для дітей ${ageRange}${costHint ? `, ${costHint}` : ''}. ${rawSummary}`.trim().slice(0, 160);

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
      ...(item.created_at && { publishedTime: item.created_at }),
      ...(item.updated_at && { modifiedTime: item.updated_at }),
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

  const related = await getRelated(item);
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
            {item.aid_type ? <span className="chip chip-aid">🏛 {AID_TYPE_LABELS[item.aid_type] || 'держдопомога'}</span> : null}
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

          <div className="opportunity-actions">
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
            {item.deadline && (
              <Link href={addToCalendarPageUrl(item.slug).replace('https://dityam.com.ua', '')} className="cal-btn">
                📅 Додати в календар
              </Link>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <section className="opportunity-related" aria-labelledby="related-heading">
            <h2 id="related-heading" className="opportunity-related-title">
              Схожі можливості для дітей {ageRangeLabel(item)}
            </h2>
            <ul className="opportunity-related-list">
              {related.map((r) => {
                const days = r.deadline ? Math.ceil((new Date(r.deadline) - new Date().setHours(0,0,0,0)) / 86400000) : null;
                const needs = (r.child_needs || []).filter((n) => NEED_LABELS[n]);
                return (
                  <li key={r.slug}>
                    <Link href={`/o/${r.slug}`} className="card" style={{ textDecoration: 'none' }}>
                      <div className="chips">
                        <span className="chip chip-type">{TYPE_LABELS[r.opportunity_type] || r.opportunity_type}</span>
                        <span className="chip chip-age">{ageRangeLabel(r)}</span>
                        {r.cost_type === 'free' && <span className="chip chip-free">безкоштовно</span>}
                        {r.cost_type === 'partially_free' && <span className="chip chip-paid">з фінансуванням</span>}
                        {r.cost_type === 'paid_affordable' && <span className="chip chip-paid">доступно</span>}
                        {days !== null && days >= 0 && days <= 7 && (
                          <span className="chip chip-deadline-urgent">⏰ {days === 0 ? 'сьогодні' : `${days} днів`}</span>
                        )}
                        {days !== null && days > 7 && days <= 30 && (
                          <span className="chip chip-deadline-soon">⏳ {days} днів</span>
                        )}
                        {needs.slice(0, 2).map((n) => (
                          <span key={n} className="chip chip-need">{NEED_LABELS[n]}</span>
                        ))}
                      </div>
                      <h3 className="card-title-link" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35, color: 'var(--ink)' }}>
                        {r.title}
                      </h3>
                      {r.summary && (
                        <p className="card-summary">
                          {r.summary.length > 140 ? `${r.summary.slice(0, 140)}…` : r.summary}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
