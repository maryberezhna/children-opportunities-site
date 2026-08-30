import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { addToCalendarPageUrl } from '@/lib/calendar-links';
import { TYPE_LABELS, AID_TYPE_LABELS, ANNUAL_TYPES } from '@/lib/labels';
import OutcomeForm from './OutcomeForm';
import Details from './Details';
import OutboundCta from './OutboundCta';
import SubscribePopup from '../../SubscribePopup';


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


const COURSE_TYPES = new Set(['course', 'olympiad', 'club', 'exchange', 'study_abroad', 'scholarship', 'internship']);
const EVENT_TYPES = new Set(['camp', 'festival', 'sport_event', 'competition']);

export const revalidate = 3600;

// Показуємо 'active' і 'closed'. Архівні — з плашкою «вже завершилась», бо
// посилання на них живуть вічно в постах каналу, діджестах і видачі Google:
// раніше кожна заархівована можливість перетворювала свій URL на 404.
// Чернетки з черги модерації ('draft'/'pending') не показуємо ніколи.
const PUBLIC_STATUSES = new Set(['active', 'closed']);

async function getOpportunity(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || !PUBLIC_STATUSES.has(data.status)) return null;
  return data;
}

const RELATED_FIELDS = 'slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, child_needs';

async function getRelated(item, limit = 8) {
  if (!supabase || !item) return [];
  const { data } = await publicOpportunities(RELATED_FIELDS)
    .neq('slug', item.slug)
    .eq('opportunity_type', item.opportunity_type)
    .lte('age_from', item.age_to)
    .gte('age_to', item.age_from)
    .limit(limit);
  if (data && data.length >= 4) return data;

  const { data: fallback } = await publicOpportunities(RELATED_FIELDS)
    .neq('slug', item.slug)
    .lte('age_from', item.age_to)
    .gte('age_to', item.age_from)
    .limit(limit);
  return fallback || [];
}

export async function generateStaticParams() {
  if (!supabase) return [];
  const { data } = await supabase.from('opportunities')
    .select('slug').eq('status', 'active');
  return (data || []).map((row) => ({ slug: row.slug }));
}

// Google обрізає сніпет приблизно на 160 символах — усе довше не побачать.
const DESC_MAX = 158;

const COST_DESC = {
  free: 'безкоштовно',
  partially_free: 'з фінансуванням',
  paid_affordable: 'доступна вартість',
  paid_premium: 'платна участь',
};

// Сніпет має відповідати на запит, а не переказувати початок опису.
//
// Search Console показує, що люди шукають конкретику — «соколята табір ЦІНА»,
// «олімпіада з математики 2026» — і сторінка з 1029 показів набирає 0.9% CTR,
// бо в сніпеті нічого з цього немає. Тому спершу ставимо факти, за якими
// шукають (вік · вартість · місце · дедлайн), і лише потім — опис, скільки
// влізе в залишок.
function buildDescription(item, typeLabel, ageRange) {
  const facts = [`${typeLabel} для дітей ${ageRange}`];

  // Жива ціна б'є категорію: за запитами «… ціна» ми показувались і не
  // отримували кліків, бо «з фінансуванням» на питання про суму не відповідає.
  if (item.price_note) facts.push(String(item.price_note).trim());
  else if (COST_DESC[item.cost_type]) facts.push(COST_DESC[item.cost_type]);

  // «Вся Україна» нічого не додає до сніпета — беремо конкретне місто,
  // інакше формат (онлайн / офлайн).
  const place =
    (item.cities || []).find((c) => c && c !== 'Вся Україна') || item.format;
  if (place) facts.push(String(place).trim());

  // Для закритої — чесний факт замість простроченого «заявки до …».
  if (item.status === 'closed') {
    facts.push('набір закрито, стежимо за наступним');
  } else {
    const deadline = formatDate(item.deadline);
    if (deadline) facts.push(`заявки до ${deadline}`);
  }

  const head = facts.join(' · ');
  const summary = (item.summary || '').trim();
  if (!summary) return head.slice(0, DESC_MAX);

  // Дописуємо опис лише якщо лишається місце на осмислений шматок.
  const room = DESC_MAX - head.length - 2;
  if (room < 40) return head.slice(0, DESC_MAX);

  const tail = summary.length > room
    ? `${summary.slice(0, room - 1).replace(/[\s,;–—-]+$/, '')}…`
    : summary;
  return `${head}. ${tail}`;
}

export async function generateMetadata({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) return { title: 'Можливість не знайдена' };

  // Дубль: canonical на основну сторінку. Саме canonical, а НЕ noindex —
  // noindex каже Google викинути сторінку, canonical каже склеїти сигнали
  // з основною. Разом вони суперечливі, і склейки не відбувається.
  if (item.canonical_slug && item.canonical_slug !== item.slug) {
    return {
      title: item.title,
      description: item.summary || undefined,
      alternates: { canonical: `https://dityam.com.ua/o/${item.canonical_slug}` },
    };
  }

  // Закриті сторінки НЕ ховаємо від Google. Серед них щорічні програми
  // (табори, конкурси), що накопичили позиції за рік — noindex викидав би
  // цей капітал перед кожним новим набором. Плашка «завершилась» на сторінці
  // чесно каже людині, що подача закрита.
  const typeLabel = TYPE_LABELS[item.opportunity_type] || '';
  const ageRange =
    item.age_from === 0 && item.age_to >= 17
      ? '0-18 років'
      : `${item.age_from}-${item.age_to} років`;

  const title = `${item.title} — ${typeLabel} для дітей ${ageRange}`;
  const url = `https://dityam.com.ua/o/${item.slug}`;

  const description = buildDescription(item, typeLabel, ageRange);

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
      // images навмисне не задаємо: сусідній opengraph-image.js генерує
      // унікальну картинку на кожну можливість, і Next підставляє її сам.
      // Явний images: [...] тут перебив би файлову конвенцію.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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

// «Перевірено сьогодні / вчора / N днів тому» — чесний сигнал свіжості.
// last_verified_at ставить щоденний verify-links (лінк живий), verified_at —
// модератор при схваленні. Понад 30 днів без перевірки — нічого не показуємо,
// стара дата довіри не додає.
function verifiedLabel(item) {
  const ts = item.last_verified_at || item.verified_at;
  if (!ts) return null;
  const date = new Date(ts);
  if (isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0 || days > 30) return null;
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  const lastDigit = days % 10;
  const teens = days % 100 >= 11 && days % 100 <= 14;
  const word = !teens && lastDigit === 1 ? 'день'
    : !teens && lastDigit >= 2 && lastDigit <= 4 ? 'дні' : 'днів';
  return `${days} ${word} тому`;
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

  // Event — лише коли відома дата: Google вимагає startDate, і 27 сторінок
  // без неї висіли в Search Console помилкою. Без дати чесніше віддати
  // WebPage, ніж вигадувати дату чи ловити помилки валідації.
  if (EVENT_TYPES.has(item.opportunity_type) && item.deadline) {
    const isOnline = /онлайн|online/i.test(item.format || '');
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: item.title,
      description: item.summary,
      url,
      inLanguage: 'uk',
      startDate: item.deadline,
      eventAttendanceMode: isOnline
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: isOnline
        ? { '@type': 'VirtualLocation', url: item.source_url || url }
        : {
            '@type': 'Place',
            name: (item.cities || []).find((c) => c && c !== 'Вся Україна') || 'Україна',
            address: { '@type': 'PostalAddress', addressCountry: 'UA' },
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
          availability: 'https://schema.org/InStock',
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
  const isClosed = item.status === 'closed';
  // Для закритої можливості structured data не віддаємо: Google не має
  // показувати її як активний курс чи подію в rich results.
  const jsonLd = isClosed ? null : buildJsonLd(item);
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
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <div className="container">
        <nav className="opportunity-breadcrumbs">
          <Link href="/">← Усі можливості</Link>
        </nav>

        {isClosed ? (
          <div className="closed-banner" role="status">
            <span className="closed-banner-icon" aria-hidden="true">🔒</span>
            <div>
              <strong>Ця можливість уже завершилась.</strong>{' '}
              {ANNUAL_TYPES.has(item.opportunity_type)
                ? 'Такі програми зазвичай відкриваються щороку — стежте за оновленнями, ми повідомимо, коли почнеться новий набір.'
                : 'Подача заявок закрита, сторінку лишили для довідки.'}{' '}
              <Link href="/">Подивитись актуальні можливості →</Link>
            </div>
          </div>
        ) : null}

        <article className={`opportunity-page${isClosed ? ' opportunity-page-closed' : ''}`}>
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
            {item.deadline ? (
              <>
                <dt>Дедлайн</dt>
                <dd>{formatDate(item.deadline)}</dd>
              </>
            ) : item.recurrence ? (
              <>
                <dt>Подача</dt>
                <dd>{item.recurrence === 'annual' ? 'Щорічно — стежте за новим набором' : 'Постійно відкрита'}</dd>
              </>
            ) : null}
            {item.price_note && (
              <>
                <dt>Вартість</dt>
                <dd>{item.price_note}</dd>
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
            {verifiedLabel(item) && (
              <>
                <dt>Перевірено</dt>
                <dd>✅ {verifiedLabel(item)}</dd>
              </>
            )}
          </dl>

          <div className="opportunity-actions">
            {item.source_url && (
              <OutboundCta href={item.source_url} title={item.title} />
            )}
            {item.deadline && (
              <Link href={addToCalendarPageUrl(item.slug).replace('https://dityam.com.ua', '')} className="cal-btn">
                📅 Додати в календар
              </Link>
            )}
          </div>
        </article>

        <Details text={item.details} />

        <OutcomeForm opportunityId={item.id} title={item.title} />

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

      {/* 53% сесій приземляються одразу на сторінку можливості (285 із 421
          органічних за місяць) — і донедавна жодна з них не бачила пропозиції
          підписатись: підказка стояла тільки на головній, тематичних і
          міських сторінках. */}
      <SubscribePopup />
    </>
  );
}
