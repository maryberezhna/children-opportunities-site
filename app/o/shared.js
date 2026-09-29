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
import { kyivToday, formatDate } from '@/lib/dates';
import { isoWeek } from '@/lib/week';
import {
  TYPE_LABELS, TYPE_LABELS_EN, AID_TYPE_LABELS, AID_TYPE_LABELS_EN,
  NEED_LABELS, NEED_LABELS_EN, ANNUAL_TYPES, cityLabel, PAYMENT_TYPES,
  ageRangeLabel,
} from '@/lib/labels';
// Реекспорт: /en/o/[slug] бере ageRangeLabel саме звідси.
export { ageRangeLabel };
import Details from './[slug]/Details';
import OutboundCta from './[slug]/OutboundCta';
import ShareButton from './[slug]/ShareButton';
import ReportButton from './[slug]/ReportButton';
import { plural } from '@/lib/plural';
import { topicOf, topicPath } from '@/lib/topics';
import { intakeStatus, pageFacts, applicantConditions } from '@/lib/opportunity-facts';
import SubscribePopup from '../SubscribePopup';
import TelegramSubscribeBlock from '../TelegramSubscribeBlock';
import Footer from '../Footer';
import OpportunityCard from '../OpportunityCard';
import { ERASMUS_PATH, isErasmus } from '@/lib/erasmus';
// Чужий Telegram-канал не показуємо ні кнопкою, ні «Джерелом», ні в розмітці
// (Марія, 27.09.2026) — див. lib/source-link.js.
import { publicSource } from '@/lib/source-link';

const SITE = 'https://dityam.com.ua';


const COST_LABELS = {
  // Платне називаємо платним: «Доступно» і «Преміум» описували ціну словами,
  // які нічого не коштують — людина читала «доступно» й дізнавалась про суму
  // вже на сайті організатора. Саму суму, якщо вона відома, показує сусідній
  // рядок «Вартість» із price_note.
  uk: {
    free: 'Безкоштовно',
    paid_affordable: 'Платно',
    paid_premium: 'Платно',
    // Школа чи студія діаспори без ціни на сторінці (28.09.2026).
    ask_school: 'Вартість уточнюйте в школі',
    closed: 'Закрита подача',
  },
  en: {
    free: 'Free',
    paid_affordable: 'Paid',
    paid_premium: 'Paid',
    ask_school: 'Ask the school about the price',
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
    results: 'Результати',
    deadline: 'Заявки до',
    applications: 'Подача',
    annual: 'Щорічно — стежте за новим набором',
    ongoing: 'Постійно відкрита',
    cost: 'Вартість',
    city: 'Місто',
    country: 'Країна',
    source: 'Джерело',
    verified: 'Перевірено',
    linkAlive: 'Посилання працює',
    relatedTitle: (age) => `Схожі можливості для дітей ${age}`,
    today: 'сьогодні',
    yesterday: 'вчора',
    notFound: 'Можливість не знайдена',
    siteName: 'Можливості для дитини',
    share: 'Поділитися ↗',
    copied: 'Посилання скопійовано',
    apply: 'Подати заявку ↗',
    // Гурток: до нього не «подаються», а записуються — і форма їхня, не наша.
    applyClub: 'Записатися на сайті гуртка ↗',
    applyClubShort: 'Записатися ↗',
    support: 'Підтримати dityam.com.ua',
    requirement: 'Треба',
    // Редизайн сторінки (29.09.2026, макет Opportunity.dc.html).
    home: 'Головна',
    officialSite: 'Офіційний сайт ↗',
    goSite: 'Перейти до офіційного сайту ↗',
    goSiteShort: 'На сайт організатора ↗',
    shareWith: 'Поділитися з іншим батьком',
    whoCan: 'Хто може подати заявку',
    checkedOn: (d) => `Перевірено ${d}`,
    linkCheckedOn: (d) => `Посилання перевірено ${d}`,
    sourceWord: 'джерело',
    report: 'Щось не так? Повідомити',
    reported: 'Дякуємо, перевіримо.',
    reportMore: 'Написати, що саме не так →',
    similar: 'Схожі можливості',
    allOf: (name) => `Уся підбірка «${name}» →`,
    allHome: 'Усі можливості →',
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
    results: 'Results',
    deadline: 'Apply by',
    applications: 'Applications',
    annual: 'Every year — watch for the next intake',
    ongoing: 'Always open',
    cost: 'Cost',
    city: 'City',
    country: 'Country',
    source: 'Source',
    verified: 'Checked',
    linkAlive: 'Link works',
    relatedTitle: (age) => `Similar opportunities for children ${age}`,
    today: 'today',
    yesterday: 'yesterday',
    notFound: 'Opportunity not found',
    siteName: 'Opportunities for your child',
    share: 'Share ↗',
    copied: 'Link copied',
    apply: 'Apply ↗',
    applyClub: 'Sign up on the club’s site ↗',
    applyClubShort: 'Sign up ↗',
    support: 'Support dityam.com.ua',
    requirement: 'You need',
    home: 'Home',
    officialSite: 'Official site ↗',
    goSite: 'Go to the official site ↗',
    goSiteShort: 'Organiser’s site ↗',
    shareWith: 'Share with another parent',
    whoCan: 'Who can apply',
    checkedOn: (d) => `Checked ${d}`,
    linkCheckedOn: (d) => `Link checked ${d}`,
    sourceWord: 'source',
    report: 'Something wrong? Report',
    reported: 'Thank you, we will check.',
    reportMore: 'Tell us what is wrong →',
    similar: 'Similar opportunities',
    allOf: (name) => `All in “${name}” →`,
    allHome: 'All opportunities →',
    daysLeft: (n) => (n === 0 ? 'today' : `${n} ${n === 1 ? 'day' : 'days'}`),
  },
};

const strings = (lang) => L[lang] || L.uk;

// Періодична — за видом, прочитаним із тексту (з 17.09.2026). Поки вид не
// визначено, лишається стара підказка за типом.
const isPeriodic = (item) => (item.timing_kind
  ? item.timing_kind === 'periodic'
  : ANNUAL_TYPES.has(item.opportunity_type));

// «Подача» без дедлайну: щороку чи постійно. З виду, прочитаного з тексту;
// поки вид не визначено — зі старого recurrence. Одноразова без дедлайну —
// нічого не пишемо: вигадувати «постійно відкрита» не можна.
// Одноденна подія з дедлайном того ж дня: «Коли: 19 вересня» і «Заявки до:
// 19 вересня» поруч читаються як повтор — показуємо лише «Коли».
const sameDayAsEvent = (item) => Boolean(item.deadline
  && item.event_start_date === item.deadline
  && (item.event_end_date || item.event_start_date) === item.deadline);

const applicationsNote = (item) => {
  if (item.timing_kind === 'periodic') return 'periodic';
  if (item.timing_kind === 'permanent') return 'permanent';
  if (item.timing_kind === 'one_time') return null;
  if (item.recurrence === 'annual') return 'periodic';
  if (item.recurrence === 'ongoing') return 'permanent';
  return null;
};
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

// 'archived' (з 21.09.2026) — прибрані записи, яких ми не змогли підтвердити:
// 421 гурток із довідників gurtok.org і «Школяр», де немає жодної дати, а
// сайту організатора не знайти (scraper/audit_clubs.py). Сторінку не
// показуємо, але й не 404 з тієї ж причини, що вище: людина з посту чи
// Google потрапляє на платформу. Переадресація тимчасова — браузер не
// запамʼятовує її, і повернений з архіву запис знову відкривається.
export const isArchived = (item) => item?.status === 'archived';

export async function getOpportunity(slug) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  // Помилка бази — виняток, а не «такої картки немає». Картки збираються на
  // запит, і null тут став би 404, закешованим на годину (14.09.2026 Supabase
  // тримав 502/504 довше). Виняток дає 500, а його Next не кешує: наступний
  // відвідувач отримає або стару копію, або нову спробу.
  if (error) throw new Error(`getOpportunity(${slug}): ${error.message}`);
  if (data?.status === 'archived') return { status: 'archived' };
  if (!data || !PUBLIC_STATUSES.has(data.status)) return null;
  return data;
}

// Ті самі поля, що потрібні картці в каталозі (варіант B показує дедлайн,
// вартість, формат із місцем і організатора): без них «схожі» стояли б
// порожнішими за ту саму картку на головній.
const RELATED_FIELDS =
  'slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, child_needs, title_en, summary_en, featured_week, '
  + 'source, source_url, format, cities, countries, is_international, event_start_date, event_end_date, results_date, timing_kind';

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


// «Перевірено сьогодні / вчора / N днів тому» — чесний сигнал свіжості.
//
// Три різні перевірки — і обіцяти можна лише ту, що справді сталась:
//   verified_at         — людина відкрила запис і схвалила;
//   content_checked_at  — планова перевірка прочитала сторінку й зрозуміла стан набору;
//   last_verified_at    — щоденний пінг: адреса відповідає, і тільки це.
// До 20.09.2026 «Перевірено» бралось із пінга, тож на всіх 1100 записах стояло
// «сьогодні» — слово обіцяло більше, ніж було зроблено. Тепер пінг має власний
// підпис («Посилання працює»), а «Перевірено» лишається для двох перших.
export function verifiedKind(item) {
  if (item.verified_at || item.content_checked_at) return 'checked';
  return item.last_verified_at ? 'link' : null;
}

export function verifiedLabel(item, lang = 'uk') {
  const ts = item.verified_at || item.content_checked_at || item.last_verified_at;
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
    ask_school: 'вартість уточнюйте в школі',
  },
  en: {
    free: 'free',
    paid_affordable: 'paid',
    paid_premium: 'paid',
    ask_school: 'ask the school about the price',
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
    (item.cities || []).find((c) => c && c !== 'Вся Україна')
    || (PAYMENT_TYPES.includes(item.opportunity_type) ? null : item.format);
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
  const src = publicSource(item);
  const base = basePath(lang);
  const url = `${SITE}${base}/o/${item.slug}`;
  const isFree = item.cost_type === 'free';
  // Закритий запис лишається в індексі (сторінка з плашкою — це і є відповідь
  // людині, яка прийшла з пошуку), але має бути машинно позначений як
  // завершений: інакше Google показує його як чинну можливість.
  // Дату не вигадуємо: у 275 із 475 закритих записів її немає взагалі, і тоді
  // лишається сама позначка «набір закрито» без validThrough.
  const isClosed = item.status === 'closed';
  const endedOn = item.deadline || item.event_end_date || item.event_start_date || null;
  const offerState = isClosed
    ? { availability: 'https://schema.org/SoldOut', ...(endedOn ? { validThrough: endedOn } : {}) }
    : { availability: 'https://schema.org/InStock' };
  const inLanguage = lang === 'en' ? 'en' : 'uk';
  const name = field(item, 'title', lang);
  const description = field(item, 'summary', lang);
  // Дати життя запису — у самій розмітці, а не лише в OpenGraph.
  //
  // Головний аргумент каталогу — що дані актуальні, але машині це ніде не
  // було сказано: і пошук, і AI-асистенти охочіше цитують сторінку, дату
  // якої видно. dateModified беремо з updated_at — він оновлюється і при
  // ручній перевірці, і при перевірці дедлайнів.
  const dates = {
    ...(item.created_at && { datePublished: String(item.created_at).slice(0, 10) }),
    ...(item.updated_at && { dateModified: String(item.updated_at).slice(0, 10) }),
  };

  if (COURSE_TYPES.has(item.opportunity_type)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name,
      description,
      url,
      inLanguage,
      ...dates,
      provider: {
        '@type': 'Organization',
        name: src.sourceName || 'dityam.com.ua',
        sameAs: src.sourceUrl || undefined,
      },
      ...((isFree || isClosed) && {
        offers: {
          '@type': 'Offer',
          url,
          ...(isFree ? { price: '0', priceCurrency: 'UAH', category: 'Free' } : {}),
          ...offerState,
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
      ...dates,
      // startDate/endDate — саме дати ПОДІЇ. У версії 13.09.2026 тут стояв
      // item.deadline: подача й проведення тоді ще не були розведені, і
      // Google бачив «подія відбудеться в день дедлайну».
      startDate: eventStart,
      ...(item.event_end_date ? { endDate: item.event_end_date } : {}),
      eventAttendanceMode: isOnline
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: isOnline
        ? { '@type': 'VirtualLocation', url: src.sourceUrl || url }
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
        name: src.sourceName || 'dityam.com.ua',
        url: src.sourceUrl || undefined,
      },
      ...((isFree || isClosed) && {
        offers: {
          '@type': 'Offer',
          url,
          ...(isFree ? { price: '0', priceCurrency: 'UAH' } : {}),
          ...offerState,
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
    ...dates,
    // expires — властивість CreativeWork: «дата, після якої вміст більше не
    // актуальний». Для закритих сторінок без Course/Event це єдина машинна
    // позначка завершення.
    ...(isClosed && endedOn ? { expires: endedOn } : {}),
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
  // Закритий запис теж отримує розмітку — але позначену як завершену
  // (availability SoldOut + validThrough / expires). До 20.09.2026 ми не
  // віддавали нічого: сторінка лишалась в індексі без жодної машинної ознаки,
  // що набір закрито.
  const jsonLd = buildJsonLd(item, lang);
  const today = kyivToday();
  const title = field(item, 'title', lang);

  // Підбірка запису (lib/topics.js): середня крихта, «схожі» з тієї ж
  // підбірки й посилання «Уся підбірка» під ними. Без збігу крихтою лишається
  // тип, як було в BreadcrumbList до редизайну.
  const topic = topicOf(item);
  const topicHref = topic ? topicPath({ slug: topic.slug, slugEn: topic.en.slug }, lang) : null;
  const topicName = topic ? (lang === 'en' ? topic.navEn : topic.nav) : null;
  const crumbName = topicName || TYPES[item.opportunity_type] || (lang === 'en' ? 'Opportunity' : 'Можливість');
  const crumbHref = topicHref || base || '/';
  const inTopic = (r) => { try { return Boolean(topic && topic.match(r)); } catch { return false; } };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE}${base}` },
      { '@type': 'ListItem', position: 2, name: crumbName, item: `${SITE}${topicHref || base}` },
      { '@type': 'ListItem', position: 3, name: title, item: `${SITE}${base}/o/${item.slug}` },
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

  // Куди веде основна кнопка: подача, якщо відома, інакше сторінка джерела.
  // Без прямого посилання на подачу кнопка чесно каже «Перейти до офіційного
  // сайту»: обіцяти подачу на сторінці без форми не можна. Гурток —
  // «Записатися на сайті гуртка» (#574).
  const src = publicSource(item);
  const applyUrl = src.applyUrl;
  const clubSignup = item.opportunity_type === 'club' && Boolean(applyUrl);
  const primaryUrl = src.primaryUrl;
  const showBar = Boolean(primaryUrl) && !isClosed;
  const primaryLabel = applyUrl ? (clubSignup ? t.applyClub : t.apply) : t.goSite;
  const primaryShort = applyUrl ? (clubSignup ? t.applyClubShort : t.apply) : t.goSiteShort;
  const primaryPlace = applyUrl ? 'detail_page_apply' : 'detail_page';
  const primaryRel = applyUrl ? 'noopener noreferrer nofollow' : 'noopener noreferrer';

  // Факти з запису (lib/opportunity-facts.js). Порожнє не показується.
  const status = intakeStatus(item, today, lang);
  const facts = pageFacts(item, today, lang);
  const conditions = applicantConditions(item, lang);
  const factOf = (k) => facts.find((f) => f.key === k)?.value;
  const actionSub = [factOf('cost'), factOf('format'), factOf('age')].filter(Boolean).join(' · ');

  const verified = verifiedLabel(item, lang);
  const verifiedText = verified
    ? (verifiedKind(item) === 'checked' ? t.checkedOn(verified) : t.linkCheckedOn(verified))
    : null;

  // Схожі — три картки, спершу з тієї ж підбірки.
  const similar = [...related.filter(inTopic), ...related.filter((r) => !inTopic(r))].slice(0, 3);

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <div className={`container o-detail${showBar ? ' o-has-bar' : ''}`} lang={lang}>
        {/* «Головна / {підбірка} / {назва}»; на телефоні лишається «← {підбірка}». */}
        <nav className="opportunity-breadcrumbs" aria-label={lang === 'en' ? 'Breadcrumbs' : 'Навігація'}>
          <Link href={base || '/'}>{t.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={crumbHref} className="o-crumb-topic">{crumbName}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="o-crumb-here" lang={titleLang}>{title}</span>
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
          <div className="o-main">
            {/* Вік першим, потім тип — як на картці варіанта B. */}
            <div className="opportunity-chips">
              <span className="chip chip-age">{ageRangeLabel(item, lang)}</span>
              <span className="chip chip-type">{TYPES[item.opportunity_type] || item.opportunity_type}</span>
              {item.aid_type ? <span className="chip chip-aid">🏛 {AIDS[item.aid_type] || t.stateAid}</span> : null}
              {item.cost_type === 'free' ? <span className="chip chip-free">{t.free}</span> : null}
              {item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium'
                ? <span className="chip chip-paid">{t.paid}</span> : null}
              {item.cost_type === 'ask_school'
                ? <span className="chip chip-cost-ask">{COSTS.ask_school}</span> : null}
              {needs.map((n) => (
                <span key={n} className="chip chip-need">{NEEDS[n]}</span>
              ))}
              {item.featured_week === isoWeek()
                ? <span className="chip chip-top">{t.topWeek}</span> : null}
            </div>

            <h1 className="opportunity-title" lang={titleLang}>{title}</h1>

            {/* Телефон: статус прийому заявок першим, одразу під назвою. */}
            {status ? (
              <div className={`o-m-deadline${status.urgent ? ' is-urgent' : ''}`}>
                <div>
                  <span className="o-m-eyebrow">{status.label}</span>
                  <span className="o-m-date">{status.value}</span>
                </div>
                {status.note ? (
                  <span className={`o-m-days${status.urgent ? ' is-urgent' : ''}`}>{status.note}</span>
                ) : null}
              </div>
            ) : null}

            {field(item, 'summary', lang) ? (
              <p className="opportunity-summary" lang={summaryLang}>{field(item, 'summary', lang)}</p>
            ) : null}

            {/* Ключові факти сіткою: 3×2 на десктопі, 2×2 на телефоні. */}
            {facts.length ? (
              <dl className="o-facts">
                {facts.map((f) => (
                  <div key={f.key} className={`o-fact o-fact-${f.key}`}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.urgent ? <span className="o-fact-urgent">{f.value}</span> : f.value}
                      {f.note ? <span className="o-fact-note">{f.note}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {/* Лише з наявних полів: вік, обставини дитини, вимога для підлітка.
                Без обставин і вимог блоку немає — вигадувати умови не можна. */}
            {conditions.length ? (
              <section className="o-who" aria-labelledby="o-who-title">
                <h2 id="o-who-title" className="o-h2">{t.whoCan}</h2>
                <ul className="o-who-list">
                  {conditions.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </section>
            ) : null}

            <div lang={detailsLang} className={`o-body${isClosed ? ' closed-dim' : ''}`}>
              <Details text={detailsText} />
            </div>

            {/* Сторінки обмінів Erasmus+ приводять найбільше людей із пошуку, а
                картка не пояснює, що це за програма. Путівник поки лише
                українською. */}
            {lang === 'uk' && isErasmus(item) ? (
              <p className="o-guide-link">
                <Link href={ERASMUS_PATH}>
                  Вперше про Erasmus+? Путівник: хто з України може поїхати, скільки це коштує і як подати заявку →
                </Link>
              </p>
            ) : null}

            {/* Телефон: панель несе подачу, тож офіційний сайт — посиланням у тексті. */}
            {!isClosed && applyUrl && src.sourceUrl ? (
              <p className="o-m-links">
                <OutboundCta href={src.sourceUrl} title={item.title} id={item.id} lang={lang} className="o-m-link" place="detail_page">
                  {t.officialSite}
                </OutboundCta>
              </p>
            ) : null}

            {/* «Перевірено {дата} · джерело» + «Щось не так? Повідомити». Три
                різні перевірки (див. verifiedKind): обіцяємо лише ту, що
                справді сталась. */}
            {verifiedText || src.sourceName ? (
              <div className="o-verified">
                <span className="o-verified-text">
                  {verifiedText}
                  {verifiedText && src.sourceName ? ' · ' : null}
                  {src.sourceName ? (
                    <>
                      {t.sourceWord}:{' '}
                      {src.sourceUrl
                        ? <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer">{src.sourceName}</a>
                        : src.sourceName}
                    </>
                  ) : null}
                </span>
                <ReportButton
                  id={item.id}
                  slug={item.slug}
                  label={t.report}
                  doneLabel={t.reported}
                  moreLabel={t.reportMore}
                  moreHref={`${base}/contacts?type=error`}
                />
              </div>
            ) : null}
          </div>

          {/* Картка дії: статус великим, одна основна кнопка, офіційний сайт
              лише коли адреса інша, «Поділитися». Прилипає до верху, поки
              людина читає. Під нею — блок каналу (єдиний заклик сторінки,
              рішення 27.09.2026). На телефоні кнопки живуть у нижній панелі. */}
          <aside className="o-aside">
            <div className="o-action">
              {status ? (
                <div className="o-action-status">
                  <span className="o-eyebrow">{status.label}</span>
                  <span className={`o-status${status.urgent ? ' is-urgent' : ''}`}>{status.value}</span>
                  {status.note ? <span className="o-status-note">{status.note}</span> : null}
                </div>
              ) : null}
              {actionSub ? <p className="o-action-sub">{actionSub}</p> : null}
              {!isClosed && primaryUrl ? (
                <OutboundCta
                  href={primaryUrl}
                  title={item.title}
                  id={item.id}
                  lang={lang}
                  rel={primaryRel}
                  className="o-btn o-btn-primary"
                  place={primaryPlace}
                  apply
                >
                  {primaryLabel}
                </OutboundCta>
              ) : null}
              {src.sourceUrl && (isClosed || applyUrl) ? (
                <OutboundCta href={src.sourceUrl} title={item.title} id={item.id} lang={lang} className="o-btn o-btn-secondary" place="detail_page">
                  {t.officialSite}
                </OutboundCta>
              ) : null}
              <ShareButton
                className="o-btn o-btn-share"
                title={title}
                label={t.shareWith}
                copiedLabel={t.copied}
              />
            </div>
            <TelegramSubscribeBlock place="detail_page" lang={lang} />
          </aside>
        </article>

        {similar.length > 0 && (
          <section className="opportunity-related" aria-labelledby="related-heading">
            <div className="o-related-head">
              <h2 id="related-heading" className="opportunity-related-title">{t.similar}</h2>
              <Link href={crumbHref} className="o-related-all">
                {topicName ? t.allOf(topicName) : t.allHome}
              </Link>
            </div>
            <ul className="opportunity-related-list">
              {similar.map((r) => (
                <li key={r.slug}>
                  {/* Та сама картка, що в каталозі й підбірках (app/OpportunityCard.js). */}
                  <OpportunityCard item={r} lang={lang} today={today} href={`${base}/o/${r.slug}`} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Блоку Dityam+ тут немає (рішення Марії 27.09.2026, «сходинка»:
            сайт веде в канал, Dityam+ продає сам канал). */}
      </div>

      <Footer lang={lang} />

      {/* Панель під пальцем: «Подати заявку ↗» і «Поділитися» (з 29.09.2026
          замість 🧡 — підтримати сайт можна з шапки й футера). Панель несе
          саме подачу: з прямим посиланням — на нього, без нього — на сайт
          організатора, і тоді підпис не обіцяє подачі. */}
      {showBar ? (
        <div className="o-m-bar">
          <OutboundCta
            href={primaryUrl}
            title={item.title}
            lang={lang}
            rel={primaryRel}
            className="o-m-apply"
            place="detail_page_bar"
            id={item.id}
            apply
          >
            {primaryShort}
          </OutboundCta>
          <ShareButton className="o-m-share" icon title={title} label={t.shareWith} copiedLabel={t.copied} />
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
