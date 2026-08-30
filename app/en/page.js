import Link from 'next/link';
import { supabase, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import { TOPIC_LIST } from '@/lib/topics';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// Опис теж рахуємо з бази, як у layout: тут стояло зашите «500+», хоча в
// базі 449 — і саме цей текст показував Google. Округлюємо вниз до
// півсотні, щоб число ніколи не обіцяло більше, ніж є.
export async function generateMetadata() {
  const count = await countActiveOpportunities().catch(() => null);
  const n = count && count >= 50 ? Math.floor(count / 50) * 50 : 400;
  return {
  title: 'Dityam — opportunities for Ukrainian children worldwide',
  description:
    `A free catalogue of ${n}+ verified opportunities for Ukrainian children aged 0–18 — in Ukraine and abroad: camps, scholarships, olympiads, exchange programs, grants and aid. Updated daily, every link checked nightly.`,
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: { uk: `${SITE_URL}/`, en: `${SITE_URL}/en` },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/en`,
    siteName: 'Dityam',
    title: 'Dityam — opportunities for Ukrainian children worldwide',
    description:
      'Free catalogue of verified opportunities for Ukrainian children 0–18, in Ukraine and abroad. Updated daily.',
  },
  };
}

async function getStats() {
  try {
    if (!supabase) return {};
    const [active, sources] = await Promise.all([
      countActiveOpportunities(),
      countActiveSources(),
    ]);
    return { active, sources };
  } catch {
    return {};
  }
}

const WHAT = [
  { icon: '🏕️', en: 'Camps & recreation', note: 'free and subsidised, in Ukraine and abroad' },
  { icon: '🎓', en: 'Courses & clubs', note: 'from coding to arts, many online' },
  { icon: '🏆', en: 'Olympiads & competitions', note: 'national and international' },
  { icon: '✈️', en: 'Exchange programs', note: 'FLEX, AFS, Erasmus+ and more' },
  { icon: '💰', en: 'Scholarships & grants', note: 'including full-funding programs' },
  { icon: '🤝', en: 'Aid & support', note: 'for displaced families, veterans’ children, children with disabilities' },
];

export default async function EnglishPage() {
  const { active, sources } = await getStats();

  return (
    <div className="container" lang="en">
      <div className="hero">
        <div className="hero-copy">
          <div className="hero-badges">
            <div className="hero-badge">Free · updated daily</div>
          </div>
          <h1>
            Opportunities for Ukrainian children —
            <br />
            <span className="accent">wherever they are</span>
          </h1>
          <p>
            Dityam is a free, ad-free catalogue of verified opportunities for
            Ukrainian children aged 0–18 — those still in Ukraine and those
            scattered across the world by the war. Camps, scholarships,
            olympiads, exchanges, grants and aid programs: gathered from
            {' '}{sources ?? FALLBACK.sources} sources, checked daily, all in one place.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{active ?? FALLBACK.opportunities}</span>
              <span className="stat-label">verified opportunities</span>
            </div>
            <div className="stat">
              <span className="stat-num">{sources ?? FALLBACK.sources}</span>
              <span className="stat-label">sources, updated daily</span>
            </div>
            <div className="stat">
              <span className="stat-num">0–18</span>
              <span className="stat-label">years old, free for families</span>
            </div>
          </div>
        </div>
      </div>

      <section className="topic-faq" style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>What’s inside</h2>
        {WHAT.map((w) => (
          <div key={w.en} style={{ display: 'flex', gap: 13, alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 21 }} aria-hidden="true">{w.icon}</span>
            <div>
              <b>{w.en}</b>
              <span style={{ color: 'var(--ink-soft)' }}> — {w.note}</span>
            </div>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 760, marginTop: 26 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>The catalogue is in Ukrainian</h2>
        <p style={{ color: 'var(--ink-soft)', maxWidth: '65ch' }}>
          Listings are written in Ukrainian — the language of the families we
          serve. If you’re a parent, just head to the catalogue; if you’re a
          teacher, volunteer or partner helping a Ukrainian family abroad, your
          browser’s translate feature works well on every page.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <Link href="/" className="opportunity-cta" style={{ textDecoration: 'none' }}>
            Browse the catalogue →
          </Link>
          <Link href="/yak-my-pereviriaiemo" className="cal-btn" style={{ textDecoration: 'none' }}>
            How we verify data
          </Link>
        </div>
        <p style={{ color: 'var(--ink-soft)', maxWidth: '65ch', marginTop: 18 }}>
          Popular collections:{' '}
          {TOPIC_LIST.map((t, i) => (
            <span key={t.slug}>
              {i > 0 && ' · '}
              <Link href={`/${t.slug}`}>{t.nav}</Link>
            </span>
          ))}
        </p>
      </section>

      <section style={{ maxWidth: 760, marginTop: 30, marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Press, partners & support</h2>
        <p style={{ color: 'var(--ink-soft)', maxWidth: '65ch' }}>
          Dityam is an independent solo-founder project from Ukraine. To
          support the project — <Link href="/support">donation options</Link>;
          for press and partnerships write to{' '}
          <a href="mailto:maryberezhna@gmail.com?subject=Dityam%20partnership">
            maryberezhna@gmail.com
          </a>.
        </p>
      </section>
    </div>
  );
}
