import '@/app/styles/routes/topic.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS } from '@/lib/supabase';
import { TOPICS, TOPIC_LIST, topicPath, pickRelated } from '@/lib/topics';
import { opportunitiesWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { whenRank } from '@/lib/timing';
import { isLive } from '@/lib/audience';
import { BLOG_POSTS, BLOG_PATH, blogPath, postBySlug, postState } from '@/lib/blog';
import TopicCards from '../../topic/TopicCards';
import ShareButton from '../../topic/ShareButton';
import StickyBar from '../../StickyBar';
import SubscribePopup from '../../SubscribePopup';
import SupportPopup from '../../SupportPopup';
import Footer from '../../Footer';
import BlogRich from '../BlogRich';
import BlogOutLink from '../BlogOutLink';
import BlogIdea from '../BlogIdea';

/**
 * Стаття блогу (/blog/<slug>). Рамка — та сама, що в путівнику /erasmus:
 * крихти, хіро з фото, розділи з тексту, живий список карток, «Важливо
 * знати» з джерелами й датою звірки, FAQ, «Інші підбірки». Дані — lib/blog.js.
 */

const SITE_URL = 'https://dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

const longDate = (iso) => new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${iso}T12:00:00Z`));

export function generateMetadata({ params }) {
  const post = postBySlug(params.slug);
  if (!post) return {};
  const url = `${SITE_URL}${blogPath(post.slug)}`;
  const image = { url: `${post.hero.src}.jpg`, width: 900, height: 600, alt: post.hero.alt };
  return {
    title: { absolute: post.title },
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', locale: 'uk_UA', siteName: 'Dityam.com.ua', url,
      title: post.title, description: post.description, images: [image],
      publishedTime: post.published, modifiedTime: post.checked,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description, images: [image.url] },
  };
}

// Та сама вибірка, що в підбірках: збій бази кидає помилку замість порожнього
// списку (#263), fetchAllRows кешує на 60 с.
async function getRows() {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(CARD_FIELDS).order('created_at', { ascending: false }).order('id')), 'blog post');
}

const slim = (o) => ({
  id: o.id, slug: o.slug, title: o.title, title_en: o.title_en || null,
  summary: o.summary, summary_en: null, source: o.source,
  opportunity_type: o.opportunity_type, age_from: o.age_from, age_to: o.age_to,
  deadline: o.deadline, cities: o.cities, countries: o.countries || null,
  event_start_date: o.event_start_date || null, event_end_date: o.event_end_date || null,
  timing_kind: o.timing_kind || null,
  is_international: o.is_international || false, format: o.format,
});

const titled = ([plain, script]) => (
  <>{plain} <span className="tp-script">{script}</span></>
);

function Section({ s }) {
  return (
    <section className="tp-faq er-section" aria-labelledby={`bl-${s.id}`}>
      <h2 id={`bl-${s.id}`} className="tp-h2">{titled(s.title)}</h2>
      <div className={`er-body${s.paras ? ' er-prose' : ''}`}>
        {s.lead ? <p className="er-lead"><BlogRich text={s.lead} /></p> : null}
        {(s.paras || []).map((p, i) => <p key={i}><BlogRich text={p} /></p>)}
        {s.list ? (
          <ul className="er-list">
            {s.list.map((x, i) => <li key={i}><BlogRich text={x} /></li>)}
          </ul>
        ) : null}
        {s.steps ? (
          <ol className="er-steps">
            {s.steps.map((x) => (
              <li key={x.t} className="er-step">
                <h3>{x.t}</h3>
                <p><BlogRich text={x.d} /></p>
              </li>
            ))}
          </ol>
        ) : null}
        {(s.after || []).map((p, i) => <p key={`a${i}`} className="er-lead"><BlogRich text={p} /></p>)}
      </div>
    </section>
  );
}

export default async function BlogPost({ params }) {
  const post = postBySlug(params.slug);
  if (!post) notFound();

  const url = `${SITE_URL}${blogPath(post.slug)}`;
  const todayIso = kyivToday();
  const rows = await getRows();
  const live = rows.filter((o) => isLive(o, todayIso));
  const topic = TOPICS[post.cards.topic];
  const items = live.filter(topic.match).sort((a, b) => {
    const ra = whenRank(a, todayIso);
    const rb = whenRank(b, todayIso);
    if (ra === rb) return 0;
    return ra < rb ? -1 : 1;
  });
  const total = items.length;
  const related = pickRelated(post.related,
    TOPIC_LIST.map((t) => ({ topic: t, count: live.filter(t.match).length })));

  const checkedLabel = longDate(post.checked);
  const { closed } = postState(post);
  const labels = {
    all: 'Усі', sort: 'за дедлайном, найближчі спочатку', details: 'Детальніше →',
    emptyTitle: 'Нічого не знайдено', emptyText: 'Спробуйте інший фільтр.',
    listLabel: post.cards.listLabel, filterLabel: 'Фільтр за типом',
  };

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        headline: post.title,
        description: post.description,
        inLanguage: 'uk',
        datePublished: post.published,
        dateModified: post.checked,
        image: `${SITE_URL}${post.hero.src}.jpg`,
        author: { '@type': 'Person', name: 'Марія Шутяк' },
        publisher: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
        isPartOf: { '@id': `${SITE_URL}/#website` },
        citation: post.sources.map((s) => s.url),
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        name: post.cards.listLabel,
        numberOfItems: total,
        itemListElement: items.map((o, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/o/${o.slug}`, name: o.title,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Блог', item: `${SITE_URL}${BLOG_PATH}` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <main className="tp-main er-main">
        <nav className="tp-crumbs" aria-label="Навігація">
          <Link href="/">Головна</Link>
          <span aria-hidden="true">/</span>
          <Link href={BLOG_PATH}>Блог</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{post.heading.lead} {post.heading.script}</span>
        </nav>

        <section className="tp-hero" aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <span className="tp-eyebrow">Стаття · звірено {checkedLabel}</span>
            <h1 id="tp-title" className="tp-h1">
              {post.heading.lead} <span className="tp-script">{post.heading.script}</span>{post.heading.tail}
            </h1>
            {/* Подача за правилами зі статті завершилась (deadline у lib/blog.js):
                кажемо це першим рядком, щоб ніхто не збирав документи на закрите.
                Картки нижче живі — там те, що відкрито зараз. */}
            {closed ? (
              <p className="bl-closed" role="status">
                Прийом за цими умовами завершився {longDate(post.deadline)}. Стаття чекає на переперевірку,
                а нижче — <a href="#bl-open">те, що відкрито зараз</a>.
              </p>
            ) : null}
            <p className="tp-intro"><BlogRich text={post.intro} /></p>
            <p className="tp-guide-link"><a href="#bl-open">Одразу до відкритих можливостей ↓</a></p>
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                Отримувати нові в Telegram
              </a>
              <ShareButton label="Поділитися статтею" doneLabel="Посилання скопійовано" />
            </div>
          </div>
          <div className="tp-hero-photo">
            <picture>
              <source srcSet={`${post.hero.src}.webp`} type="image/webp" />
              <img src={`${post.hero.src}.jpg`} alt={post.hero.alt} width="900" height="600" loading="eager" fetchPriority="high" />
            </picture>
            {post.hero.credit ? (
              <a className="tp-hero-credit" href={post.hero.credit.href} target="_blank" rel="noopener noreferrer">
                {post.hero.credit.text}
              </a>
            ) : null}
          </div>
        </section>

        {post.sections.map((s) => <Section key={s.id} s={s} />)}

        <section id="bl-open" className="er-open" aria-labelledby="bl-open-title">
          <h2 id="bl-open-title" className="tp-h2">{titled(post.cards.title)}</h2>
          {total > 0 ? (
            <TopicCards items={items.map(slim)} todayIso={todayIso} lang="uk" firstBanner={6} bannerEvery={18} labels={labels} />
          ) : (
            <p className="tp-note-text">{post.cards.empty}</p>
          )}
          <p className="tp-guide-link">
            <Link href={topicPath(topic)}>Уся підбірка «{topic.nav}» — {total} {opportunitiesWord(total)} →</Link>
          </p>
        </section>

        <section className="tp-note" aria-labelledby="tp-note-title">
          <h2 id="tp-note-title" className="tp-h2">{titled(['Важливо', 'знати'])}</h2>
          <div className="tp-note-body">
            <p className="tp-note-text">
              Dityam.com.ua не призначає виплат, не видає путівок і не приймає заяв: ми пояснюємо правила й збираємо
              відкриті можливості з посиланням на організатора. Остаточні умови — в органі, куди ви звертаєтесь,
              і в самого організатора.
            </p>
            <p className="tp-note-meta">
              Факти звірено {checkedLabel} з джерелами:{' '}
              {post.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? '; ' : ''}
                  <BlogOutLink href={s.url}>{s.label}</BlogOutLink>
                </span>
              ))}.
            </p>
            <p className="tp-note-meta">
              Побачили помилку або правила змінилися —{' '}
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">напишіть у Telegram</a>.
            </p>
          </div>
        </section>

        <section className="tp-faq" aria-labelledby="tp-faq-title">
          <h2 id="tp-faq-title" className="tp-h2">{titled(['Часті', 'питання'])}</h2>
          <div className="tp-faq-list">
            {post.faq.map((f) => (
              <div key={f.q} className="tp-faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tp-related" aria-labelledby="tp-related-title">
          <h2 id="tp-related-title" className="tp-h2">{titled(['Інші', 'підбірки'])}</h2>
          <div className="tp-related-grid">
            {related.map(({ topic: t, count }) => (
              <Link key={t.slug} href={topicPath(t)} className="tp-related-card">
                <span className="tp-related-body">
                  <span className="tp-related-title">{t.nav}</span>
                  <span className="tp-related-n">{count} {opportunitiesWord(count)}</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="tp-guide-link"><Link href={BLOG_PATH}>Усі статті й путівники в блозі →</Link></p>
        </section>

        <BlogIdea path={blogPath(post.slug)} />
      </main>

      <Footer lang="uk" />

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
