import Link from 'next/link';
import { supabase, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import { TOPIC_NAV } from '@/lib/topics';
import Footer from '../Footer';

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
    `A free platform with ${n}+ verified opportunities for Ukrainian children aged 0–18 — in Ukraine and abroad: camps, scholarships, olympiads, exchange programs, grants and aid. Updated daily, every link checked nightly.`,
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
      'Free platform with verified opportunities for Ukrainian children 0–18, in Ukraine and abroad. Updated daily.',
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

// Ті самі підбірки, що й на головній, тими самими чипами. У попередній версії
// вони були зшиті в один абзац дрібним текстом наприкінці сторінки —
// найкоротший шлях до можливостей виглядав як виноска.

export default async function EnglishPage() {
  const { active, sources } = await getStats();

  return (
    <div className="container en-page" lang="en">
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
            Dityam is a free, ad-free platform that gathers verified
            opportunities for Ukrainian children aged 0–18 — those still in
            Ukraine and those scattered across the world by the war. Camps,
            scholarships, olympiads, exchanges, grants and aid programs:
            collected from {sources ?? FALLBACK.sources} sources, checked
            daily, all in one place.
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

        {/* Праворуч від тексту — те саме фото, що й на головній. Без нього
            права колонка сітки героя лишалась порожньою: 440 порожніх
            пікселів, через які сторінка виглядала недовантаженою. */}
        <div className="hero-photo">
          <picture>
            <source srcSet="/hero-kids.webp" type="image/webp" />
            <img
              src="/hero-kids.jpg"
              width={880}
              height={543}
              alt="Smiling children on a playground"
              fetchPriority="high"
            />
          </picture>
        </div>
      </div>

      <nav className="topic-chips" aria-label="Popular collections">
        <span className="topic-chips-label">Popular:</span>
        {TOPIC_NAV.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`} className="topic-chip">
            {t.labelEn || t.label}
          </Link>
        ))}
      </nav>

      <section className="topic-faq">
        <h2>What’s inside</h2>
        {WHAT.map((w) => (
          <div key={w.en} className="en-what-row">
            <span className="en-what-icon" aria-hidden="true">{w.icon}</span>
            <div>
              <b>{w.en}</b>
              <span className="en-what-note"> — {w.note}</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Listings are in Ukrainian</h2>
        <p>
          Listings are written in Ukrainian — the language of the families we
          serve. If you’re a parent, just head straight to the listings; if you’re a
          teacher, volunteer or partner helping a Ukrainian family abroad, your
          browser’s translate feature works well on every page.
        </p>
        <div className="en-actions">
          <Link href="/" className="opportunity-cta">
            Browse opportunities →
          </Link>
          <Link href="/yak-my-pereviriaiemo" className="cal-btn">
            How we verify data
          </Link>
        </div>
      </section>

      <section>
        <h2>Press, partners &amp; support</h2>
        <p>
          Dityam is an independent solo-founder project from Ukraine. To
          support the project — <Link href="/support">donation options</Link>;
          for press and partnerships write to{' '}
          <a href="mailto:maryberezhna@gmail.com?subject=Dityam%20partnership">
            maryberezhna@gmail.com
          </a>.
        </p>
      </section>

      <Footer lang="en" />
    </div>
  );
}
