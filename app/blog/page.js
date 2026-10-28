import '@/app/styles/routes/topic.css';
import Link from 'next/link';
import { BLOG_PATH, blogEntries } from '@/lib/blog';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import Footer from '../Footer';
import BlogIdea from './BlogIdea';

/**
 * Головна блогу (/blog): статті й путівники, що пояснюють «як» і ведуть у
 * підбірки з живими можливостями. Дані — lib/blog.js.
 */

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}${BLOG_PATH}`;
const TITLE = 'Блог Dityam.com.ua — як отримати можливості для дитини';
const DESCRIPTION =
  'Покрокові статті й путівники для батьків: безкоштовні табори й путівки, олімпіади, обміни, стипендії — хто має право, як подати й що відкрито зараз.';

export const revalidate = 3600;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua', url: URL,
    title: TITLE, description: DESCRIPTION,
    images: [{ url: '/topic-tabory.jpg', width: 900, height: 600, alt: '' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/topic-tabory.jpg'] },
};

export default function BlogIndex() {
  const entries = blogEntries();
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${URL}#blog`,
        url: URL,
        name: 'Блог Dityam.com.ua',
        description: DESCRIPTION,
        inLanguage: 'uk',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        blogPost: entries.map((e) => ({ '@type': 'BlogPosting', headline: e.title, url: `${SITE_URL}${e.href}` })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Блог', item: URL },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main className="tp-main">
        <nav className="tp-crumbs" aria-label="Навігація">
          <Link href="/">Головна</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Блог</span>
        </nav>

        <section className="tp-hero tp-hero-solo" aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <h1 id="tp-title" className="tp-h1">
              Блог <span className="tp-script">Dityam.com.ua</span>
            </h1>
            <p className="tp-intro">
              Покрокові статті й путівники для батьків: хто має право, як подати й куди звертатися. Під кожною
              статтею — можливості, відкриті зараз, тож тексти не застарівають.
            </p>
          </div>
        </section>

        <section className="tp-related" aria-label="Статті й путівники">
          <div className="tp-related-grid">
            {entries.map((e) => (
              <Link key={e.href} href={e.href} className="tp-related-card">
                <picture className="tp-related-photo">
                  <source srcSet={`${e.hero.src}-450.webp 450w, ${e.hero.src}.webp 900w`} sizes="(max-width: 700px) 100vw, 300px" type="image/webp" />
                  <img src={`${e.hero.src}-450.jpg`} srcSet={`${e.hero.src}-450.jpg 450w, ${e.hero.src}.jpg 900w`} sizes="(max-width: 700px) 100vw, 300px" alt={e.hero.alt || ''} width="450" height="300" loading="lazy" />
                </picture>
                <span className="tp-related-body">
                  <span className="tp-related-title">{e.title}</span>
                  <span className="tp-related-n">{e.description}</span>
                  {/* «Звірено <дата>» на картці прибрано (Марія, 22.10.2026). */}
                  {e.date ? null : <span className="tp-related-n">Путівник</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <BlogIdea path={BLOG_PATH} />
      </main>

      <Footer lang="uk" />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
