import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS, CARD_FIELDS_EN } from '@/lib/supabase';
import { TOPIC_LIST, topicPath, collectionsPath } from '@/lib/topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import { kyivToday, daysUntil } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import TopicCards from './topic/TopicCards';
import ShareButton from './topic/ShareButton';
import StickyBar from './StickyBar';
import SubscribePopup from './SubscribePopup';
import SupportPopup from './SupportPopup';
import Footer from './Footer';

/**
 * Шаблон сторінки підбірки (/za-kordon, /konkursy і решта, uk і en).
 *
 * Вересень 2026 — за макетом ~/Downloads/design_handoff_dityam_pidbirka:
 * кремовий хіро з фото, підфільтри з лічильниками, картки у дві колонки з
 * промо Dityam+ після четвертої, «Важливо знати», «Часті питання», «Інші
 * підбірки». Увесь контент — з lib/topics.js (heading, intro, note, faq,
 * heroImage, related, showPromo, subfilters) і з живої бази (лічильники,
 * картки). Тут лише рамка: підписи кнопок і заголовків блоків.
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
    eyebrow: (d) => `Підбірка · оновлено ${d}`,
    telegram: 'Отримувати нові в Telegram',
    share: 'Поділитися підбіркою',
    shared: 'Посилання скопійовано',
    heroCount: (total, free) => opportunitiesWord(total) + (free > 0 ? ` · ${free} ${freeWord(free)}` : ''),
    noteTitle: ['Важливо', 'знати'],
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
    promoTitle: 'Тут показуємо все, що існує. Dityam+ надсилає те, що підходить саме вашій дитині.',
    promoText: (n) => `Щодня перебираємо ${n} ${opportunitiesWord(n)} цієї підбірки й надсилаємо вам у Telegram лише ті, `
      + 'що підходять вашій дитині за віком, вподобаннями й містом, — з нагадуванням про дедлайн завчасно.',
    promoCta: 'Дізнатися першим',
    cards: {
      all: 'Усі',
      sort: 'за дедлайном, найближчі спочатку',
      details: 'Детальніше ↗',
      emptyTitle: 'Нічого не знайдено',
      emptyText: 'Спробуйте інший фільтр.',
      listLabel: 'Можливості підбірки',
      filterLabel: 'Фільтр за типом',
    },
    siteName: 'Dityam.com.ua',
    locale: 'uk_UA',
    dateLocale: 'uk-UA',
  },
  en: {
    home: 'Home',
    collections: 'Collections',
    eyebrow: (d) => `Collection · updated ${d}`,
    telegram: 'Get new ones on Telegram',
    share: 'Share this collection',
    shared: 'Link copied',
    heroCount: (total, free) => (total === 1 ? 'opportunity' : 'opportunities') + (free > 0 ? ` · ${free} free` : ''),
    noteTitle: ['Good to', 'know'],
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
    promoTitle: 'Here we show everything that exists. Dityam+ sends what fits your child.',
    promoText: (n) => `Every day we go through ${n} ${n === 1 ? 'opportunity' : 'opportunities'} in this collection and send you, on Telegram, `
      + 'only the ones that fit your child by age, interests and city — with a deadline reminder in good time.',
    promoCta: 'Tell me first',
    cards: {
      all: 'All',
      sort: 'by deadline, soonest first',
      details: 'Details ↗',
      emptyTitle: 'Nothing found',
      emptyText: 'Try a different filter.',
      listLabel: 'Opportunities in this collection',
      filterLabel: 'Filter by type',
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
// тягнуть каталог один раз.
async function getRows(lang, slug) {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(lang === 'en' ? CARD_FIELDS_EN : CARD_FIELDS)
      .order('created_at', { ascending: false }).order('id')), `topic ${slug} ${lang}`);
}

/** Найближчий дедлайн угорі, без дедлайну — вкінці; закріплені — першими. */
function sortByDeadline(items, todayIso, pinned) {
  const rank = (o) => {
    const d = daysUntil(o.deadline, todayIso);
    return d === null || d < 0 ? Number.POSITIVE_INFINITY : d;
  };
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
  is_international: o.is_international || false, format: o.format,
});

export default async function TopicPage({ topic, lang = 'uk' }) {
  const c = content(topic, lang);
  const ch = CHROME[lang] || CHROME.uk;
  const isEn = lang === 'en';
  const todayIso = kyivToday();

  const rows = await getRows(lang, topic.slug);
  const liveRows = rows.filter((o) => isLive(o, todayIso));
  const matched = liveRows.filter(topic.match);

  // «Лише для» — закріплені нагорі з позначкою (зараз лише «Дітям захисників»).
  const pinned = new Set(
    c.pinnedLabel && topic.exclusive ? matched.filter(topic.exclusive).map((o) => o.id) : [],
  );
  const items = sortByDeadline(matched, todayIso, pinned);

  const total = items.length;
  const freeCount = items.filter((o) => o.cost_type === 'free').length;

  const subfilters = buildSubfilters(topic, items, lang);
  const related = buildRelated(topic, liveRows);
  const hero = heroImageOf(topic, lang);
  const heading = c.heading || { lead: c.h1.join(' '), script: '', tail: '' };
  const crumb = isEn ? topic.navEn : topic.nav;

  const nav = { slug: topic.slug, slugEn: topic.en.slug };
  const path = topicPath(nav, lang);
  const url = `${SITE_URL}${path}`;
  const homePath = isEn ? '/en' : '/';
  const base = isEn ? `${SITE_URL}/en` : SITE_URL;

  const updatedLabel = new Intl.DateTimeFormat(ch.dateLocale, {
    timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  const sentence = ch.sentence(updatedLabel, total, freeCount);

  // Картка «28 можливостей · 25 безкоштовних» поверх фото хіро (варіант 4b).
  // Нуль не показуємо ніде (рішення Марії 14.09.2026): порожня цифра виглядає
  // як зламана підбірка.
  const heroCount = (inline) => (total > 0 ? (
    <p className={`tp-hero-count${inline ? ' is-inline' : ''}`}>
      <span className="tp-hero-count-n">{total}</span>
      <span className="tp-hero-count-t">{ch.heroCount(total, freeCount)}</span>
    </p>
  ) : null);
  const h1Text = `${heading.lead}${heading.script ? ` ${heading.script}` : ''}${heading.tail || ''}`;

  const promo = topic.showPromo === false ? null : {
    title: ch.promoTitle,
    text: ch.promoText(total),
    cta: ch.promoCta,
    href: isEn ? '/en/plus' : '/plus',
  };

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
        mainEntity: { '@id': `${url}#list` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        name: h1Text,
        numberOfItems: total,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: items.slice(0, 100).map((o, i) => ({
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
          { '@type': 'ListItem', position: 1, name: ch.home, item: base },
          { '@type': 'ListItem', position: 2, name: ch.collections, item: `${SITE_URL}${collectionsPath(lang)}` },
          { '@type': 'ListItem', position: 3, name: crumb, item: url },
        ],
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
          <Link href={homePath}>{ch.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={collectionsPath(lang)}>{ch.collections}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{crumb}</span>
        </nav>

        <section className={`tp-hero${hero ? '' : ' tp-hero-solo'}`} aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <span className="tp-eyebrow">{ch.eyebrow(updatedLabel)}</span>
            <h1 id="tp-title" className="tp-h1">
              {heading.lead}
              {heading.script ? <>{' '}<span className="tp-script">{heading.script}</span></> : null}
              {heading.tail || null}
            </h1>
            <p className="tp-intro">{c.intro}</p>
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                {ch.telegram}
              </a>
              <ShareButton label={ch.share} doneLabel={ch.shared} />
            </div>
            {hero ? null : heroCount(true)}
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
              {heroCount(false)}
            </div>
          ) : null}
        </section>

        <TopicCards
          items={items.map(slim)}
          subfilters={subfilters}
          todayIso={todayIso}
          lang={lang}
          pinnedIds={[...pinned]}
          pinnedLabel={c.pinnedLabel || null}
          promo={promo}
          labels={ch.cards}
        />

        {/* Кінець підбірки завжди веде на головну (рішення Марії 14.09.2026). */}
        <p className="tp-home-link"><Link href={homePath}>{ch.homeLink}</Link></p>

        <section className="tp-note" aria-labelledby="tp-note-title">
          <h2 id="tp-note-title" className="tp-h2">{titled(ch.noteTitle)}</h2>
          <div className="tp-note-body">
            <p className="tp-note-text">{c.note}</p>
            <p className="tp-note-meta">{sentence}</p>
            <p className="tp-note-meta">
              {ch.feedback(<a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{ch.feedbackLink}</a>)}
            </p>
          </div>
        </section>

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

        {related.length ? (
          <section className="tp-related" aria-labelledby="tp-related-title">
            <h2 id="tp-related-title" className="tp-h2">{titled(ch.relatedTitle)}</h2>
            <div className="tp-related-grid">
              {related.map(({ topic: t, count }) => (
                <Link key={t.slug} href={topicPath({ slug: t.slug, slugEn: t.en.slug }, lang)} className="tp-related-card">
                  <span className="tp-related-title">{isEn ? t.navEn : t.nav}</span>
                  <span className="tp-related-n">{ch.count(count)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <Footer lang={lang} />

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
