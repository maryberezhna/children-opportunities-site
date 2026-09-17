/**
 * Сторінка можливості — спільна для української та англійської версій.
 *
 * Донедавна вона жила цілком у app/o/[slug]/page.js. Англійський маршрут
 * /en/o/[slug] потребує рівно того самого: тих самих даних, тієї самої
 * розмітки, тих самих structured data — різняться лише підписи, адреси й
 * мова. Копія розійшлася б з оригіналом за місяць, як уже сталося зі
 * списком підбірок у футері, тож усе спільне лежить тут, а маршрути
 * лишаються тонкими обгортками.
 */
import Link from 'next/link';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { daysUntil, kyivToday, formatDate, formatEventDates } from '@/lib/dates';
import { isoWeek } from '@/lib/week';
import {
  TYPE_LABELS, TYPE_LABELS_EN, AID_TYPE_LABELS, AID_TYPE_LABELS_EN,
  NEED_LABELS_EN, ANNUAL_TYPES, cityLabel, formatLabel,
} from '@/lib/labels';
import Details from './[slug]/Details';
import OutboundCta from './[slug]/OutboundCta';
import ShareButton from './[slug]/ShareButton';
import { plural } from '@/lib/plural';
import { TAG_COLORS, TAG_FALLBACK } from '@/lib/tag-colors';
import SubscribePopup from '../SubscribePopup';
import TelegramSubscribeBlock from '../TelegramSubscribeBlock';

const SITE = 'https://dityam.com.ua';
const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

const NEED_LABELS = {
  gifted: 'обдаровані',
  disability: 'інвалідність',
  autism: 'РАС',
  idp: 'ВПО',
  veteran_family: 'діти захисників',
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
  // Платне називаємо платним: «Доступно» і «Преміум» описували ціну словами,
  // які нічого не коштують — людина читала «доступно» й дізнавалась про суму
  // вже на сайті організатора. Саму суму, якщо вона відома, показує сусідній
  // рядок «Вартість» із price_note.
  uk: {
    free: 'Безкоштовно',
    paid_affordable: 'Платно',
    paid_premium: 'Платно',
    closed: 'Закрита подача',
  },
  en: {
    free: 'Free',
    paid_affordable: 'Paid',
    paid_premium: 'Paid',
    closed: 'Applications closed',
  },
};

const COURSE_TYPES = new Set(['course', 'olympiad', 'club', 'exchange', 'study_abroad', 'scholarship', 'internship']);
const EVENT_TYPES = new Set(['camp', 'festival', 'sport_event', 'competition']);

const L = {
  uk: {
    back: '← Усі можливості',
    closedTitle: 'Ця можливість уже завершилась.',
    closedAnnual: 'Ця програма відкривається знову щосезону. Ми перевіримо, коли почнеться новий набір, — і сторінка знову стане активною.',
    closedOnce: 'Подача заявок закрита, сторінку лишили для довідки.',
    closedLink: 'Подивитись актуальні можливості →',
    stateAid: 'держдопомога',
    free: 'безкоштовно',
    paid: 'платно',
    topWeek: '⭐ Топ тижня',
    format: 'Формат',
    when: 'Коли',
    deadline: 'Заявки до',
    apply: '📝 Подати заявку',
    applications: 'Подача',
    annual: 'Щорічно — стежте за новим набором',
    ongoing: 'Постійно відкрита',
    cost: 'Вартість',
    city: 'Місто',
    source: 'Джерело',
    verified: 'Перевірено',
    relatedTitle: (age) => `Схожі можливості для дітей ${age}`,
    today: 'сьогодні',
    yesterday: 'вчора',
    notFound: 'Можливість не знайдена',
    siteName: 'Можливості для дитини',
    share: 'Поділитися ↗',
    copied: 'Посилання скопійовано',
    apply: 'Подати заявку ↗',
    support: 'Підтримати dityam.com.ua',
    requirement: 'Треба',
    daysLeft: (n) => (n === 0 ? 'сьогодні' : `${n} ${plural(n, 'день', 'дні', 'днів')}`),
  },
  en: {
    back: '← All opportunities',
    closedTitle: 'This opportunity has ended.',
    closedAnnual: 'This programme opens again each season. We check when the next intake starts, and this page becomes active again.',
    closedOnce: 'Applications are closed; the page is kept for reference.',
    closedLink: 'See current opportunities →',
    stateAid: 'state aid',
    free: 'free',
    paid: 'paid',
    topWeek: '⭐ Pick of the week',
    format: 'Format',
    when: 'When',
    deadline: 'Apply by',
    apply: '📝 Apply',
    applications: 'Applications',
    annual: 'Every year — watch for the next intake',
    ongoing: 'Always open',
    cost: 'Cost',
    city: 'City',
    source: 'Source',
    verified: 'Checked',
    relatedTitle: (age) => `Similar opportunities for children ${age}`,
    today: 'today',
    yesterday: 'yesterday',
    notFound: 'Opportunity not found',
    siteName: 'Opportunities for your child',
    share: 'Share ↗',
    copied: 'Link copied',
    apply: 'Apply ↗',
    support: 'Support dityam.com.ua',
    requirement: 'You need',
    daysLeft: (n) => (n === 0 ? 'today' : `${n} ${n === 1 ? 'day' : 'days'}`),
  },
};

const strings = (lang) => L[lang] || L.uk;

// Періодична — за видом, прочитаним із тексту (з 17.09.2026). Поки вид не
// визначено, лишається стара підказка за типом.
const isPeriodic = (item) => (item.timing_kind
  ? item.timing_kind === 'periodic'
  : ANNUAL_TYPES.has(item.opportunity_type));
const typeLabels = (lang) => (lang === 'en' ? TYPE_LABELS_EN : TYPE_LABELS);
const needLabels = (lang) => (lang === 'en' ? NEED_LABELS_EN : NEED_LABELS);
const basePath = (lang) => (lang === 'en' ? '/en' : '');

/** Англійське поле з бази, з відкатом на оригінал: переклад доїжджає партіями. */
export const field = (item, name, lang) =>
  (lang === 'en' && item[`${name}_en`]) || item[name] || '';

// Показуємо 'active' і 'closed'. Архівні — з плашкою «вже завершилась», бо
// посилання на них живуть вічно в постах каналу, діджестах і видачі Google:
// раніше кожна заархівована можливість перетворювала свій URL на 404.
// Чернетки з черги модерації ('draft'/'pending') не показуємо ніколи.
const PUBLIC_STATUSES = new Set(['active', 'closed']);

export async function getOpportunity(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || !PUBLIC_STATUSES.has(data.status)) return null;
  return data;
}

const RELATED_FIELDS =
  'slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, child_needs, title_en, summary_en, featured_week';

export async function getRelated(item, limit = 8) {
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

export async function allActiveSlugs() {
  if (!supabase) return [];
  const { data } = await supabase.from('opportunities')
    .select('slug').eq('status', 'active');
  return (data || []).map((row) => ({ slug: row.slug }));
}

export function ageRangeLabel(item, lang = 'uk') {
  const { age_from: from, age_to: to } = item;
  if (lang === 'en') {
    if (from === to) return `age ${from}`;
    if (from === 0 && to >= 17) return '0–18 yrs';
    return `${from}–${to} yrs`;
  }
  if (from === to) return `${from} років`;
  if (from === 0 && to >= 17) return '0-18 років';
  return `${from}-${to} років`;
}

// «Перевірено сьогодні / вчора / N днів тому» — чесний сигнал свіжості.
// last_verified_at ставить щоденний verify-links (лінк живий), verified_at —
// модератор при схваленні. Понад 30 днів без перевірки — нічого не показуємо,
// стара дата довіри не додає.
export function verifiedLabel(item, lang = 'uk') {
  const ts = item.last_verified_at || item.verified_at;
  if (!ts) return null;
  const date = new Date(ts);
  if (isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0 || days > 30) return null;
  const t = strings(lang);
  if (days === 0) return t.today;
  if (days === 1) return t.yesterday;
  if (lang === 'en') return `${days} days ago`;
  const lastDigit = days % 10;
  const teens = days % 100 >= 11 && days % 100 <= 14;
  const word = !teens && lastDigit === 1 ? 'день'
    : !teens && lastDigit >= 2 && lastDigit <= 4 ? 'дні' : 'днів';
  return `${days} ${word} тому`;
}

// Google обрізає сніпет приблизно на 160 символах — усе довше не побачать.
const DESC_MAX = 158;

// Те саме правило й у сніпеті для Google: «доступна вартість» у видачі — це
// обіцянка, яку сторінка не виконує. Люди шукають «… ціна» саме тому, що
// хочуть знати, скільки це коштує, — «платно» відповідає, «доступно» ні.
const COST_DESC = {
  uk: {
    free: 'безкоштовно',
    paid_affordable: 'платно',
    paid_premium: 'платно',
  },
  en: {
    free: 'free',
    paid_affordable: 'paid',
    paid_premium: 'paid',
  },
};

// Сніпет має відповідати на запит, а не переказувати початок опису.
//
// Search Console показує, що люди шукають конкретику — «соколята табір ЦІНА»,
// «олімпіада з математики 2026» — і сторінка з 1029 показів набирає 0.9% CTR,
// бо в сніпеті нічого з цього немає. Тому спершу ставимо факти, за якими
// шукають (вік · вартість · місце · дедлайн), і лише потім — опис, скільки
// влізе в залишок.
function buildDescription(item, typeLabel, ageRange, lang) {
  const en = lang === 'en';
  const facts = [en ? `${typeLabel} for children ${ageRange}` : `${typeLabel} для дітей ${ageRange}`];

  // Жива ціна б'є категорію: за запитами «… ціна» ми показувались і не
  // отримували кліків, бо «з фінансуванням» на питання про суму не відповідає.
  if (item.price_note) facts.push(String(item.price_note).trim());
  else if ((COST_DESC[lang] || COST_DESC.uk)[item.cost_type]) {
    facts.push((COST_DESC[lang] || COST_DESC.uk)[item.cost_type]);
  }

  // «Вся Україна» нічого не додає до сніпета — беремо конкретне місто,
  // інакше формат (онлайн / офлайн).
  const rawPlace =
    (item.cities || []).find((c) => c && c !== 'Вся Україна') || item.format;
  if (rawPlace) facts.push(String(cityLabel(rawPlace, lang)).trim());

  // Для закритої — чесний факт замість простроченого «заявки до …».
  if (item.status === 'closed') {
    // «Стежимо за наступним» — лише для періодичних: одноразова вже не
    // повториться, і обіцяти їй наступний набір — неправда.
    facts.push(isPeriodic(item)
      ? (en ? 'intake closed, we’re watching for the next one' : 'набір закрито, стежимо за наступним')
      : (en ? 'applications closed' : 'подачу закрито'));
  } else {
    const deadline = formatDate(item.deadline, lang);
    if (deadline) facts.push(en ? `apply by ${deadline}` : `заявки до ${deadline}`);
  }

  const head = facts.join(' · ');
  const summary = String(field(item, 'summary', lang)).trim();
  if (!summary) return head.slice(0, DESC_MAX);

  // Дописуємо опис лише якщо лишається місце на осмислений шматок.
  const room = DESC_MAX - head.length - 2;
  if (room < 40) return head.slice(0, DESC_MAX);

  const tail = summary.length > room
    ? `${summary.slice(0, room - 1).replace(/[\s,;–—-]+$/, '')}…`
    : summary;
  return `${head}. ${tail}`;
}

export function buildMetadata(item, lang = 'uk') {
  const t = strings(lang);
  if (!item) return { title: t.notFound };

  const base = basePath(lang);
  const en = lang === 'en';

  // Дубль: canonical на основну сторінку. Саме canonical, а НЕ noindex —
  // noindex каже Google викинути сторінку, canonical каже склеїти сигнали
  // з основною. Разом вони суперечливі, і склейки не відбувається.
  if (item.canonical_slug && item.canonical_slug !== item.slug) {
    return {
      title: field(item, 'title', lang),
      description: field(item, 'summary', lang) || undefined,
      alternates: { canonical: `${SITE}${base}/o/${item.canonical_slug}` },
    };
  }

  // Закриті сторінки НЕ ховаємо від Google. Серед них щорічні програми
  // (табори, конкурси), що накопичили позиції за рік — noindex викидав би
  // цей капітал перед кожним новим набором. Плашка «завершилась» на сторінці
  // чесно каже людині, що подача закрита.
  const typeLabel = typeLabels(lang)[item.opportunity_type] || '';
  const ageRange = en
    ? (item.age_from === 0 && item.age_to >= 17 ? '0–18 yrs' : `${item.age_from}–${item.age_to} yrs`)
    : (item.age_from === 0 && item.age_to >= 17 ? '0-18 років' : `${item.age_from}-${item.age_to} років`);

  const name = field(item, 'title', lang);
  const title = en
    ? `${name} — ${typeLabel} for children ${ageRange}`
    : `${name} — ${typeLabel} для дітей ${ageRange}`;
  const url = `${SITE}${base}/o/${item.slug}`;
  const description = buildDescription(item, typeLabel, ageRange, lang);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      // Дві мовні версії однієї сторінки: hreflang склеює їх для Google,
      // інакше англійська виглядає як дубль української й конкурує з нею.
      languages: {
        uk: `${SITE}/o/${item.slug}`,
        en: `${SITE}/en/o/${item.slug}`,
      },
    },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: t.siteName,
      locale: en ? 'en_US' : 'uk_UA',
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

function buildJsonLd(item, lang) {
  const base = basePath(lang);
  const url = `${SITE}${base}/o/${item.slug}`;
  const isFree = item.cost_type === 'free';
  const inLanguage = lang === 'en' ? 'en' : 'uk';
  const name = field(item, 'title', lang);
  const description = field(item, 'summary', lang);

  if (COURSE_TYPES.has(item.opportunity_type)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name,
      description,
      url,
      inLanguage,
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

  // Event — лише коли відома дата ПРОВЕДЕННЯ. Google вимагає startDate, і
  // 27 сторінок без неї висіли в Search Console помилкою.
  //
  // Раніше сюди підставлявся item.deadline — тобто Google ми називали днем
  // початку події останній день подачі заявок. Для сесії ЄМП у Мальме це
  // означало «подія 17 вересня» замість справжніх 6–8 листопада.
  // Без справжньої дати проведення чесніше віддати WebPage, ніж вигадати
  // подію на день дедлайну.
  const eventStart = item.event_start_date || null;
  if (EVENT_TYPES.has(item.opportunity_type) && eventStart) {
    const isOnline = /онлайн|online/i.test(item.format || '');
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name,
      description,
      url,
      inLanguage,
      startDate: eventStart,
      ...(item.event_end_date ? { endDate: item.event_end_date } : {}),
      eventAttendanceMode: isOnline
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: isOnline
        ? { '@type': 'VirtualLocation', url: item.source_url || url }
        : {
            '@type': 'Place',
            name: cityLabel(
              (item.cities || []).find((c) => c && c !== 'Вся Україна')
                || (lang === 'en' ? 'Ukraine' : 'Україна'),
              lang,
            ),
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
    name,
    description,
    url,
    inLanguage,
  };
}

export default function OpportunityView({ item, related, lang = 'uk' }) {
  const t = strings(lang);
  const base = basePath(lang);
  const TYPES = typeLabels(lang);
  const NEEDS = needLabels(lang);
  const AIDS = lang === 'en' ? AID_TYPE_LABELS_EN : AID_TYPE_LABELS;
  const COSTS = COST_LABELS[lang] || COST_LABELS.uk;
  const isClosed = item.status === 'closed';
  // Для закритої можливості structured data не віддаємо: Google не має
  // показувати її як активний курс чи подію в rich results.
  const jsonLd = isClosed ? null : buildJsonLd(item, lang);
  const today = kyivToday();
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: lang === 'en' ? 'Home' : 'Головна',
        item: `${SITE}${base}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: TYPES[item.opportunity_type] || (lang === 'en' ? 'Opportunity' : 'Можливість'),
        item: `${SITE}${base}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: field(item, 'title', lang),
        item: `${SITE}${base}/o/${item.slug}`,
      },
    ],
  };

  const needs = (item.child_needs || []).filter((n) => NEEDS[n]);
  // Мова конкретного тексту: доки перекладу для запису немає, показуємо
  // оригінал — і чесно позначаємо його як українську, щоб екранний читач не
  // читав її з англійською вимовою.
  const titleLang = lang === 'en' && !item.title_en ? 'uk' : undefined;
  const summaryLang = lang === 'en' && !item.summary_en ? 'uk' : undefined;
  const detailsText = field(item, 'details', lang);
  const detailsLang = lang === 'en' && !item.details_en ? 'uk' : undefined;

  // Мобільна верстка (≤900px, референс 6d): дедлайн окремим блоком одразу
  // під назвою і прибита знизу панель «Подати заявку». Розмітка лежить
  // поруч із десктопною, перемикає її home-mobile/opportunity-mobile.css.
  const [tagBg, tagFg] = TAG_COLORS[item.opportunity_type] || TAG_FALLBACK;
  const deadlineDays = item.deadline ? daysUntil(item.deadline, today) : null;
  const showDeadlineBlock = Boolean(item.deadline) && !isClosed;
  // «Коли відбувається» живе окремо від «до коли подати»: у записі можуть
  // бути обидві дати, одна з них або жодної.
  const eventDates = formatEventDates(item, lang);
  const showBar = Boolean(item.source_url) && !isClosed;

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <div className={`container${showBar ? ' o-has-bar' : ''}`} lang={lang}>
        <nav className="opportunity-breadcrumbs">
          <Link href={base || '/'}>{t.back}</Link>
          <ShareButton
            className="o-share"
            title={field(item, 'title', lang)}
            label={t.share}
            copiedLabel={t.copied}
          />
        </nav>

        {isClosed ? (
          <div className="closed-banner" role="status">
            <span className="closed-banner-icon" aria-hidden="true">🔒</span>
            {/* Заголовок, пояснення і дія — три окремі блоки, а не один
                абзац. Доки посилання стояло всередині речення, воно
                читалось як його хвіст, а не як кнопка. */}
            <div className="closed-banner-body">
              <strong>{t.closedTitle}</strong>
              <p>{isPeriodic(item) ? t.closedAnnual : t.closedOnce}</p>
              <Link href={base || '/'}>{t.closedLink}</Link>
            </div>
          </div>
        ) : null}

        <article className={`opportunity-page${isClosed ? ' opportunity-page-closed' : ''}`}>
          <div className="opportunity-chips">
            {item.featured_week === isoWeek()
              ? <span className="chip chip-top">{t.topWeek}</span> : null}
            <span className="chip chip-type">{TYPES[item.opportunity_type] || item.opportunity_type}</span>
            {item.aid_type ? <span className="chip chip-aid">🏛 {AIDS[item.aid_type] || t.stateAid}</span> : null}
            <span className="chip chip-age">{ageRangeLabel(item, lang)}</span>
            {item.cost_type === 'free' ? <span className="chip chip-free">{t.free}</span> : null}
            {item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium'
              ? <span className="chip chip-paid">{t.paid}</span> : null}
            {needs.map((n) => (
              <span key={n} className="chip chip-need">{NEEDS[n]}</span>
            ))}
          </div>

          <div className="o-m-meta">
            <span className="v2-tag" style={{ background: tagBg, color: tagFg }}>
              {TYPES[item.opportunity_type] || item.opportunity_type}
            </span>
            <span>{ageRangeLabel(item, lang)}</span>
            {item.cost_type && COSTS[item.cost_type] ? (
              <>
                <span className="o-m-sep" aria-hidden="true">·</span>
                <span>{COSTS[item.cost_type]}</span>
              </>
            ) : null}
            {needs.map((n) => (
              <span key={n}><span className="o-m-sep" aria-hidden="true">· </span>{NEEDS[n]}</span>
            ))}
          </div>

          <h1 className="opportunity-title" lang={titleLang}>{field(item, 'title', lang)}</h1>

          {showDeadlineBlock ? (
            <div className="o-m-deadline">
              <div>
                <span className="o-m-eyebrow">{t.deadline}</span>
                <span className="o-m-date">{formatDate(item.deadline, lang)}</span>
              </div>
              {deadlineDays !== null && deadlineDays >= 0 ? (
                <span className={`o-m-days${deadlineDays <= 7 ? ' is-urgent' : ''}`}>
                  {deadlineDays <= 7 ? '⏰' : '⏳'} {t.daysLeft(deadlineDays)}
                </span>
              ) : null}
            </div>
          ) : null}
          {field(item, 'summary', lang) ? (
            <p className="opportunity-summary" lang={summaryLang}>{field(item, 'summary', lang)}</p>
          ) : null}

          <dl className="opportunity-meta">
            {formatLabel(item.format, lang) && (
              <>
                <dt>{t.format}</dt>
                <dd>{formatLabel(item.format, lang)}</dd>
              </>
            )}
            {(item.cities || []).length > 0 && (
              <>
                <dt>{t.city}</dt>
                <dd>{item.cities.map((c) => cityLabel(c, lang)).join(', ')}</dd>
              </>
            )}
            {eventDates ? (
              <>
                <dt>{t.when}</dt>
                <dd>{eventDates}</dd>
              </>
            ) : null}
            {item.deadline ? (
              <>
                <dt className={showDeadlineBlock ? 'o-dl-deadline' : undefined}>{t.deadline}</dt>
                <dd className={showDeadlineBlock ? 'o-dl-deadline' : undefined}>{formatDate(item.deadline, lang)}</dd>
              </>
            ) : item.recurrence ? (
              <>
                <dt>{t.applications}</dt>
                <dd>{item.recurrence === 'annual' ? t.annual : t.ongoing}</dd>
              </>
            ) : null}
            {/* Один рядок «Вартість»: категорія і, якщо відомо, сума словами.
                Коли 16.09.2026 перерозмітка заповнила price_note на ~260
                сторінках, два окремі рядки з однаковим підписом стояли підряд:
                «Вартість: €100 — включає проживання…» і «Вартість: Платно». */}
            {(item.cost_type || item.price_note) && (
              <>
                <dt>{t.cost}</dt>
                <dd>
                  {[item.cost_type && (COSTS[item.cost_type] || item.cost_type), item.price_note]
                    .filter(Boolean)
                    .join(' — ')}
                </dd>
              </>
            )}
            {item.teen_requirement ? (
              <>
                <dt className="o-m-only">{t.requirement}</dt>
                <dd className="o-m-only">{item.teen_requirement}</dd>
              </>
            ) : null}
            {item.source && (
              <>
                <dt>{t.source}</dt>
                <dd>
                  {item.source_url ? (
                    <>
                      <span className="o-d-only">{item.source}</span>
                      <a className="o-m-only" href={item.source_url} target="_blank" rel="noopener noreferrer">
                        {item.source} ↗
                      </a>
                    </>
                  ) : item.source}
                </dd>
              </>
            )}
            {verifiedLabel(item, lang) && (
              <>
                <dt>{t.verified}</dt>
                <dd>✅ {verifiedLabel(item, lang)}</dd>
              </>
            )}
          </dl>

          <div className="opportunity-actions">
            {item.source_url && (
              <OutboundCta href={item.source_url} title={item.title} lang={lang} />
            )}
            {/* Пряме посилання на подачу, коли воно відоме й відрізняється від
                адреси джерела. У пості про сесію ЄМП у Мальме це була
                Google-форма — єдине, що людині насправді потрібне, і саме
                воно не зберігалось, бо колонки для нього не існувало. */}
            {item.apply_url && item.apply_url !== item.source_url && (
              <a
                href={item.apply_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="cal-btn"
              >
                {t.apply}
              </a>
            )}
          </div>
        </article>

        <div lang={detailsLang} className={isClosed ? 'closed-dim' : undefined}>
          <Details text={detailsText} />
        </div>

        <TelegramSubscribeBlock place="detail_page" lang={lang} />


        {related.length > 0 && (
          <section className="opportunity-related" aria-labelledby="related-heading">
            <h2 id="related-heading" className="opportunity-related-title">
              {t.relatedTitle(ageRangeLabel(item, lang))}
            </h2>
            <ul className="opportunity-related-list">
              {related.map((r) => {
                // Той самий календарний розрахунок, що в каталозі: різниця
                // від часового поясу сервера не залежить.
                const days = daysUntil(r.deadline, today);
                const rNeeds = (r.child_needs || []).filter((n) => NEEDS[n]);
                const rSummary = field(r, 'summary', lang);
                return (
                  <li key={r.slug}>
                    <Link href={`${base}/o/${r.slug}`} className="card" style={{ textDecoration: 'none' }}>
                      <div className="chips">
                        <span className="chip chip-type">{TYPES[r.opportunity_type] || r.opportunity_type}</span>
                        <span className="chip chip-age">{ageRangeLabel(r, lang)}</span>
                        {r.cost_type === 'free' && <span className="chip chip-free">{t.free}</span>}
                        {(r.cost_type === 'paid_affordable' || r.cost_type === 'paid_premium')
                          && <span className="chip chip-paid">{t.paid}</span>}
                        {days !== null && days >= 0 && days <= 7 && (
                          <span className="chip chip-deadline-urgent">
                            ⏰ {days === 0 ? t.today : (lang === 'en' ? `${days} days` : `${days} днів`)}
                          </span>
                        )}
                        {days !== null && days > 7 && days <= 30 && (
                          <span className="chip chip-deadline-soon">
                            ⏳ {lang === 'en' ? `${days} days` : `${days} днів`}
                          </span>
                        )}
                        {rNeeds.slice(0, 2).map((n) => (
                          <span key={n} className="chip chip-need">{NEEDS[n]}</span>
                        ))}
                      </div>
                      <h3
                        className="card-title-link"
                        lang={lang === 'en' && !r.title_en ? 'uk' : undefined}
                        style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35, color: 'var(--ink)' }}
                      >
                        {field(r, 'title', lang)}
                      </h3>
                      {rSummary && (
                        <p className="card-summary" lang={lang === 'en' && !r.summary_en ? 'uk' : undefined}>
                          {rSummary.length > 140 ? `${rSummary.slice(0, 140)}…` : rSummary}
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

      {showBar ? (
        <div className="o-m-bar">
          <a
            href={MONOBANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="o-m-heart"
            aria-label={t.support}
          >
            <span aria-hidden="true">🧡</span>
          </a>
          <OutboundCta
            href={item.source_url}
            title={item.title}
            lang={lang}
            className="o-m-apply"
            place="detail_page_bar"
          >
            {t.apply}
          </OutboundCta>
        </div>
      ) : null}

      {/* 53% сесій приземляються одразу на сторінку можливості (285 із 421
          органічних за місяць) — і донедавна жодна з них не бачила пропозиції
          підписатись: підказка стояла тільки на головній, тематичних і
          міських сторінках. */}
      <SubscribePopup />
    </>
  );
}
