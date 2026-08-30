import Link from 'next/link';
import {
  supabase, publicOpportunities, CARD_FIELDS_EN,
  countActiveOpportunities, countActiveSources, FALLBACK,
} from '@/lib/supabase';
import { TOPIC_NAV, topicPath } from '@/lib/topics';
import OpportunitiesList from '../OpportunitiesList';
import Footer from '../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 300;

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

// Той самий набір, що й на українській головній, плюс англійські поля.
async function getOpportunities() {
  if (!supabase) return [];
  const { data, error } = await publicOpportunities(CARD_FIELDS_EN)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase error:', error);
    return [];
  }
  return data || [];
}

export default async function EnglishPage() {
  const opportunities = await getOpportunities();
  const total = opportunities.length;
  const freeCount = opportunities.filter((o) => o.cost_type === 'free').length;
  const sourceCount = new Set(opportunities.map((o) => o.source)).size;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Opportunities for Ukrainian children',
    numberOfItems: total,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/en/o/${o.slug}`,
      name: o.title_en || o.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
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
              Courses, olympiads, scholarships, camps, medical help and state
              payments — in Ukraine and abroad. Every programme is checked by
              hand.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{total || FALLBACK.opportunities}</span>
                <span className="stat-label">
                  {total === 1 ? 'opportunity' : 'opportunities'}
                </span>
              </div>
              <div className="stat">
                <span className="stat-num">{freeCount}</span>
                <span className="stat-label">free of charge</span>
              </div>
              <div className="stat">
                <span className="stat-num">{sourceCount || FALLBACK.sources}</span>
                <span className="stat-label">sources</span>
              </div>
              <div className="stat">
                <span className="stat-num">0–18</span>
                <span className="stat-label">years old</span>
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

        <nav className="topic-chips" aria-label="Collections by topic">
          <span className="topic-chips-label">Collections:</span>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={topicPath(t, 'en')} className="topic-chip">
              {t.labelEn || t.label}
            </Link>
          ))}
        </nav>

        {/* Той самий каталог, що на головній, лише мовою сторінки: назви й
            описи — англійські поля з бази, а доки перекладу для запису немає,
            показуємо оригінал, а не порожнечу. */}
        <OpportunitiesList
          opportunities={opportunities}
          promoProps={{ total }}
          lang="en"
        />

        {/* Чесно про походження текстів: переклад машинний, і сказати про це
            треба самим, а не чекати, поки людина спіткнеться об дивну фразу.
            Оригінал завжди за один клік — на українській версії сторінки. */}
        <p className="en-origin-note">
          Listing texts are translated automatically from the Ukrainian
          originals; the original is always one click away on the Ukrainian
          version of any page. Links lead to the organisers’ own sites, which
          are usually in Ukrainian — your browser translates those in one
          click: right-click the page in Chrome or Edge and choose{' '}
          <i>Translate to English</i>, or press the translate icon in the
          address bar in Safari and Firefox.
        </p>

        <Footer lang="en" />
      </div>
    </>
  );
}
