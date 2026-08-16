import Link from 'next/link';
import { supabase, CARD_FIELDS } from '@/lib/supabase';
import { TOPIC_NAV } from '@/lib/topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import OpportunitiesList from './OpportunitiesList';
import StickyHeader from './StickyHeader';
import StickyBar from './StickyBar';
import SubscribePopup from './SubscribePopup';
import SupportPopup from './SupportPopup';
import Footer from './Footer';

const SITE_URL = 'https://dityam.com.ua';

export function topicMetadata(topic) {
  const url = `${SITE_URL}/${topic.slug}`;
  return {
    title: topic.title,
    description: topic.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'uk_UA',
      url,
      siteName: 'Можливості для дитини',
      title: topic.title,
      description: topic.description,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: topic.title }],
    },
  };
}

async function getTopicOpportunities(topic) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('opportunities')
    .select(CARD_FIELDS)
    .eq('status', 'active')
    // Дублі (canonical_slug заповнений) віддають 301 і в підбірці не потрібні.
    .is('canonical_slug', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.filter(topic.match);
}

export default async function TopicPage({ topic }) {
  const opportunities = await getTopicOpportunities(topic);
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;
  const withDeadline = opportunities.filter((o) => {
    if (!o.deadline) return false;
    const d = new Date(o.deadline);
    return !isNaN(d) && d >= new Date(new Date().toDateString());
  }).length;

  const url = `${SITE_URL}/${topic.slug}`;

  // ItemList — щоб Google бачив підбірку списком, а не просто текстом.
  // BreadcrumbList — щоб у видачі був шлях «Головна › Тема», а не голий URL.
  // FAQPage — питання-відповіді, які generative engines (Perplexity, ChatGPT,
  // AI Overviews) цитують дослівно з посиланням на джерело.
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: topic.h1.join(' '),
      numberOfItems: total,
      itemListElement: opportunities.slice(0, 100).map((o, i) => ({
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
        { '@type': 'ListItem', position: 2, name: topic.nav, item: url },
      ],
    },
  ];

  if (topic.faq?.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: topic.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  // Самодостатнє речення з числами й датою — саме такий формат AI-двигуни
  // цитують як відповідь на категорійний запит. Дата чесна: сторінка
  // перегенеровується (revalidate), а каталог справді оновлюється щодня.
  const updatedLabel = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const others = TOPIC_NAV.filter((t) => t.slug !== topic.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <StickyHeader />

      <div className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/" className="city-back-link">← Всі можливості</Link>
            </div>
            <h1>
              {topic.h1[0]}
              <br />
              <span className="accent">{topic.h1[1]}</span>
            </h1>
            <p>{topic.intro}</p>
            <p>
              Станом на {updatedLabel} в каталозі Dityam — {total}{' '}
              {opportunitiesWord(total)} в цій категорії, перевірених вручну
              {freeCount > 0 && `, з них ${freeCount} — ${freeWord(freeCount)}`}.
              Каталог оновлюється щодня.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{total}</span>
                <span className="stat-label">{opportunitiesWord(total)}</span>
              </div>
              <div className="stat">
                <span className="stat-num">{freeCount}</span>
                <span className="stat-label">{freeWord(freeCount)}</span>
              </div>
              {withDeadline > 0 && (
                <div className="stat">
                  <span className="stat-num">{withDeadline}</span>
                  <span className="stat-label">з відкритою подачею</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Другий абзац — не прикраса: сторінка без тексту виглядає для Google
            як список посилань, а такі в категорійній видачі не ранжуються. */}
        <p className="topic-note">{topic.note}</p>

        <nav className="city-nav" aria-label="Інші підбірки">
          {others.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="city-nav-link">
              {t.label}
            </Link>
          ))}
        </nav>

        <OpportunitiesList
          opportunities={opportunities}
          promoProps={{ total }}
        />

        {topic.faq?.length > 0 && (
          <section className="topic-faq" aria-labelledby="topic-faq-title">
            <h2 id="topic-faq-title">Часті питання</h2>
            {topic.faq.map((f) => (
              <details key={f.q} className="topic-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>
        )}

        <Footer />
      </div>

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
