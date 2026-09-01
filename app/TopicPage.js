import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, CARD_FIELDS, CARD_FIELDS_EN } from '@/lib/supabase';
import { TOPIC_NAV, topicPath } from '@/lib/topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import OpportunitiesList from './OpportunitiesList';
import StickyBar from './StickyBar';
import SubscribePopup from './SubscribePopup';
import SupportPopup from './SupportPopup';
import Footer from './Footer';

const SITE_URL = 'https://dityam.com.ua';

/** Тексти обрамлення сторінки. Контент теми живе в lib/topics.js. */
const CHROME = {
  uk: {
    back: '← Всі можливості',
    otherTopics: 'Інші підбірки',
    faqTitle: 'Часті питання',
    home: 'Головна',
    withDeadline: 'з відкритою подачею',
    siteName: 'Можливості для дитини',
    locale: 'uk_UA',
    sentence: (updated, total, freeCount) =>
      `Станом на ${updated} в каталозі Dityam — ${total} ${opportunitiesWord(total)} `
      + `в цій категорії, перевірених вручну`
      + (freeCount > 0 ? `, з них ${freeCount} — ${freeWord(freeCount)}` : '')
      + '. Каталог оновлюється щодня.',
    countLabel: (n) => opportunitiesWord(n),
    freeLabel: (n) => freeWord(n),
  },
  en: {
    back: '← All opportunities',
    otherTopics: 'Other collections',
    faqTitle: 'Frequently asked questions',
    home: 'Home',
    withDeadline: 'open for applications',
    siteName: 'Dityam',
    locale: 'en_US',
    sentence: (updated, total, freeCount) =>
      `As of ${updated}, Dityam lists ${total} hand-checked `
      + `${total === 1 ? 'opportunity' : 'opportunities'} in this category`
      + (freeCount > 0 ? `, ${freeCount} of them free` : '')
      + '. The catalogue is updated daily.',
    countLabel: (n) => (n === 1 ? 'opportunity' : 'opportunities'),
    freeLabel: () => 'free of charge',
  },
};

/** Контент теми потрібною мовою: англійський лежить у topic.en. */
const content = (topic, lang) => (lang === 'en' ? topic.en : topic);

export function topicMetadata(topic, lang = 'uk') {
  const c = content(topic, lang);
  const ch = CHROME[lang] || CHROME.uk;
  const url = `${SITE_URL}${topicPath({ slug: topic.slug, slugEn: topic.en.slug }, lang)}`;
  return {
    title: c.title,
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
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: c.title }],
    },
  };
}

async function getTopicOpportunities(topic, lang) {
  if (!supabase) return [];
  const { data, error } = await fetchAllRows(() =>
    publicOpportunities(lang === 'en' ? CARD_FIELDS_EN : CARD_FIELDS)
      .order('created_at', { ascending: false }).order('id'));
  if (error || !data) return [];
  return data.filter(topic.match);
}

export default async function TopicPage({ topic, lang = 'uk' }) {
  const c = content(topic, lang);
  const ch = CHROME[lang] || CHROME.uk;
  const opportunities = await getTopicOpportunities(topic, lang);
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;
  const withDeadline = opportunities.filter((o) => {
    if (!o.deadline) return false;
    const d = new Date(o.deadline);
    return !isNaN(d) && d >= new Date(new Date().toDateString());
  }).length;

  const nav = { slug: topic.slug, slugEn: topic.en.slug };
  const url = `${SITE_URL}${topicPath(nav, lang)}`;
  const base = lang === 'en' ? `${SITE_URL}/en` : SITE_URL;

  // ItemList — щоб Google бачив підбірку списком, а не просто текстом.
  // BreadcrumbList — щоб у видачі був шлях «Головна › Тема», а не голий URL.
  // FAQPage — питання-відповіді, які generative engines (Perplexity, ChatGPT,
  // AI Overviews) цитують дослівно з посиланням на джерело.
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: c.h1.join(' '),
      numberOfItems: total,
      itemListElement: opportunities.slice(0, 100).map((o, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${base}/o/${o.slug}`,
        name: (lang === 'en' && o.title_en) || o.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: ch.home, item: base },
        { '@type': 'ListItem', position: 2, name: lang === 'en' ? topic.navEn : topic.nav, item: url },
      ],
    },
  ];

  if (c.faq?.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  // Самодостатнє речення з числами й датою — саме такий формат AI-двигуни
  // цитують як відповідь на категорійний запит. Дата чесна: сторінка
  // перегенеровується (revalidate), а каталог справді оновлюється щодня.
  const updatedLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const others = TOPIC_NAV.filter((t) => t.slug !== topic.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <div className="container" lang={lang === 'en' ? 'en' : undefined}>
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href={lang === 'en' ? '/en' : '/'} className="city-back-link">{ch.back}</Link>
            </div>
            <h1>
              {c.h1[0]}
              <br />
              <span className="accent">{c.h1[1]}</span>
            </h1>
            <p>{c.intro}</p>
            <p>{ch.sentence(updatedLabel, total, freeCount)}</p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{total}</span>
                <span className="stat-label">{ch.countLabel(total)}</span>
              </div>
              <div className="stat">
                <span className="stat-num">{freeCount}</span>
                <span className="stat-label">{ch.freeLabel(freeCount)}</span>
              </div>
              {withDeadline > 0 && (
                <div className="stat">
                  <span className="stat-num">{withDeadline}</span>
                  <span className="stat-label">{ch.withDeadline}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Другий абзац — не прикраса: сторінка без тексту виглядає для Google
            як список посилань, а такі в категорійній видачі не ранжуються. */}
        <p className="topic-note">{c.note}</p>

        <nav className="city-nav" aria-label={ch.otherTopics}>
          {others.map((t) => (
            <Link key={t.slug} href={topicPath(t, lang)} className="city-nav-link">
              {lang === 'en' ? t.labelEn : t.label}
            </Link>
          ))}
        </nav>

        <OpportunitiesList
          opportunities={opportunities}
          promoProps={{ total }}
          lang={lang}
        />

        {c.faq?.length > 0 && (
          <section className="topic-faq" aria-labelledby="topic-faq-title">
            <h2 id="topic-faq-title">{ch.faqTitle}</h2>
            {c.faq.map((f) => (
              <details key={f.q} className="topic-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>
        )}

        <Footer lang={lang} />
      </div>

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
