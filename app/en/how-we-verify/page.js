import Link from 'next/link';
import { supabase, publicOpportunities, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export const metadata = {
  title: 'How we verify data — Dityam',
  description:
    'How the Dityam platform works: 200+ sources, daily updates, every link checked nightly, closed intakes detected, and human moderation where there is doubt. Honestly about what “verified” means here.',
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
    title: 'We collect from every source, every day',
    text: 'Government sites, foundations, embassies, NGOs, educational platforms and Telegram channels. Scrapers and a search agent run nightly; each source has its own rhythm — seasonal ones (camps in spring, olympiads in autumn) are checked more often.',
  },
  {
    icon: '🧠',
    title: 'We structure every record',
    text: 'From raw text we pull out what matters: age, topic, city, cost, deadline. If a page says the intake is closed, the record closes right away — even if the page itself is still alive.',
  },
  {
    icon: '🔗',
    title: 'We check every link nightly',
    text: 'All active opportunities go through a nightly link check. A dead link isn’t hidden at once — we give the source three days to come back, and only then close the record. Every opportunity page shows when it was last checked.',
  },
  {
    icon: '👯',
    title: 'We merge duplicates',
    text: 'The same camp can appear on a foundation’s site, in Telegram and in the news — as three different texts. The system recognises such repeats and keeps one record, so you don’t sift through the same thing three times.',
  },
  {
    icon: '⏳',
    title: 'We don’t let records go stale',
    text: 'Opportunities without a deadline (clubs, courses) are re-checked regularly: if the page is alive and the intake is still open, the record stays; if not, we honestly mark it as finished. Closed pages don’t disappear: they carry a notice and a link back to the live listings.',
  },
  {
    icon: '🫶',
    title: 'A human where there is doubt',
    text: 'Everything new from the search agent, and anything the system isn’t sure about, goes to manual moderation before publication. We collect no data about children at all — the platform works without sign-up.',
  },
];

export default async function HowWeVerifyEn() {
  const { active, verified, sources } = await getStats();

  return (
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
            “Verified” on Dityam isn’t a promise — it’s a daily process. Here is
            how it works, honestly and without magic.
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
              <span className="stat-label">sources, every day</span>
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
        <a href="mailto:maryberezhna@gmail.com?subject=Error%20on%20dityam.com.ua">Write to us</a> —
        we’ll fix it and say thank you. And if you know an opportunity that isn’t here yet,{' '}
        <a href="mailto:maryberezhna@gmail.com?subject=Add%20an%20opportunity">suggest it</a>.
      </p>
      <Footer lang="en" />
    </div>
  );
}
