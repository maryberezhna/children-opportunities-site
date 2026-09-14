import Link from 'next/link';
import { supabase, publicOpportunities, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// Звірено з кодом 14.09.2026 — див. коментар в app/yak-my-pereviriaiemo/page.js.
const TITLE = 'How Dityam.com.ua checks opportunities for children';
const DESCRIPTION = 'Daily collection, required fields before publishing, daily link checks, closed intakes detected, duplicates merged, and a moderator wherever there is doubt.';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/en/how-we-verify#page`,
      url: `${SITE_URL}/en/how-we-verify`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/en` },
        { '@type': 'ListItem', position: 2, name: 'How we verify', item: `${SITE_URL}/en/how-we-verify` },
      ],
    },
  ],
};

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    type: 'website', locale: 'en_GB', siteName: 'Dityam.com.ua',
    url: `${SITE_URL}/en/how-we-verify`, title: TITLE, description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: {
    canonical: `${SITE_URL}/en/how-we-verify`,
    languages: {
      uk: `${SITE_URL}/yak-my-pereviriaiemo`,
      en: `${SITE_URL}/en/how-we-verify`,
    },
  },
};

async function getStats() {
  try {
    if (!supabase) return {};
    const [active, verified, sources] = await Promise.all([
      countActiveOpportunities(),
      publicOpportunities('id', { count: 'exact', head: true })
        .gte('last_verified_at', new Date(Date.now() - 3 * 86400000).toISOString()),
      countActiveSources(),
    ]);
    return { active, verified: verified.count, sources };
  } catch {
    return {};
  }
}

const STEPS = [
  {
    icon: '🔎',
    title: 'We collect from our sources every day',
    text: 'Government sites, foundations, international programmes, NGOs, educational platforms and Telegram channels. Scrapers and a search agent run daily; each source has its own rhythm — where new things appear more often, we check more often.',
  },
  {
    icon: '🧠',
    title: 'We structure every record',
    text: 'From the organiser’s text we pull out what matters: age, type, city or format, cost, date. Without a date, type, age, cost and format or place, a record is not published — a moderator looks at it. If a page says the intake is closed, the record closes right away, even if the page itself is still alive.',
  },
  {
    icon: '🔗',
    title: 'We check every link daily',
    text: 'All active opportunities go through a link check every day. A dead link isn’t hidden at once: a record closes only after three failed checks in a row. Every opportunity page shows when its link was last checked.',
  },
  {
    icon: '👯',
    title: 'We merge duplicates',
    text: 'The same camp can appear on a foundation’s site, in Telegram and in the news — as three different texts. The system recognises such repeats and keeps one record, so you don’t sift through the same thing three times.',
  },
  {
    icon: '⏳',
    title: 'We don’t let records go stale',
    text: 'Listings without a deadline (clubs, courses) are re-read every week: if the page is alive and the intake is still open, the record stays; if not, we mark it as finished. Closed pages don’t disappear: they carry a notice and a link back to current opportunities.',
  },
  {
    icon: '🫶',
    title: 'A moderator where there is doubt',
    text: 'A listing is published automatically only when both the mechanical checks and an AI judge agree. Anything missing required fields, anything the judge hesitates on, and all medical, psychological help and payments go to a moderator. You can use the platform without signing up.',
  },
];

export default async function HowWeVerifyEn() {
  const { active, verified, sources } = await getStats();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="container" lang="en">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/en" className="city-back-link">← All opportunities</Link>
            </div>
            <h1>
              How we verify
              <br />
              <span className="accent">the data</span>
            </h1>
            <p>
              “Verified” on Dityam.com.ua isn’t a promise — it’s a daily process.
              Here is how it works, honestly and without magic.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{active ?? FALLBACK.opportunities}</span>
                <span className="stat-label">active opportunities</span>
              </div>
              <div className="stat">
                <span className="stat-num">{verified ?? '—'}</span>
                <span className="stat-label">links checked within 3 days</span>
              </div>
              <div className="stat">
                <span className="stat-num">{sources ?? FALLBACK.sources}</span>
                <span className="stat-label">sources with live listings</span>
              </div>
            </div>
          </div>
        </div>

        <section className="topic-faq">
          {STEPS.map((s) => (
            <div key={s.title} className="verify-row">
              <span className="verify-icon" aria-hidden="true">{s.icon}</span>
              <div>
                <h2 className="verify-title">{s.title}</h2>
                <p className="verify-text">{s.text}</p>
              </div>
            </div>
          ))}
        </section>

        <p className="topic-note" style={{ marginTop: 24 }}>
          Spotted a mistake or a dead link?{' '}
          <a href="mailto:hellodityam.com.ua@gmail.com?subject=Error%20on%20dityam.com.ua">Write to us</a> —
          we’ll fix it and say thank you. And if you know an opportunity that isn’t here yet,{' '}
          <a href="mailto:hellodityam.com.ua@gmail.com?subject=Add%20an%20opportunity">suggest it</a>.
        </p>
      </div>
      <Footer lang="en" />
    </>
  );
}
