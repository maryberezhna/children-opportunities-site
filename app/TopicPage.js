import './styles/routes/topic.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS, CARD_FIELDS_EN } from '@/lib/supabase';
import { TOPIC_LIST, topicPath, collectionsPath } from '@/lib/topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { whenRank } from '@/lib/timing';
import { isLive } from '@/lib/audience';
import { closingThisWeek, splitIntro } from '@/lib/topic-filters';
import { schoolNotes } from '@/lib/diaspora';
import { topicCityLinks } from '@/lib/city-topics';
import TopicCards from './topic/TopicCards';
import SuggestBlock from './SuggestBlock';
import ShareButton from './topic/ShareButton';
import StickyBar from './StickyBar';
import SubscribePopup from './SubscribePopup';
import SupportPopup from './SupportPopup';
import Footer from './Footer';

/**
 * Шаблон сторінки підбірки (/za-kordon, /konkursy і решта, uk і en).
 *
 * Редизайн 29.09.2026 за макетом «Dityam — редизайн каталогу» (артборди
 * Topic і TopicMobile): компактний hero (крихти, H1 з Caveat, одне речення,
 * «{N} можливостей · {M} безкоштовних · {K} закриваються цього тижня», фото
 * праворуч), рядок фільтрів над списком (тип із лічильниками, вік, «Лише
 * безкоштовні», «Онлайн»), картки у дві колонки з каналом після першого
 * ряду й автопродовженням, «Важливо знати», «Часті питання», «Інші
 * підбірки» з фото, блок для організаторів. Картки Dityam+ тут немає
 * (рішення Марії 29.09.2026). Увесь контент — з lib/topics.js (heading,
 * intro, note, faq, heroImage, related, subfilters) і з живої бази
 * (лічильники, картки). Тут лише рамка: підписи кнопок і заголовків блоків.
 *
 * GEO/SEO: title без хвоста шаблону layout, власні OG і Twitter з фото
 * підбірки, видимі хлібні крихти, речення з числами й датою, яке асистенти
 * цитують дослівно, і один JSON-LD @graph: CollectionPage + ItemList +
 * BreadcrumbList + FAQPage.
 *
 * Міські підбірки (/[city]/[topic]) мають власну розмітку й цей шаблон не
 * використовують.
 */

const SITE_URL = 'https://dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

const CHROME = {
  uk: {
    home: 'Головна',
    collections: 'Підбірки',
    telegram: 'Отримувати нові в Telegram',
    share: 'Поділитися підбіркою',
    shared: 'Посилання скопійовано',
    closing: (k) => `${k} ${k === 1 ? 'закривається' : 'закриваються'} цього тижня`,
    noteTitle: ['Важливо', 'знати'],
    schoolTitle: ['Школа', 'в країні'],
    schoolSource: 'Джерело',
    faqTitle: ['Часті', 'питання'],
    relatedTitle: ['Інші', 'підбірки'],
    feedback: (a) => <>Побачили помилку або знаєте, чого тут бракує, — {a}.</>,
    feedbackLink: 'напишіть у Telegram',
    homeLink: 'Усі можливості — на головній →',
    sentence: (updated, total, freeCount) =>
      `Станом на ${updated} на платформі Dityam.com.ua — ${total} ${opportunitiesWord(total)} `
      + `у цій підбірці`
      + (freeCount > 0 ? `, з них ${freeCount} — ${freeWord(freeCount)}` : '')
      + '. Платформа оновлюється щодня.',
    count: (n) => `${n} ${opportunitiesWord(n)}`,
    cards: {
      all: 'Усі',
      sort: 'за дедлайном, найближчі спочатку',
      details: 'Детальніше →',
      emptyTitle: 'Нічого не знайдено',
      emptyText: 'Спробуйте інший фільтр.',
      listLabel: 'Можливості підбірки',
      filterLabel: 'Фільтр за типом',
      groupNav: 'Країни',
      groupRest: 'Інші країни',
      age: 'Вік дитини',
      ageLabel: 'Вік дитини',
      onlyFree: 'Лише безкоштовні',
      online: 'Онлайн',
      reset: 'Скинути',
      more: 'Завантажити ще',
      // Лише рядки: labels їдуть у клієнтський TopicCards, а функцію серверний
      // компонент передати не може; «Показано X з N» складає сам TopicCards.
    },
    siteName: 'Dityam.com.ua',
    locale: 'uk_UA',
    dateLocale: 'uk-UA',
  },
  en: {
    home: 'Home',
    collections: 'Collections',
    telegram: 'Get new ones on Telegram',
    share: 'Share this collection',
    shared: 'Link copied',
    closing: (k) => `${k} ${k === 1 ? 'closes' : 'close'} this week`,
    noteTitle: ['Good to', 'know'],
    schoolTitle: ['School in', 'the country'],
    schoolSource: 'Source',
    faqTitle: ['Frequently asked', 'questions'],
    relatedTitle: ['Other', 'collections'],
    feedback: (a) => <>Spotted a mistake or know what is missing here? {a}.</>,
    feedbackLink: 'Write to us on Telegram',
    homeLink: 'All opportunities on the home page →',
    sentence: (updated, total, freeCount) =>
      `As of ${updated}, Dityam.com.ua lists ${total} `
      + `${total === 1 ? 'opportunity' : 'opportunities'} in this collection`
      + (freeCount > 0 ? `, ${freeCount} of them free` : '')
      + '. The platform is updated daily.',
    count: (n) => `${n} ${n === 1 ? 'opportunity' : 'opportunities'}`,
    cards: {
      all: 'All',
      sort: 'by deadline, soonest first',
      details: 'Details →',
      emptyTitle: 'Nothing found',
      emptyText: 'Try a different filter.',
      listLabel: 'Opportunities in this collection',
      filterLabel: 'Filter by type',
      groupNav: 'Countries',
      groupRest: 'Other countries',
      age: 'Child age',
      ageLabel: 'Child age',
      onlyFree: 'Free only',
      online: 'Online',
      reset: 'Reset',
      more: 'Load more',
    },
    siteName: 'Dityam.com.ua',
    locale: 'en_GB',
    dateLocale: 'en-GB',
  },
};

// Підписи підфільтрів — множина типу. Сам набір пігулок рахується з карток
// підбірки (див. buildSubfilters), тож для кожної теми він свій і живий.
const SUB_LABELS = {
  uk: {
    exchange: 'Обміни', scholarship: 'Стипендії', camp: 'Табори', summer_school: 'Літні школи',
    olympiad: 'Олімпіади', competition: 'Конкурси', club: 'Гуртки', course: 'Курси',
    workshop: 'Майстер-класи', grant: 'Гранти', internship: 'Стажування',
    study_program: 'Навчальні програми', festival: 'Фестивалі', hackathon: 'Хакатони',
    allowance: 'Виплати', medical_aid: 'Мед. допомога', psychology: 'Психологія',
    rehabilitation: 'Реабілітація', conference: 'Конференції', volunteer: 'Волонтерство',
    mentorship: 'Менторство', award: 'Премії', sport_tournament: 'Турніри',
    residency: 'Резиденції', educational_material: 'Матеріали', humanitarian: 'Гум. допомога',
    legal_aid: 'Правова допомога', excursion: 'Екскурсії',
  },
  en: {
    exchange: 'Exchanges', scholarship: 'Scholarships', camp: 'Camps', summer_school: 'Summer schools',
    olympiad: 'Olympiads', competition: 'Competitions', club: 'Clubs', course: 'Courses',
    workshop: 'Workshops', grant: 'Grants', internship: 'Internships',
    study_program: 'Study programmes', festival: 'Festivals', hackathon: 'Hackathons',
    allowance: 'Payments', medical_aid: 'Medical aid', psychology: 'Psychological support',
    rehabilitation: 'Rehabilitation', conference: 'Conferences', volunteer: 'Volunteering',
    mentorship: 'Mentorship', award: 'Awards', sport_tournament: 'Tournaments',
    residency: 'Residencies', educational_material: 'Materials', humanitarian: 'Humanitarian aid',
    legal_aid: 'Legal aid', excursion: 'Excursions',
  },
};
// Соціальні виплати й виплати батькам шукають як одне.
const SUB_GROUP = { support_payment: 'allowance' };

/** Контент теми потрібною мовою: англійський лежить у topic.en. */
const content = (topic, lang) => (lang === 'en' ? topic.en : topic);

const heroImageOf = (topic, lang) => content(topic, lang).heroImage || null;

export function topicMetadata(topic, lang = 'uk') {
  const c = content(topic, lang);
  const ch = CHROME[lang] || CHROME.uk;
  const url = `${SITE_URL}${topicPath({ slug: topic.slug, slugEn: topic.en.slug }, lang)}`;
  const hero = heroImageOf(topic, lang);
  const image = hero
    ? { url: `${hero.src}.jpg`, width: 900, height: 600, alt: hero.alt }
    : { url: '/og-image.png', width: 1200, height: 630, alt: c.title };
  return {
    // absolute: шаблон layout дописує «| Можливості для дитини», і заголовок
    // підбірки розтягувався до 90 символів, яких Google однаково не покаже.
    title: { absolute: c.title },
    description: c.description,
    alternates: {
      canonical: url,
      // Взаємність обовʼязкова: односторонню анотацію Google ігнорує, тому
      // обидві мови перелічені тут і на сторінці-парі.
      languages: {
        uk: `${SITE_URL}/${topic.slug}`,
        en: `${SITE_URL}/en/${topic.en.slug}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: ch.locale,
      url,
      siteName: ch.siteName,
      title: c.title,
      description: c.description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.title,
      description: c.description,
      images: [image.url],
    },
  };
}

// Збій бази кидає помилку, а не віддає порожню підбірку (#263): під час ISR
// лишається попередня добра версія сторінки, під час збірки падає деплой.
// fetchAllRows кешує однакову вибірку на 60 с, тож підбірки на одній мові
// тягнуть каталог один раз. Сторінки країн діаспори беруть цю саму вибірку
// для generateStaticParams — і вона приходить із того ж кешу.
export async function topicRows(lang, slug) {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(lang === 'en' ? CARD_FIELDS_EN : CARD_FIELDS)
      .order('created_at', { ascending: false }).order('id')), `topic ${slug} ${lang}`);
}

/** Найближчий дедлайн угорі, без дедлайну — вкінці; закріплені — першими. */
function sortByDeadline(items, todayIso, pinned) {
  // Дедлайн, а без нього — дата події (lib/timing.js): подія з датами, але
  // без дедлайну, більше не падає в кінець як «без дати».
  const rank = (o) => whenRank(o, todayIso);
  return [...items].sort((a, b) => {
    const pa = pinned.has(a.id) ? 0 : 1;
    const pb = pinned.has(b.id) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ra = rank(a);
    const rb = rank(b);
    if (ra === rb) return 0;
    return ra < rb ? -1 : 1;
  });
}

/**
 * Підфільтри. Тема може задати свої (topic.subfilters: [{ key, label,
 * labelEn, types }]); інакше — з типів, що реально є в підбірці: щонайменше
 * два записи, до пʼяти пігулок, найбільші спочатку. Менше двох пігулок —
 * рядок не показуємо: фільтр з одного варіанта нічого не фільтрує.
 */
function buildSubfilters(topic, items, lang) {
  if (topic.subfilters?.length) {
    return topic.subfilters
      .map((s) => ({
        key: s.key,
        label: lang === 'en' ? (s.labelEn || s.label) : s.label,
        types: s.types,
        count: items.filter((o) => s.types.includes(o.opportunity_type)).length,
      }))
      .filter((s) => s.count > 0);
  }
  const labels = SUB_LABELS[lang] || SUB_LABELS.uk;
  const groups = new Map();
  for (const o of items) {
    const key = SUB_GROUP[o.opportunity_type] || o.opportunity_type;
    if (!labels[key]) continue;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(o.opportunity_type);
  }
  return [...groups.entries()]
    .map(([key, types]) => ({
      key,
      label: labels[key],
      types: [...types],
      count: items.filter((o) => types.has(o.opportunity_type)).length,
    }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** Інші підбірки: з topic.related, а без нього — найбільші за кількістю. */
function buildRelated(topic, liveRows) {
  const others = TOPIC_LIST.filter((t) => t.slug !== topic.slug)
    .map((t) => ({ topic: t, count: liveRows.filter(t.match).length }));
  if (topic.related?.length) {
    return topic.related
      .map((slug) => others.find((o) => o.topic.slug === slug))
      .filter(Boolean)
      .slice(0, 4);
  }
  return others.sort((a, b) => b.count - a.count).slice(0, 4);
}

// Картці в браузері треба небагато — не тягнемо зайвих полів у HTML.
const slim = (o) => ({
  id: o.id, slug: o.slug, title: o.title, title_en: o.title_en || null,
  summary: o.summary, summary_en: o.summary_en || null, source: o.source,
  opportunity_type: o.opportunity_type, age_from: o.age_from, age_to: o.age_to,
  deadline: o.deadline, cities: o.cities, countries: o.countries || null,
  // Вартість і адреса джерела — для рядків «Вартість» і «Організатор» на
  // картці (варіант B, 29.09.2026): без source_url картка не відрізнить
  // організатора від чужого Telegram-каналу, якого показувати не можна.
  cost_type: o.cost_type || null, source_url: o.source_url || null,
  // Без дат події й виду картка знову вгадувала б час лише з дедлайну й типу.
  event_start_date: o.event_start_date || null, event_end_date: o.event_end_date || null,
  results_date: o.results_date || null,
  timing_kind: o.timing_kind || null,
  is_international: o.is_international || false, format: o.format,
});

export default async function TopicPage({ topic, lang = 'uk' }) {
  const c = content(topic, lang);
  const ch = CHROME[lang] || CHROME.uk;
  const isEn = lang === 'en';
  const todayIso = kyivToday();

  const rows = await topicRows(lang, topic.slug);
  const liveRows = rows.filter((o) => isLive(o, todayIso));
  const matched = liveRows.filter(topic.match);

  // Сторінка з порогом (країни діаспори): нижче порогу її немає — 404, як
  // у «місто × підбірка». Порожньої чи з одного запису сторінки не буває.
  if (topic.minItems && matched.length < topic.minItems) notFound();

  // «Лише для» — закріплені нагорі з позначкою (зараз лише «Дітям захисників»).
  const pinned = new Set(
    c.pinnedLabel && topic.exclusive ? matched.filter(topic.exclusive).map((o) => o.id) : [],
  );
  const items = sortByDeadline(matched, todayIso, pinned);

  const total = items.length;
  const freeCount = items.filter((o) => o.cost_type === 'free').length;

  // Хаб із групами (країни діаспори): замість пігулок типів — заголовки
  // груп, а записи з власною сторінкою стоять там, не тут. На екрані й у
  // ItemList — один і той самий порядок.
  const grouped = topic.groups ? topic.groups(items, lang) : null;

  // Картки Dityam+ в підбірці більше немає (рішення Марії 29.09.2026;
  // 28.09 у #532 її повертали — скасовано): тут веде лише канал.
  const listed = grouped ? grouped.groups.flatMap((g) => g.items) : items;
  const schools = schoolNotes(topic.schoolNotes || [], lang);

  const subfilters = grouped ? [] : buildSubfilters(topic, items, lang);
  const related = buildRelated(topic, liveRows);
  // Сторінки «місто × підбірка» мають лише українську версію.
  const cityLinks = isEn ? [] : topicCityLinks(liveRows, topic);
  const hero = heroImageOf(topic, lang);
  const heading = c.heading || { lead: c.h1.join(' '), script: '', tail: '' };
  const crumb = isEn ? topic.navEn : topic.nav;
  // Ланка між «Підбірками» і сторінкою: «Живемо за кордоном» над країною.
  const parent = topic.parent ? TOPIC_LIST.find((t) => t.slug === topic.parent) : null;
  const parentCrumb = parent ? {
    name: isEn ? parent.navEn : parent.nav,
    path: topicPath({ slug: parent.slug, slugEn: parent.en.slug }, lang),
  } : null;

  const nav = { slug: topic.slug, slugEn: topic.en.slug };
  const path = topicPath(nav, lang);
  const url = `${SITE_URL}${path}`;
  const homePath = isEn ? '/en' : '/';
  const base = isEn ? `${SITE_URL}/en` : SITE_URL;

  const updatedLabel = new Intl.DateTimeFormat(ch.dateLocale, {
    timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  const sentence = ch.sentence(updatedLabel, total, freeCount);

  // Рядок «{N} можливостей · {M} безкоштовних · {K} закриваються цього тижня»
  // під описом (макет Topic.dc.html). Нуль не показуємо ніде (рішення Марії
  // 14.09.2026): порожня цифра виглядає як зламана підбірка.
  const closing = closingThisWeek(items, todayIso);
  const heroStats = total > 0 ? (
    <p className="tp-hero-stats">
      <span><strong>{total}</strong> {opportunitiesWord(total)}</span>
      {freeCount > 0 ? <span> · <strong>{freeCount}</strong> {freeWord(freeCount)}</span> : null}
      {closing > 0 ? <span className="tp-hero-closing"> · {ch.closing(closing)}</span> : null}
    </p>
  ) : null;
  // У hero — одне речення; решта інтро йде в «Важливо знати», щоб текст, який
  // цитують асистенти, лишався на сторінці цілим.
  const { first: introFirst, rest: introRest } = splitIntro(c.intro);
  const h1Text = `${heading.lead}${heading.script ? ` ${heading.script}` : ''}${heading.tail || ''}`;

  // Один @graph: CollectionPage — що це за сторінка й коли оновлена;
  // ItemList — сама підбірка в тому ж порядку, що на екрані; BreadcrumbList —
  // шлях у видачі; FAQPage — відповіді, які AI-асистенти цитують дослівно.
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: h1Text,
        headline: c.title,
        description: c.description,
        inLanguage: isEn ? 'en' : 'uk',
        dateModified: todayIso,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        ...(hero ? { primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${hero.src}.jpg` } } : {}),
        // Сторінки країн, на які хаб веде посиланнями вгорі списку.
        ...(grouped?.links.length ? {
          hasPart: grouped.links.map((l) => ({ '@type': 'CollectionPage', url: `${SITE_URL}${l.href}`, name: l.label })),
        } : {}),
        mainEntity: { '@id': `${url}#list` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        name: h1Text,
        numberOfItems: listed.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: listed.slice(0, 100).map((o, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${base}/o/${o.slug}`,
          name: (isEn && o.title_en) || o.title,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { name: ch.home, item: base },
          { name: ch.collections, item: `${SITE_URL}${collectionsPath(lang)}` },
          ...(parentCrumb ? [{ name: parentCrumb.name, item: `${SITE_URL}${parentCrumb.path}` }] : []),
          { name: crumb, item: url },
        ].map((l, i) => ({ '@type': 'ListItem', position: i + 1, ...l })),
      },
      ...(c.faq?.length ? [{
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }] : []),
    ],
  };

  const titled = ([plain, script]) => (
    <>{plain} <span className="tp-script">{script}</span></>
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <main className="tp-main" lang={isEn ? 'en' : undefined}>
        <nav className="tp-crumbs" aria-label={isEn ? 'Breadcrumbs' : 'Навігація'}>
          <Link href={homePath} prefetch={false}>{ch.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={collectionsPath(lang)}>{ch.collections}</Link>
          <span aria-hidden="true">/</span>
          {parentCrumb ? (
            <>
              <Link href={parentCrumb.path}>{parentCrumb.name}</Link>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <span aria-current="page">{crumb}</span>
        </nav>

        <section className={`tp-hero${hero ? '' : ' tp-hero-solo'}`} aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <h1 id="tp-title" className="tp-h1">
              {heading.lead}
              {heading.script ? <>{' '}<span className="tp-script">{heading.script}</span></> : null}
              {heading.tail || null}
            </h1>
            <p className="tp-intro">{introFirst}</p>
            {heroStats}
            {c.guide ? (
              <p className="tp-guide-link"><Link href={c.guide.href}>{c.guide.label}</Link></p>
            ) : null}
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                {ch.telegram}
              </a>
              <ShareButton label={ch.share} doneLabel={ch.shared} />
            </div>
          </div>

          {hero ? (
            <div className="tp-hero-photo">
              <picture>
                <source srcSet={`${hero.src}.webp`} type="image/webp" />
                <img
                  src={`${hero.src}.jpg`}
                  alt={hero.alt}
                  width="900"
                  height="600"
                  loading="eager"
                  fetchPriority="high"
                  style={hero.position ? { objectPosition: hero.position } : undefined}
                />
              </picture>
            </div>
          ) : null}
        </section>

        <TopicCards
          items={grouped ? [] : items.map(slim)}
          groups={grouped ? grouped.groups.map((g) => ({ ...g, items: g.items.map(slim) })) : null}
          groupLinks={grouped ? grouped.links : []}
          abroadLabel={topic.code ? crumb : null}
          subfilters={subfilters}
          todayIso={todayIso}
          lang={lang}
          pinnedIds={[...pinned]}
          pinnedLabel={c.pinnedLabel || null}
          labels={ch.cards}
          hub={topic.slug}
        />

        {/* Кінець підбірки завжди веде на головну (рішення Марії 14.09.2026). */}
        <p className="tp-home-link"><Link href={homePath} prefetch={false}>{ch.homeLink}</Link></p>

        <section className="tp-note" aria-labelledby="tp-note-title">
          <h2 id="tp-note-title" className="tp-h2">{titled(ch.noteTitle)}</h2>
          <div className="tp-note-body">
            {introRest ? <p className="tp-note-text">{introRest}</p> : null}
            <p className="tp-note-text">{c.note}</p>
            <p className="tp-note-meta">{sentence}</p>
            <p className="tp-note-meta">
              {ch.feedback(<a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{ch.feedbackLink}</a>)}
            </p>
          </div>
        </section>

        {/* Права й процедури в школі країни (діаспора, 28.09.2026) — абзацом,
            не картками: запис до школи чи підготовчий клас — не можливість. */}
        {schools.length ? (
          <section className="tp-note" aria-labelledby="tp-school-title">
            <h2 id="tp-school-title" className="tp-h2">{titled(ch.schoolTitle)}</h2>
            <div className="tp-note-body">
              {schools.map((s) => (
                <p key={s.code} className="tp-note-text">
                  {schools.length > 1 ? <strong>{s.country}. </strong> : null}
                  {s.text}{' '}
                  <span className="tp-note-meta">
                    <a href={s.source} target="_blank" rel="noopener noreferrer">{ch.schoolSource}</a>
                  </span>
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {c.faq?.length ? (
          <section className="tp-faq" aria-labelledby="tp-faq-title">
            <h2 id="tp-faq-title" className="tp-h2">{titled(ch.faqTitle)}</h2>
            <div className="tp-faq-list">
              {c.faq.map((f) => (
                <div key={f.q} className="tp-faq-item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {cityLinks.length ? (
          <section className="tp-cities" aria-labelledby="tp-cities-title">
            <h2 id="tp-cities-title" className="tp-h2">Ця підбірка у вашому місті</h2>
            <ul className="tp-cities-list">
              {cityLinks.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} prefetch={false} className="tp-city-link">
                    {c.city} <span className="tp-city-n">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length ? (
          <section className="tp-related" aria-labelledby="tp-related-title">
            <h2 id="tp-related-title" className="tp-h2">{titled(ch.relatedTitle)}</h2>
            <div className="tp-related-grid">
              {related.map(({ topic: t, count }) => {
                const img = heroImageOf(t, lang);
                return (
                  <Link key={t.slug} href={topicPath({ slug: t.slug, slugEn: t.en.slug }, lang)} className="tp-related-card">
                    {img ? (
                      <picture className="tp-related-photo">
                        <source srcSet={`${img.src}.webp`} type="image/webp" />
                        <img src={`${img.src}.jpg`} alt="" width="450" height="300" loading="lazy" />
                      </picture>
                    ) : null}
                    <span className="tp-related-body">
                      <span className="tp-related-title">{isEn ? t.navEn : t.nav} →</span>
                      <span className="tp-related-n">{ch.count(count)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Для організаторів: той самий блок, що й у каталозі (app/SuggestBlock.js). */}
        <SuggestBlock lang={lang} />
      </main>

      <Footer lang={lang} />

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
